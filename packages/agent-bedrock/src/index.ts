import type {
  ModelProviderPort,
  StreamTextRequest,
} from "@arlequins/agent-core";

/**
 * AWS SDK-free boundary for Bedrock Converse streaming. Hosts inject the SDK adapter,
 * keeping this template installable and testable without cloud credentials.
 */
export type BedrockConversePort = {
  stream(input: {
    messages: StreamTextRequest["messages"];
    modelId: string;
  }): AsyncIterable<string>;
};

export function createBedrockModelProvider(input: {
  client: BedrockConversePort;
  modelId: string;
}): ModelProviderPort {
  return {
    streamText: ({ messages }) =>
      input.client.stream({ messages, modelId: input.modelId }),
  };
}
