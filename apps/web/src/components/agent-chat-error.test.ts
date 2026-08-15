import { describe, expect, it } from "vitest";
import { streamErrorMessage } from "./agent-chat-error";

describe("streamErrorMessage", () => {
  it("explains Bedrock failures without suggesting Ollama", () => {
    const error = Object.assign(new Error("Bedrock model request failed"), {
      provider: "bedrock" as const,
      requestId: "request-1",
    });

    expect(streamErrorMessage(error)).toContain(
      "Bedrock 모델 요청에 실패했습니다.",
    );
    expect(streamErrorMessage(error)).toContain("request-1");
    expect(streamErrorMessage(error)).not.toContain("Ollama");
  });

  it("keeps local Ollama guidance for local model failures", () => {
    expect(
      streamErrorMessage(new Error("Ollama model request failed")),
    ).toContain("ollama serve");
  });
});
