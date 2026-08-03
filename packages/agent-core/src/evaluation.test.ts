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

  it("treats a case without expected citations as fully recalled", () => {
    expect(
      evaluateRetrievalCase({
        evaluationCase: {
          expectedChunkIds: [],
          id: "no-citation-case",
          question: "q",
        },
        retrievedChunkIds: [],
      }).citationRecall,
    ).toBe(1);
  });
});
