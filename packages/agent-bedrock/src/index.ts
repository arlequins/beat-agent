import type {
  ModelProviderPort,
  ModelStreamEvent,
  StreamTextRequest,
} from "@arlequins/agent-core";

/**
 * AWS SDK-free boundary for Bedrock Converse streaming. Hosts inject the SDK adapter,
 * keeping Beat installable and testable without cloud credentials.
 */
export type BedrockConversePort = {
  stream(input: {
    messages: StreamTextRequest["messages"];
    modelId: string;
    signal?: StreamTextRequest["signal"];
    tools?: StreamTextRequest["tools"];
  }): AsyncIterable<ModelStreamEvent | string>;
};

export function createBedrockModelProvider(input: {
  client: BedrockConversePort;
  modelId: string;
}): ModelProviderPort {
  return {
    capabilities: { toolUse: true },
    streamText: ({ messages, signal, tools }) =>
      input.client.stream({
        messages,
        modelId: input.modelId,
        ...(signal ? { signal } : {}),
        ...(tools ? { tools } : {}),
      }),
  };
}
