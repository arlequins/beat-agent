import type { Citation } from "@arlequins/agent-core";
import { describe, expect, it, vi } from "vitest";

import type { TRPCServices } from "../context";
import {
  type AgentCompletionEvent,
  streamAgentCompletion,
} from "./agent-completion";

function createServices(input?: {
  assistantMessage?: { content: string; id: string; role: string } | null;
  chunks?: string[];
  citations?: Citation[];
  model?: boolean;
}) {
  const citations = input?.citations ?? [
    { chunkId: "chunk-1", documentId: "document-1", label: "Notes" },
  ];
  const addMessage = vi
    .fn()
    .mockResolvedValueOnce({
      content: "질문",
      id: "message-user",
      role: "user",
    })
    .mockResolvedValueOnce(
      input?.assistantMessage === undefined
        ? { content: "답변", id: "message-assistant", role: "assistant" }
        : input.assistantMessage,
    );
  const addMessageCitations = vi.fn().mockResolvedValue(undefined);
  const releaseJob = vi.fn().mockResolvedValue(undefined);
  const streamText = vi.fn(async function* () {
    for (const chunk of input?.chunks ?? ["답", "변"]) yield chunk;
  });
  const services = {
    agent: {
      acquireJob: vi.fn().mockResolvedValue({
        estimatedCompletionAt: "2026-07-30T00:02:00.000Z",
        etag: '"lease"',
        jobId: "job-1",
        leaseExpiresAt: "2026-07-30T00:05:00.000Z",
        startedAt: "2026-07-30T00:00:00.000Z",
        status: "running",
        userId: "user-1",
      }),
      activeRelease: vi.fn().mockResolvedValue({
        releaseId: "release-1",
      }),
      addMessage,
      addMessageCitations,
      listMessages: vi.fn().mockResolvedValue([
        { content: "이전 질문", id: "previous", role: "user" },
        { content: "질문", id: "message-user", role: "user" },
      ]),
      releaseJob,
    },
    knowledgeSearch: {
      search: vi.fn().mockResolvedValue(
        citations.map((citation) => ({
          citation,
          content: "문서 근거",
          score: 1,
        })),
      ),
    },
    memorySearch: {
      search: vi
        .fn()
        .mockResolvedValue([
          { content: "간결한 답을 선호함", id: "memory-1", importance: 1 },
        ]),
    },
    model: input?.model === false ? undefined : { streamText },
  } as unknown as TRPCServices;
  return { addMessage, addMessageCitations, releaseJob, services, streamText };
}

async function collect(
  services: TRPCServices,
): Promise<AgentCompletionEvent[]> {
  const events: AgentCompletionEvent[] = [];
  for await (const event of streamAgentCompletion(services, "user-1", {
    conversationId: "conversation-1",
    question: "질문",
    workspaceId: "workspace-1",
  }))
    events.push(event);
  return events;
}

describe("streamAgentCompletion", () => {
  it("streams the answer and persists one cited assistant message", async () => {
    const { addMessage, addMessageCitations, services, streamText } =
      createServices();

    await expect(collect(services)).resolves.toEqual([
      { text: "답", type: "delta" },
      { text: "변", type: "delta" },
      {
        message: {
          content: "답변",
          id: "message-assistant",
          role: "assistant",
        },
        type: "complete",
      },
    ]);
    expect(addMessage).toHaveBeenNthCalledWith(
      1,
      { userId: "user-1", workspaceId: "workspace-1" },
      {
        content: "질문",
        conversationId: "conversation-1",
        role: "user",
      },
    );
    expect(addMessage).toHaveBeenNthCalledWith(
      2,
      { userId: "user-1", workspaceId: "workspace-1" },
      expect.objectContaining({
        content: "답변",
        conversationId: "conversation-1",
        role: "assistant",
      }),
    );
    expect(addMessageCitations).toHaveBeenCalledWith(
      { userId: "user-1", workspaceId: "workspace-1" },
      {
        chunkIds: ["chunk-1"],
        knowledgeReleaseId: "release-1",
        messageId: "message-assistant",
      },
    );
    expect(streamText).toHaveBeenCalledWith({
      messages: expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("간결한 답을 선호함"),
          role: "system",
        }),
        { content: "이전 질문", role: "user" },
        { content: "질문", role: "user" },
      ]),
    });
  });

  it("fails before persistence when no model is configured", async () => {
    const { addMessage, services } = createServices({ model: false });

    await expect(collect(services)).rejects.toThrow(
      "Model completion is not configured",
    );
    expect(addMessage).not.toHaveBeenCalled();
  });

  it("rejects empty model output instead of storing an empty answer", async () => {
    const { addMessage, services } = createServices({ chunks: [" ", "\n"] });

    await expect(collect(services)).rejects.toThrow("Model returned no text");
    expect(addMessage).toHaveBeenCalledOnce();
  });

  it("requires the assistant message to be durably created", async () => {
    const { addMessageCitations, services } = createServices({
      assistantMessage: null,
    });

    await expect(collect(services)).rejects.toThrow(
      "Assistant message creation failed",
    );
    expect(addMessageCitations).not.toHaveBeenCalled();
  });
});
