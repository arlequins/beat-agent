import { describe, expect, it } from "vitest";

import {
  createDeterministicTestModelProvider,
  TEST_MODEL_ID,
} from "./test-model";

describe("deterministic E2E model", () => {
  it("returns the question and retrieved evidence as streamed text", async () => {
    const chunks: string[] = [];
    for await (const event of createDeterministicTestModelProvider().streamText(
      {
        messages: [
          {
            content: "[source:chunk-1] Beat는 Arlequin의 개인 비서입니다.",
            role: "system",
          },
          { content: "Beat는 누구의 개인 비서인가요?", role: "user" },
        ],
      },
    )) {
      chunks.push(
        typeof event === "string"
          ? event
          : event.type === "text-delta"
            ? event.text
            : "",
      );
    }

    expect(TEST_MODEL_ID).toBe("deterministic-test-model");
    expect(chunks.join("")).toContain("Beat는 누구의 개인 비서인가요?");
    expect(chunks.join("")).toContain("Beat는 Arlequin의 개인 비서입니다.");
  });
});
