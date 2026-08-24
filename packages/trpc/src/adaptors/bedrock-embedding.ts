import type { EmbeddingProviderPort } from "@arlequins/agent-core";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

export type BedrockEmbeddingClient = {
  send(command: InvokeModelCommand): Promise<{ body?: Uint8Array }>;
};

function parseEmbedding(body: Uint8Array | undefined): number[] {
  if (!body) throw new Error("Bedrock embedding response was empty");
  const value = JSON.parse(new TextDecoder().decode(body)) as {
    embedding?: unknown;
  };
  if (
    !Array.isArray(value.embedding) ||
    value.embedding.some((item) => typeof item !== "number")
  )
    throw new Error("Bedrock returned an invalid embedding");
  return value.embedding;
}

/** Bedrock Titan embedding adapter. Keep one request per input for broad model compatibility. */
export function createAwsBedrockEmbeddingProvider(options: {
  client?: BedrockEmbeddingClient;
  modelId: string;
}): EmbeddingProviderPort {
  const client = options.client ?? new BedrockRuntimeClient({});
  return {
    async embed({ input }) {
      return Promise.all(
        input.map(async (text) => {
          const response = await client.send(
            new InvokeModelCommand({
              accept: "application/json",
              body: new TextEncoder().encode(
                JSON.stringify({ inputText: text, normalize: true }),
              ),
              contentType: "application/json",
              modelId: options.modelId,
            }),
          );
          return parseEmbedding(response.body);
        }),
      );
    },
  };
}
