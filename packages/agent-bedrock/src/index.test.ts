import { describe, expect, it } from "vitest";

import { createBedrockModelProvider } from "./index";

describe("createBedrockModelProvider", () => {
  it("delegates streaming to the injected cloud boundary", async () => {
    const provider = createBedrockModelProvider({
      client: {
        async *stream() {
          yield "safe";
        },
      },
      modelId: "example.model",
    });
    const chunks: string[] = [];
    for await (const chunk of provider.streamText({
      messages: [{ content: "hello", role: "user" }],
    }))
      chunks.push(chunk);
    expect(chunks).toEqual(["safe"]);
  });
});
