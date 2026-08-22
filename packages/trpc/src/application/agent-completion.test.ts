import type { Citation } from "@arlequins/agent-core";
import { describe, expect, it, vi } from "vitest";

import type { TRPCServices } from "../context";
import {
  type AgentCompletionEvent,
  collapseRepeatedParagraphs,
  streamAgentCompletion,
} from "./agent-completion";

function createServices(input?: {
  assistantMessage?: { content: string; id: string; role: string } | null;
  chunks?: string[];
  citations?: Citation[];
  history?: Array<{
    content: string;
    id: string;
    metadata?: { idempotencyKey?: string };
    role: string;
  }>;
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
      listMessages: vi.fn().mockResolvedValue(
        input?.history ?? [
          { content: "이전 질문", id: "previous", role: "user" },
          { content: "질문", id: "message-user", role: "user" },
        ],
      ),
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
  options: {
    idempotencyKey?: string;
    includeStatus?: boolean;
    requestId?: string;
  } = {},
): Promise<AgentCompletionEvent[]> {
  const events: AgentCompletionEvent[] = [];
  for await (const event of streamAgentCompletion(services, "user-1", {
    conversationId: "conversation-1",
    ...(options.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : {}),
    question: "질문",
    ...(options.requestId ? { requestId: options.requestId } : {}),
    workspaceId: "workspace-1",
  })) {
    if (!options.includeStatus && event.type === "status") continue;
    events.push(event);
  }
  return events;
}

describe("streamAgentCompletion", () => {
  it("emits lifecycle status events so clients can explain slow work", async () => {
    const { services } = createServices();
    await expect(
      collect(services, { includeStatus: true, requestId: "request-42" }),
    ).resolves.toEqual([
      {
        estimatedCompletionAt: "2026-07-30T00:02:00.000Z",
        phase: "started",
        requestId: "request-42",
        type: "status",
      },
      { phase: "retrieving", requestId: "request-42", type: "status" },
      { phase: "generating", requestId: "request-42", type: "status" },
      { text: "답", type: "delta" },
      { text: "변", type: "delta" },
      { phase: "persisting", requestId: "request-42", type: "status" },
      {
        message: {
          content: "답변",
          id: "message-assistant",
          role: "assistant",
        },
        type: "complete",
      },
    ]);
  });

  it("returns the persisted answer when a client retries a completed request", async () => {
    const { addMessage, services, streamText } = createServices({
      assistantMessage: {
        content: "새 답변을 만들면 안 됩니다.",
        id: "message-existing-assistant",
        role: "assistant",
      },
      history: [
        { content: "질문", id: "message-user", role: "user" },
        {
          content: "이미 저장된 답변",
          id: "message-existing-assistant",
          metadata: { idempotencyKey: "chat-retry-20260822" },
          role: "assistant",
        },
      ],
    });

    await expect(
      collect(services, { idempotencyKey: "chat-retry-20260822" }),
    ).resolves.toEqual([
      {
        message: {
          content: "이미 저장된 답변",
          id: "message-existing-assistant",
          metadata: { idempotencyKey: "chat-retry-20260822" },
          role: "assistant",
        },
        type: "complete",
      },
    ]);
    expect(streamText).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledOnce();
  });

  it("collapses only adjacent identical answer blocks", () => {
    expect(collapseRepeatedParagraphs("첫 문단\n\n첫 문단\n\n둘째 문단")).toBe(
      "첫 문단\n\n둘째 문단",
    );
    expect(collapseRepeatedParagraphs("한 문단\n다음 줄")).toBe(
      "한 문단\n다음 줄",
    );
    expect(
      collapseRepeatedParagraphs(
        "```ts\nconst first = 1;\n\nconst second = 2;\n```",
      ),
    ).toBe("```ts\nconst first = 1;\n\nconst second = 2;\n```");
  });

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

  it("does not stream or persist hidden reasoning tags", async () => {
    const { addMessage, services } = createServices({
      assistantMessage: {
        content: "최종 답변",
        id: "message-assistant",
        role: "assistant",
      },
      chunks: ["<thinking>내부 계획</thinking>", "최종 답변"],
    });

    await expect(collect(services)).resolves.toEqual([
      { text: "최종 답변", type: "delta" },
      expect.objectContaining({
        message: expect.objectContaining({ content: "최종 답변" }),
        type: "complete",
      }),
    ]);
    expect(addMessage).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ content: "최종 답변" }),
    );
  });

  it("does not persist adjacent duplicate answer blocks", async () => {
    const { addMessage, services } = createServices({
      assistantMessage: {
        content: "첫 문단\n\n둘째 문단",
        id: "message-assistant",
        role: "assistant",
      },
      chunks: ["첫 문단\n\n첫 문단\n\n둘째 문단"],
    });

    await expect(collect(services)).resolves.toEqual([
      {
        text: "첫 문단\n\n첫 문단\n\n둘째 문단",
        type: "delta",
      },
      expect.objectContaining({ type: "complete" }),
    ]);
    expect(addMessage).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        content: "첫 문단\n\n둘째 문단",
      }),
    );
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
