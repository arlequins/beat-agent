import type {
  RetrievalEvaluationCase,
  RetrievalEvaluationResult,
} from "./types";

/** Deterministic retrieval metric used locally and by scheduled evaluation workers. */
export function evaluateRetrievalCase(input: {
  evaluationCase: RetrievalEvaluationCase;
  retrievedChunkIds: string[];
}): RetrievalEvaluationResult {
  const expected = new Set(input.evaluationCase.expectedChunkIds);
  const retrieved = [...new Set(input.retrievedChunkIds)];
  const matched = retrieved.filter((chunkId) => expected.has(chunkId)).length;
  return {
    caseId: input.evaluationCase.id,
    citationRecall: expected.size === 0 ? 1 : matched / expected.size,
    retrievedChunkIds: retrieved,
  };
}
