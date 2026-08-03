import type { BedrockConversePort } from "@arlequins/agent-bedrock";
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";

export function createAwsBedrockConversePort(
  client = new BedrockRuntimeClient({}),
): BedrockConversePort {
  return {
    async *stream({ messages, modelId }) {
      const system = messages
        .filter((message) => message.role === "system")
        .map((message) => ({ text: message.content }));
      const providerMessages: Message[] = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          content: [{ text: message.content }],
          role: message.role === "assistant" ? "assistant" : "user",
        }));
      const response = await client.send(
        new ConverseStreamCommand({
          inferenceConfig: { maxTokens: 2_048, temperature: 0.2 },
          messages: providerMessages,
          modelId,
          ...(system.length ? { system } : {}),
        }),
      );
      if (!response.stream) throw new Error("Bedrock returned no stream");
      for await (const event of response.stream) {
        const text = event.contentBlockDelta?.delta?.text;
        if (text) yield text;
      }
    },
  };
}
