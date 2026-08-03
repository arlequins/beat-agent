import { evaluateRetrievalCase } from "@arlequins/agent-core";

import type { TRPCServices } from "../context";

export async function runRetrievalEvaluation(
  services: TRPCServices,
  input: {
    cases: Array<{ expectedChunkIds: string[]; id: string; question: string }>;
    workspaceId: string;
  },
) {
  return Promise.all(
    input.cases.map(async (evaluationCase) => {
      const matches = await services.knowledgeSearch.search({
        query: evaluationCase.question,
        workspaceId: input.workspaceId,
      });
      return evaluateRetrievalCase({
        evaluationCase,
        retrievedChunkIds: matches.map((match) => match.citation.chunkId),
      });
    }),
  );
}
