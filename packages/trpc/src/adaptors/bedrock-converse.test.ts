import { ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, it, vi } from "vitest";
import { createAwsBedrockConversePort } from "./bedrock-converse";

describe("AWS Bedrock Converse adapter", () => {
  it("separates system instructions and yields only text deltas", async () => {
    const send = vi.fn(async (_command: unknown) => ({
      stream: (async function* () {
        yield { messageStart: { role: "assistant" } };
        yield { contentBlockDelta: { delta: { text: "안녕" } } };
      })(),
    }));
    const port = createAwsBedrockConversePort({ send } as never);
    const output: unknown[] = [];
    for await (const delta of port.stream({
      messages: [
        { content: "지침", role: "system" },
        { content: "질문", role: "user" },
      ],
      modelId: "model",
    }))
      output.push(delta);
    expect(output).toEqual([{ text: "안녕", type: "text-delta" }]);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(ConverseStreamCommand);
    expect((command as ConverseStreamCommand).input).toMatchObject({
      messages: [{ content: [{ text: "질문" }], role: "user" }],
      modelId: "model",
      system: [{ text: "지침" }],
    });
  });

  it("parses Bedrock tool-use and usage events into provider-neutral events", async () => {
    const send = vi.fn(async (_command: unknown) => ({
      stream: (async function* () {
        yield {
          contentBlockStart: {
            contentBlockIndex: 0,
            start: {
              toolUse: { name: "document_search", toolUseId: "call-1" },
            },
          },
        };
        yield {
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { toolUse: { input: '{"query":"MCP"}' } },
          },
        };
        yield { contentBlockStop: { contentBlockIndex: 0 } };
        yield { messageStop: { stopReason: "tool_use" } };
        yield {
          metadata: {
            usage: { inputTokens: 20, outputTokens: 4, totalTokens: 24 },
          },
        };
      })(),
    }));
    const port = createAwsBedrockConversePort({ send } as never);
    const output: unknown[] = [];
    for await (const event of port.stream({
      messages: [{ content: "질문", role: "user" }],
      modelId: "model",
      tools: [
        {
          description: "Search documents",
          inputSchema: { type: "object" },
          name: "document.search",
        },
      ],
    }))
      output.push(event);
    expect(output).toEqual([
      {
        call: {
          id: "call-1",
          input: { query: "MCP" },
          name: "document.search",
        },
        type: "tool-call",
      },
      { reason: "tool_use", type: "stop" },
      {
        type: "usage",
        usage: { inputTokens: 20, outputTokens: 4, totalTokens: 24 },
      },
    ]);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeDefined();
    expect((command as ConverseStreamCommand).input).toMatchObject({
      toolConfig: {
        tools: [{ toolSpec: { name: "document_search" } }],
      },
    });
  });

  it("translates assistant tool calls back to Bedrock-safe names", async () => {
    const send = vi.fn(async (_command: unknown) => ({
      stream: (async function* () {
        yield { messageStop: { stopReason: "end_turn" } };
      })(),
    }));
    const port = createAwsBedrockConversePort({ send } as never);

    for await (const _event of port.stream({
      messages: [
        {
          content: "",
          role: "assistant",
          toolCalls: [
            { id: "call-1", input: { query: "MCP" }, name: "document.search" },
          ],
        },
        {
          content: "문서 결과",
          role: "user",
          toolResults: [
            {
              content: "문서 결과",
              id: "call-1",
              isError: false,
              name: "document.search",
            },
          ],
        },
      ],
      modelId: "model",
      tools: [
        {
          description: "Search documents",
          inputSchema: { type: "object" },
          name: "document.search",
        },
      ],
    })) {
      // Consume the stream so the adapter sends the command.
    }

    const command = send.mock.calls[0]?.[0] as ConverseStreamCommand;
    expect(command.input.messages?.[0]).toMatchObject({
      content: [
        {
          toolUse: {
            name: "document_search",
          },
        },
      ],
      role: "assistant",
    });
  });
});
