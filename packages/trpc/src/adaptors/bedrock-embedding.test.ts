import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, it, vi } from "vitest";
import { createAwsBedrockEmbeddingProvider } from "./bedrock-embedding";

describe("AWS Bedrock embedding adapter", () => {
  it("maps Titan embedding responses to the provider-neutral port", async () => {
    const send = vi.fn(async (_command: InvokeModelCommand) => ({
      body: new TextEncoder().encode(JSON.stringify({ embedding: [1, 0.5] })),
    }));
    const provider = createAwsBedrockEmbeddingProvider({
      client: { send },
      modelId: "amazon.titan-embed-text-v2:0",
    });
    await expect(provider.embed({ input: ["Beat"] })).resolves.toEqual([
      [1, 0.5],
    ]);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(InvokeModelCommand);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeDefined();
    expect((command as InvokeModelCommand).input).toMatchObject({
      modelId: "amazon.titan-embed-text-v2:0",
      contentType: "application/json",
    });
  });
});
