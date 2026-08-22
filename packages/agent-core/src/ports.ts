import type {
  IndexDocumentRequest,
  KnowledgeMatch,
  Memory,
  ModelCapabilities,
  ModelStreamEvent,
  StreamTextRequest,
} from "./types";

export type { AgentToolPort } from "./types";

export type KnowledgeSearchPort = {
  search(input: {
    query: string;
    knowledgeReleaseId?: string;
    workspaceId: string;
  }): Promise<KnowledgeMatch[]>;
};

export type MemorySearchPort = {
  search(input: {
    knowledgeReleaseId?: string;
    query: string;
    workspaceId: string;
  }): Promise<Memory[]>;
};

export type ModelProviderPort = {
  capabilities?: ModelCapabilities;
  streamText(
    input: StreamTextRequest,
  ): AsyncIterable<ModelStreamEvent | string>;
};

/** Generates local or provider-hosted embeddings. Keep this separate from text generation. */
export type EmbeddingProviderPort = {
  embed(input: { input: string[] }): Promise<number[][]>;
};

/** Boundary for object storage. Implement with filesystem in local development or S3 in AWS. */
export type DocumentSourcePort = {
  read(input: { sourceUri: string; workspaceId: string }): Promise<Uint8Array>;
};

/** Server-side parser boundary. Browser clients never decide how binary files are interpreted. */
export type DocumentExtractionPort = {
  extract(input: {
    bytes: Uint8Array;
    contentType: string;
    filename: string;
  }): Promise<{ text: string; warnings: string[] }>;
};

/** Fail-closed content inspection before an uploaded binary reaches a parser. */
export type DocumentSecurityPort = {
  scan(input: {
    bytes: Uint8Array;
    contentType: string;
    filename: string;
  }): Promise<{ warnings: string[] }>;
};

/** Boundary for vector stores. The relational store maps every vector id back to an authorized chunk. */
export type VectorIndexPort = {
  delete(input: { recordIds: string[]; workspaceId: string }): Promise<void>;
  upsert(input: IndexDocumentRequest): Promise<{ recordIds: string[] }>;
};

/** Queue only an opaque, validated command; workers perform the provider-specific work. */
export type AgentWorkflowPort = {
  startFeedbackInvestigation(input: { feedbackId: string }): Promise<void>;
  startIndexing(input: { indexRunId: string }): Promise<void>;
};
