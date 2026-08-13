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

/** Measures how much of the returned evidence was relevant to the reviewed case. */
export function evaluateCitationPrecision(input: {
  expectedChunkIds: string[];
  retrievedChunkIds: string[];
}) {
  const expected = new Set(input.expectedChunkIds);
  const retrieved = [...new Set(input.retrievedChunkIds)];
  if (retrieved.length === 0) return expected.size === 0 ? 1 : 0;
  return (
    retrieved.filter((chunkId) => expected.has(chunkId)).length /
    retrieved.length
  );
}
