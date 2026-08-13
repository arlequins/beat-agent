import { describe, expect, it, vi } from "vitest";

import { createAgentRuntime } from "./runtime";

describe("createAgentRuntime", () => {
  it("keeps workspace-scoped memory and knowledge in the model context", async () => {
    const runtime = createAgentRuntime({
      knowledgeSearch: {
        async search() {
          return [
            {
              citation: {
                chunkId: "chunk-1",
                documentId: "doc-1",
                label: "Policy",
              },
              content: "The refund period is 14 days.",
              score: 0.9,
            },
          ];
        },
      },
      memorySearch: {
        async search() {
          return [
            {
              content: "The user prefers concise answers.",
              id: "memory-1",
              importance: 1,
            },
          ];
        },
      },
      model: {
        async *streamText(input) {
          expect(input.messages[0]?.content).toContain("concise answers");
          expect(input.messages[0]?.content).toContain("refund period");
          yield "Fourteen days.";
        },
      },
    });

    const events = [];
    for await (const event of runtime.run({
      history: [],
      profile: {
        id: "assistant",
        instructions: "Be helpful.",
        name: "Assistant",
        workspaceId: "workspace-1",
      },
      question: "What is the refund period?",
      workspaceId: "workspace-1",
    }))
      events.push(event);

    expect(events).toEqual([
      {
        type: "retrieval-complete",
        citations: [
          { chunkId: "chunk-1", documentId: "doc-1", label: "Policy" },
        ],
      },
      { type: "text-delta", text: "Fourteen days." },
      {
        type: "complete",
        citations: [
          { chunkId: "chunk-1", documentId: "doc-1", label: "Policy" },
        ],
      },
    ]);
  });

  it("executes bounded structured tool calls and returns the result to the model", async () => {
    const execute = vi.fn().mockResolvedValue({
      content: '{"result":"ok"}',
      id: "tool-call-1",
      name: "workspace.lookup",
    });
    const calls: Array<{ tools?: unknown[]; messages: unknown[] }> = [];
    const runtime = createAgentRuntime({
      knowledgeSearch: {
        async search() {
          return [];
        },
      },
      memorySearch: {
        async search() {
          return [];
        },
      },
      model: {
        capabilities: { toolUse: true },
        async *streamText(input) {
          calls.push(input);
          if (calls.length === 1) {
            yield {
              call: {
                id: "tool-call-1",
                input: { key: "value" },
                name: "workspace.lookup",
              },
              type: "tool-call",
            };
            return;
          }
          yield { type: "usage", usage: { totalTokens: 12 } };
          yield { text: "도구 결과를 반영했습니다.", type: "text-delta" };
        },
      },
      tools: {
        execute,
        list: () => [
          {
            description: "Look up a workspace value",
            inputSchema: { type: "object" },
            name: "workspace.lookup",
          },
        ],
      },
    });
    const events = [];
    for await (const event of runtime.run({
      history: [],
      profile: {
        id: "assistant",
        instructions: "Be helpful.",
        name: "Assistant",
        workspaceId: "workspace-1",
      },
      question: "찾아줘",
      userId: "user-1",
      workspaceId: "workspace-1",
    }))
      events.push(event);

    expect(execute).toHaveBeenCalledWith({
      call: {
        id: "tool-call-1",
        input: { key: "value" },
        name: "workspace.lookup",
      },
      context: { userId: "user-1", workspaceId: "workspace-1" },
    });
    expect(calls[0]?.tools).toHaveLength(1);
    expect(calls[1]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          toolCalls: [
            {
              id: "tool-call-1",
              input: { key: "value" },
              name: "workspace.lookup",
            },
          ],
        }),
        expect.objectContaining({
          role: "user",
          toolResults: [expect.any(Object)],
        }),
      ]),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool-call" }),
        expect.objectContaining({ type: "tool-result" }),
        { type: "usage", usage: { totalTokens: 12 } },
        { text: "도구 결과를 반영했습니다.", type: "text-delta" },
      ]),
    );
  });

  it("does not answer with a mixed knowledge release when a snapshot changes", async () => {
    const runtime = createAgentRuntime({
      knowledgeSearch: {
        async search() {
          throw new Error("Knowledge release changed during agent run");
        },
      },
      memorySearch: {
        async search() {
          return [];
        },
      },
      model: {
        async *streamText() {
          yield "should not run";
        },
      },
    });
    const run = runtime.run({
      history: [],
      knowledgeReleaseId: "release-1",
      profile: {
        id: "assistant",
        instructions: "Be helpful.",
        name: "Assistant",
        workspaceId: "workspace-1",
      },
      question: "질문",
      workspaceId: "workspace-1",
    });
    await expect(async () => {
      for await (const _event of run) {
        // The release-change error is expected before model invocation.
      }
    }).rejects.toThrow("Knowledge release changed");
  });
});
