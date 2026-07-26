import { describe, expect, it } from "vitest";

import { evaluateRetrievalCase } from "./evaluation";

describe("evaluateRetrievalCase", () => {
  it("deduplicates retrieved chunks and measures expected citation recall", () => {
    expect(
      evaluateRetrievalCase({
        evaluationCase: {
          expectedChunkIds: ["a", "b"],
          id: "case",
          question: "q",
        },
        retrievedChunkIds: ["a", "a", "other"],
      }),
    ).toEqual({
      caseId: "case",
      citationRecall: 0.5,
      retrievedChunkIds: ["a", "other"],
    });
  });
});
