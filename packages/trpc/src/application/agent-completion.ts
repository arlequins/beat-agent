import type { Citation } from "@arlequins/agent-core";
import { createAgentRuntime } from "@arlequins/agent-core";
import type { AgentJobLease } from "../adaptors/agent-platform-s3";
import type { TRPCServices } from "../context";

export type AgentCompletionInput = {
  conversationId: string;
  question: string;
  workspaceId: string;
};

export type AgentCompletionEvent =
  | { text: string; type: "delta" }
  | {
      message: NonNullable<
        Awaited<ReturnType<TRPCServices["agent"]["addMessage"]>>
      >;
      type: "complete";
    };

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
  try {
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
    });
    const text: string[] = [];
    let citations: Citation[] = [];
    for await (const event of runtime.run({
      history: history.slice(0, -1).map((message) => ({
        content: message.content,
        role: message.role as "assistant" | "system" | "user",
      })),
      profile: {
        id: "beat",
        instructions:
          "You are Beat, Arlequin's private personal assistant. Reply in Korean unless Arlequin asks for another language. Be warm, concise, and practical. Use approved memory and retrieved documents only as contextual evidence, cite uncertainty rather than inventing facts, and protect privacy. For reflective or counseling-style conversations, listen carefully and offer supportive questions or small next steps; never diagnose, claim professional authority, or replace emergency or clinical care.",
        name: "Beat",
        workspaceId: input.workspaceId,
      },
      question: input.question,
      workspaceId: input.workspaceId,
    })) {
      if (event.type === "retrieval-complete" || event.type === "complete") {
        citations = event.citations;
        continue;
      }
      if (event.type !== "text-delta") continue;
      text.push(event.text);
      yield { text: event.text, type: "delta" };
    }
    const content = text.join("").trim();
    if (!content) throw new Error("Model returned no text");
    const message = await services.agent.addMessage(actor, {
      content,
      conversationId: input.conversationId,
      model: services.modelId ?? "configured-model",
      role: "assistant",
    });
    if (!message) throw new Error("Assistant message creation failed");
    const knowledgeReleaseId =
      (await services.agent.activeRelease(input.workspaceId))?.releaseId ??
      "live";
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
