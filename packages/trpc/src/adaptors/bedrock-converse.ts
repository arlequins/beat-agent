import type { BedrockConversePort } from "@arlequins/agent-bedrock";
import type { ModelStreamEvent, ToolDefinition } from "@arlequins/agent-core";
import {
  BedrockRuntimeClient,
  type ContentBlock,
  ConverseStreamCommand,
  type Message,
  type ToolConfiguration,
} from "@aws-sdk/client-bedrock-runtime";

type ToolNameMap = {
  fromBedrock: Map<string, string>;
  toBedrock: Map<string, string>;
};

/** Translate Beat's dotted MCP names at the Bedrock provider boundary. */
function createToolNameMap(tools: ToolDefinition[] | undefined): ToolNameMap {
  const toBedrock = new Map<string, string>();
  const fromBedrock = new Map<string, string>();
  for (const tool of tools ?? []) {
    const providerName = tool.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const existing = fromBedrock.get(providerName);
    if (existing && existing !== tool.name)
      throw new Error(
        `Bedrock tool name collision: ${existing} and ${tool.name}`,
      );
    toBedrock.set(tool.name, providerName);
    fromBedrock.set(providerName, tool.name);
  }
  return { fromBedrock, toBedrock };
}

function messageContent(
  message: {
    content: string;
    toolCalls?: Array<{ id: string; input: unknown; name: string }>;
    toolResults?: Array<{
      content: string;
      id: string;
      isError?: boolean;
    }>;
  },
  toolNameMap: ToolNameMap,
) {
  const blocks: ContentBlock[] = [
    ...(message.content
      ? ([{ text: message.content }] as unknown as ContentBlock[])
      : []),
    ...((message.toolCalls ?? []).map((call) => ({
      toolUse: {
        input: call.input as Record<string, unknown>,
        name: toolNameMap.toBedrock.get(call.name) ?? call.name,
        toolUseId: call.id,
      },
    })) as unknown as ContentBlock[]),
    ...((message.toolResults ?? []).map((result) => ({
      toolResult: {
        content: [{ text: result.content }],
        status: result.isError ? ("error" as const) : ("success" as const),
        toolUseId: result.id,
      },
    })) as unknown as ContentBlock[]),
  ];
  return blocks.length ? blocks : ([{ text: "" }] as unknown as ContentBlock[]);
}

function toolConfig(
  tools: ToolDefinition[] | undefined,
  toolNameMap: ToolNameMap,
) {
  if (!tools?.length) return undefined;
  return {
    tools: tools.map((tool) => ({
      toolSpec: {
        description: tool.description,
        inputSchema: { json: tool.inputSchema },
        name: toolNameMap.toBedrock.get(tool.name) ?? tool.name,
      },
    })),
  } as unknown as ToolConfiguration;
}

export function createAwsBedrockConversePort(
  client = new BedrockRuntimeClient({}),
): BedrockConversePort {
  return {
    async *stream({ messages, modelId, signal, tools }) {
      const toolNameMap = createToolNameMap(tools);
      const system = messages
        .filter((message) => message.role === "system")
        .map((message) => ({ text: message.content }));
      const providerMessages: Message[] = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          content: messageContent(message, toolNameMap),
          role: message.role === "assistant" ? "assistant" : "user",
        }));
      const configuredTools = toolConfig(tools, toolNameMap);
      const response = await client.send(
        new ConverseStreamCommand({
          inferenceConfig: { maxTokens: 2_048, temperature: 0.2 },
          messages: providerMessages,
          modelId,
          ...(system.length ? { system } : {}),
          ...(configuredTools ? { toolConfig: configuredTools } : {}),
        }),
        signal ? { abortSignal: signal } : undefined,
      );
      if (!response.stream) throw new Error("Bedrock returned no stream");
      const pendingTools = new Map<
        number,
        { id: string; input: string; name: string }
      >();
      for await (const event of response.stream) {
        const text = event.contentBlockDelta?.delta?.text;
        if (text) yield { text, type: "text-delta" } satisfies ModelStreamEvent;
        const start = event.contentBlockStart?.start?.toolUse;
        const index = event.contentBlockStart?.contentBlockIndex;
        if (start && index !== undefined && start.toolUseId && start.name) {
          pendingTools.set(index, {
            id: start.toolUseId,
            input: "",
            name: toolNameMap.fromBedrock.get(start.name) ?? start.name,
          });
        }
        const delta = event.contentBlockDelta?.delta?.toolUse?.input;
        const deltaIndex = event.contentBlockDelta?.contentBlockIndex;
        if (delta && deltaIndex !== undefined) {
          const pending = pendingTools.get(deltaIndex);
          if (pending) pending.input += delta;
        }
        const stopIndex = event.contentBlockStop?.contentBlockIndex;
        if (stopIndex !== undefined) {
          const pending = pendingTools.get(stopIndex);
          if (pending) {
            let input: unknown = {};
            try {
              input = pending.input ? JSON.parse(pending.input) : {};
            } catch {
              yield {
                call: {
                  id: pending.id,
                  input: pending.input,
                  name: pending.name,
                },
                type: "tool-call",
              } satisfies ModelStreamEvent;
              pendingTools.delete(stopIndex);
              continue;
            }
            yield {
              call: { id: pending.id, input, name: pending.name },
              type: "tool-call",
            } satisfies ModelStreamEvent;
            pendingTools.delete(stopIndex);
          }
        }
        if (event.messageStop?.stopReason)
          yield {
            reason: event.messageStop.stopReason,
            type: "stop",
          } satisfies ModelStreamEvent;
        if (event.metadata?.usage)
          yield {
            type: "usage",
            usage: {
              inputTokens: event.metadata.usage.inputTokens,
              outputTokens: event.metadata.usage.outputTokens,
              totalTokens: event.metadata.usage.totalTokens,
            },
          } satisfies ModelStreamEvent;
      }
    },
  };
}
