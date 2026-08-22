import { describe, expect, it } from "vitest";

import { streamErrorMessage } from "./stream-error";

describe("streamErrorMessage", () => {
  it("explains provider failures in Korean", () => {
    const error = Object.assign(new Error("Bedrock model request failed"), {
      provider: "bedrock",
      requestId: "req-123",
    });

    expect(streamErrorMessage(error)).toContain(
      "Bedrock 모델 요청에 실패했습니다",
    );
    expect(streamErrorMessage(error)).toContain("req-123");
  });

  it("gives local setup guidance for Ollama", () => {
    expect(
      streamErrorMessage(new Error("Ollama model request failed")),
    ).toContain("ollama serve");
  });

  it("keeps unknown errors unchanged", () => {
    expect(streamErrorMessage(new Error("알 수 없는 오류"))).toBe(
      "알 수 없는 오류",
    );
  });

  it("explains idempotency key conflicts without blaming the model", () => {
    const error = Object.assign(new Error("conflict"), {
      code: "IDEMPOTENCY_CONFLICT",
    });
    expect(streamErrorMessage(error)).toContain("이미 저장되어 있습니다");
  });
});
