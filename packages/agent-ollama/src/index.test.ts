import { describe, expect, it } from "vitest";

import {
  createOllamaEmbeddingProvider,
  createOllamaModelProvider,
} from "./index";

describe("createOllamaModelProvider", () => {
  it("streams Ollama chat chunks and uses the configured local model", async () => {
    const requests: Request[] = [];
    const provider = createOllamaModelProvider({
      baseUrl: "http://127.0.0.1:11434",
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(
          '{"message":{"content":"Hello"}}\n{"message":{"content":" world"},"done":true}\n',
          { status: 200 },
        );
      },
      model: "qwen3:4b",
    });

    const chunks: string[] = [];
    for await (const chunk of provider.streamText({
      messages: [{ role: "user", content: "Hi" }],
    }))
      chunks.push(chunk);

    expect(chunks.join("")).toBe("Hello world");
    expect(requests[0]?.url).toBe("http://127.0.0.1:11434/api/chat");
    const body = (await requests[0]?.json()) as {
      messages: Array<{ content: string; role: string }>;
    };
    expect(body).toMatchObject({
      model: "qwen3:4b",
      stream: true,
      think: false,
    });
    expect(body.messages[0]).toEqual({ role: "system", content: "/no_think" });
  });

  it("rejects remote endpoints to keep local conversations local", () => {
    expect(() =>
      createOllamaModelProvider({ baseUrl: "https://example.com" }),
    ).toThrow("loopback");
  });

  it("embeds batches through the local Ollama endpoint", async () => {
    const provider = createOllamaEmbeddingProvider({
      baseUrl: "http://localhost:11434",
      fetch: async () =>
        new Response(
          JSON.stringify({
            embeddings: [
              [0.1, 0.2],
              [0.3, 0.4],
            ],
          }),
        ),
      model: "nomic-embed-text",
    });
    await expect(
      provider.embed({ input: ["first", "second"] }),
    ).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });
});
