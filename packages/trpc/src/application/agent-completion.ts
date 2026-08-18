import {
  type Citation,
  createAgentRuntime,
  createHiddenThoughtFilter,
  type ModelUsage,
  type ToolCall,
} from "@arlequins/agent-core";
import type { AgentJobLease } from "../adaptors/agent-platform-s3";
import type { TRPCServices } from "../context";

export type AgentCompletionInput = {
  conversationId: string;
  question: string;
  workspaceId: string;
};

export type AgentCompletionEvent =
  | { text: string; type: "delta" }
  | { call: ToolCall; type: "tool-call" }
  | { type: "usage"; usage: ModelUsage }
  | {
      message: NonNullable<
        Awaited<ReturnType<TRPCServices["agent"]["addMessage"]>>
      >;
      type: "complete";
    };

function normalizeForComparison(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

/** Remove only adjacent, identical Markdown blocks produced twice by a model. */
export function collapseRepeatedParagraphs(value: string): string {
  const normalizedValue = value.replace(/\r\n/g, "\n").trim();
  if (!normalizedValue) return "";

  const blocks: string[] = [];
  const current: string[] = [];
  let fenceMarker: string | undefined;
  for (const line of normalizedValue.split("\n")) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
    if (!fenceMarker && !line.trim() && current.length > 0) {
      blocks.push(current.join("\n").trim());
      current.length = 0;
    }
    current.push(line);
    if (fence) {
      if (!fenceMarker) {
        fenceMarker = fence;
      } else if (
        fence[0] === fenceMarker[0] &&
        fence.length >= fenceMarker.length
      ) {
        fenceMarker = undefined;
      }
    }
  }
  if (current.length > 0) blocks.push(current.join("\n").trim());

  const result: string[] = [];
  for (const block of blocks) {
    if (!block) continue;
    const previous = result.at(-1);
    if (
      previous &&
      normalizeForComparison(previous) === normalizeForComparison(block)
    ) {
      continue;
    }
    result.push(block);
  }
  return result.join("\n\n");
}

/** A single persistence path for normal tRPC responses and incremental HTTP responses. */
export async function* streamAgentCompletion(
  services: TRPCServices,
  userId: string,
  input: AgentCompletionInput,
  acquiredLease?: AgentJobLease,
): AsyncIterable<AgentCompletionEvent> {
  if (!services.model) throw new Error("Model completion is not configured");
  const lease =
    acquiredLease ??
    (await services.agent.acquireJob(userId, {
      estimatedDurationMs: 120_000,
      kind: "chat",
    }));
  const actor = { userId, workspaceId: input.workspaceId };
  const startedAt = Date.now();
  try {
    const knowledgeReleaseId =
      (await services.agent.activeRelease(input.workspaceId))?.releaseId ??
      "live";
    await services.agent.addMessage(actor, {
      content: input.question,
      conversationId: input.conversationId,
      role: "user",
    });
    const history = await services.agent.listMessages(
      actor,
      input.conversationId,
    );
    const runtime = createAgentRuntime({
      knowledgeSearch: services.knowledgeSearch,
      memorySearch: services.memorySearch,
      model: services.model,
      tools: services.tools,
    });
    const text: string[] = [];
    const hiddenThoughtFilter = createHiddenThoughtFilter();
    let citations: Citation[] = [];
    let usage: ModelUsage | undefined;
    let retrievalDegraded = false;
    for await (const event of runtime.run({
      history: history.slice(0, -1).map((message) => ({
        content: message.content,
        role: message.role as "assistant" | "system" | "user",
      })),
      profile: {
        id: "beat",
        instructions:
          "You are Beat, Arlequin's private personal assistant. Reply in Korean unless Arlequin asks for another language. Be warm, concise, and practical. Use approved memory and retrieved documents only as contextual evidence, cite uncertainty rather than inventing facts, and protect privacy. For reflective or counseling-style conversations, listen carefully and offer supportive questions or small next steps; never diagnose, claim professional authority, or replace emergency or clinical care. Answer the user's question once. Do not narrate internal verification, mention duplicate answers, or repeat the same sentence or paragraph. If information is uncertain, state that once and ask at most one concise follow-up question. Return only the final answer for the user. Never reveal chain-of-thought or internal reasoning, and never emit <thinking>, <think>, or <analysis> tags.",
        name: "Beat",
        workspaceId: input.workspaceId,
      },
      question: input.question,
      userId,
      knowledgeReleaseId,
      requestId: lease.jobId,
      workspaceId: input.workspaceId,
    })) {
      if (event.type === "retrieval-complete" || event.type === "complete") {
        citations = event.citations;
        continue;
      }
      if (event.type === "retrieval-degraded") {
        retrievalDegraded = true;
        continue;
      }
      if (event.type === "usage") {
        usage = event.usage;
        yield event;
        continue;
      }
      if (event.type === "tool-call") {
        yield event;
        continue;
      }
      if (event.type !== "text-delta") continue;
      const safeText = hiddenThoughtFilter.push(event.text);
      if (!safeText) continue;
      text.push(safeText);
      yield { text: safeText, type: "delta" };
    }
    const trailingText = hiddenThoughtFilter.flush();
    if (trailingText) {
      text.push(trailingText);
      yield { text: trailingText, type: "delta" };
    }
    const content = collapseRepeatedParagraphs(text.join(""));
    if (!content) throw new Error("Model returned no text");
    const message = await services.agent.addMessage(actor, {
      content,
      conversationId: input.conversationId,
      metadata: {
        knowledgeReleaseId,
        latencyMs: Date.now() - startedAt,
        promptVersion: "beat-assistant-v3",
        ...(retrievalDegraded ? { retrievalDegraded: true } : {}),
        ...(usage ? { usage } : {}),
      },
      model: services.modelId ?? "configured-model",
      role: "assistant",
    });
    if (!message) throw new Error("Assistant message creation failed");
    await services.agent.addMessageCitations(actor, {
      chunkIds: citations.map((citation) => citation.chunkId),
      knowledgeReleaseId,
      messageId: message.id,
    });
    yield { message, type: "complete" };
  } finally {
    await services.agent.releaseJob(lease);
  }
}
