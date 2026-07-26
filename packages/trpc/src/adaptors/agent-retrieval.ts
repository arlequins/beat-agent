import type {
  EmbeddingProviderPort,
  KnowledgeSearchPort,
  MemorySearchPort,
} from "@arlequins/agent-core";
import type { Database } from "@arlequins/db-backbone/client";
import {
  Document,
  DocumentChunk,
  MemoryRecord,
} from "@arlequins/db-backbone/schema";
import { type AnyColumn, and, desc, eq, ilike, isNull, or } from "drizzle-orm";

const MAX_RESULTS = 6;
const cosine = (left: number[], right: number[]) => {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    dot += l * r;
    leftNorm += l * l;
    rightNorm += r * r;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
};
const pattern = (query: string) => `%${query.replace(/[\\%_]/g, "\\$&")}%`;

function queryTerms(query: string) {
  const terms = query.match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  return [...new Set(terms)].slice(0, 8);
}

function textMatch(column: AnyColumn, query: string) {
  const terms = queryTerms(query);
  return terms.length > 0
    ? or(...terms.map((term) => ilike(column, pattern(term))))
    : ilike(column, pattern(query));
}

export function createDatabaseMemorySearch(
  database: Database,
): MemorySearchPort {
  return {
    search: async ({ query, workspaceId }) =>
      database
        .select({
          content: MemoryRecord.content,
          id: MemoryRecord.id,
          importance: MemoryRecord.importance,
        })
        .from(MemoryRecord)
        .where(
          and(
            eq(MemoryRecord.workspaceId, workspaceId),
            eq(MemoryRecord.status, "approved"),
            isNull(MemoryRecord.expiresAt),
            textMatch(MemoryRecord.content, query),
          ),
        )
        .orderBy(desc(MemoryRecord.importance))
        .limit(MAX_RESULTS),
  };
}

export function createDatabaseKnowledgeSearch(
  database: Database,
  options: { embedding?: EmbeddingProviderPort } = {},
): KnowledgeSearchPort {
  return {
    search: async ({ query, workspaceId }) => {
      if (options.embedding) {
        try {
          const [queryEmbedding] = await options.embedding.embed({
            input: [query],
          });
          if (queryEmbedding) {
            const vectorRows = await database
              .select({
                chunkId: DocumentChunk.id,
                content: DocumentChunk.content,
                documentId: Document.id,
                embedding: DocumentChunk.embedding,
                label: Document.filename,
                locator: DocumentChunk.locator,
              })
              .from(DocumentChunk)
              .innerJoin(Document, eq(DocumentChunk.documentId, Document.id))
              .where(
                and(
                  eq(Document.workspaceId, workspaceId),
                  eq(Document.status, "completed"),
                  isNull(Document.deletedAt),
                ),
              );
            const ranked = vectorRows
              .filter((row): row is typeof row & { embedding: number[] } =>
                Array.isArray(row.embedding),
              )
              .map((row) => ({
                ...row,
                score: cosine(queryEmbedding, row.embedding),
              }))
              .filter((row) => row.score > 0.2)
              .sort((left, right) => right.score - left.score)
              .slice(0, MAX_RESULTS);
            if (ranked.length > 0)
              return ranked.map((row) => ({
                citation: {
                  chunkId: row.chunkId,
                  documentId: row.documentId,
                  label: row.label,
                  ...(row.locator ? { locator: row.locator } : {}),
                },
                content: row.content,
                score: row.score,
              }));
          }
        } catch {
          // Local retrieval must remain usable when the optional embedding model is not pulled.
        }
      }
      const rows = await database
        .select({
          chunkId: DocumentChunk.id,
          content: DocumentChunk.content,
          documentId: Document.id,
          label: Document.filename,
          locator: DocumentChunk.locator,
        })
        .from(DocumentChunk)
        .innerJoin(Document, eq(DocumentChunk.documentId, Document.id))
        .where(
          and(
            eq(Document.workspaceId, workspaceId),
            eq(Document.status, "completed"),
            isNull(Document.deletedAt),
            textMatch(DocumentChunk.content, query),
          ),
        )
        .limit(MAX_RESULTS);
      return rows.map((row) => ({
        citation: {
          chunkId: row.chunkId,
          documentId: row.documentId,
          label: row.label,
          ...(row.locator ? { locator: row.locator } : {}),
        },
        content: row.content,
        score: 1,
      }));
    },
  };
}
