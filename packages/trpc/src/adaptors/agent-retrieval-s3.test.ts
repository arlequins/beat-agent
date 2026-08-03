import { describe, expect, it, vi } from "vitest";
import {
  createS3KnowledgeSearch,
  createS3MemorySearch,
} from "./agent-retrieval-s3";

describe("S3 retrieval adapters", () => {
  it("ranks approved memory by keyword relevance and importance", async () => {
    const repository = {
      listApprovedMemories: vi.fn().mockResolvedValue([
        { content: "한국어로 간결하게 답변", id: "low", importance: 10 },
        { content: "한국어 답변을 선호", id: "high", importance: 90 },
        { content: "관련 없음", id: "none", importance: 100 },
      ]),
    };
    const search = createS3MemorySearch(repository as never);
    await expect(
      search.search({ query: "한국어 답변", workspaceId: "workspace" }),
    ).resolves.toEqual([
      { content: "한국어 답변을 선호", id: "high", importance: 90 },
      { content: "한국어로 간결하게 답변", id: "low", importance: 10 },
    ]);
    await expect(
      search.search({ query: "a", workspaceId: "workspace" }),
    ).resolves.toEqual([]);
  });

  it("uses embeddings when available and falls back to keywords on provider failure", async () => {
    const repository = {
      listKnowledgeChunks: vi.fn().mockResolvedValue([
        {
          chunkId: "one",
          content: "Beat 개인 비서",
          documentId: "doc",
          embedding: [1, 0],
          label: "beat.md",
          locator: "L1",
        },
        {
          chunkId: "two",
          content: "관련 없는 문서",
          documentId: "doc",
          embedding: [0, 1],
          label: "other.md",
        },
      ]),
    };
    const embedding = { embed: vi.fn().mockResolvedValue([[1, 0]]) };
    const semantic = createS3KnowledgeSearch(repository as never, {
      embedding,
    });
    await expect(
      semantic.search({ query: "질문", workspaceId: "workspace" }),
    ).resolves.toMatchObject([
      {
        citation: {
          chunkId: "one",
          documentId: "doc",
          label: "beat.md",
          locator: "L1",
        },
        score: 1,
      },
    ]);

    embedding.embed.mockRejectedValueOnce(new Error("offline"));
    const fallback = await semantic.search({
      query: "Beat 비서",
      workspaceId: "workspace",
    });
    expect(fallback[0]).toMatchObject({
      citation: { chunkId: "one" },
      score: 1,
    });
  });

  it("handles missing and invalid vectors without returning false matches", async () => {
    const search = createS3KnowledgeSearch(
      {
        listKnowledgeChunks: vi.fn().mockResolvedValue([
          {
            chunkId: "one",
            content: "일치하지 않음",
            documentId: "doc",
            embedding: [],
            label: "doc.md",
          },
        ]),
      } as never,
      { embedding: { embed: vi.fn().mockResolvedValue([[1, 0]]) } },
    );
    await expect(
      search.search({ query: "Beat", workspaceId: "workspace" }),
    ).resolves.toEqual([]);
  });
});
