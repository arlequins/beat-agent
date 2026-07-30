import { describe, expect, it, vi } from "vitest";

import type { TRPCServices } from "../context";
import { runRetrievalEvaluation } from "./retrieval-evaluation";

describe("runRetrievalEvaluation", () => {
  it("scores every case against workspace-scoped retrieval results", async () => {
    const search = vi.fn(async ({ query }: { query: string }) => [
      {
        citation: {
          chunkId: query === "known" ? "expected" : "other",
          documentId: "document-1",
          label: "Notes",
        },
        content: "content",
        score: 1,
      },
    ]);
    const services = {
      knowledgeSearch: { search },
    } as unknown as TRPCServices;

    await expect(
      runRetrievalEvaluation(services, {
        cases: [
          {
            expectedChunkIds: ["expected"],
            id: "case-1",
            question: "known",
          },
          {
            expectedChunkIds: ["missing"],
            id: "case-2",
            question: "unknown",
          },
        ],
        workspaceId: "workspace-1",
      }),
    ).resolves.toEqual([
      {
        caseId: "case-1",
        citationRecall: 1,
        retrievedChunkIds: ["expected"],
      },
      {
        caseId: "case-2",
        citationRecall: 0,
        retrievedChunkIds: ["other"],
      },
    ]);
    expect(search).toHaveBeenCalledWith({
      query: "known",
      workspaceId: "workspace-1",
    });
    expect(search).toHaveBeenCalledWith({
      query: "unknown",
      workspaceId: "workspace-1",
    });
  });
});
