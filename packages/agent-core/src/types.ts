export type AgentProfile = {
  id: string;
  instructions: string;
  name: string;
  workspaceId: string;
};

export type Citation = {
  chunkId: string;
  documentId: string;
  label: string;
  locator?: string;
};

export type KnowledgeMatch = {
  citation: Citation;
  content: string;
  score: number;
};

export type Memory = {
  content: string;
  id: string;
  importance: number;
};

export type ModelMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

export type StreamTextRequest = {
  messages: ModelMessage[];
};

export type AgentInput = {
  conversationSummary?: string;
  history: ModelMessage[];
  profile: AgentProfile;
  question: string;
  workspaceId: string;
};

export type AgentEvent =
  | { type: "retrieval-complete"; citations: Citation[] }
  | { type: "text-delta"; text: string }
  | { type: "complete"; citations: Citation[] };

export type AgentRun = AsyncIterable<AgentEvent>;

export type FeedbackKind =
  | "helpful"
  | "incorrect"
  | "missing"
  | "needs-investigation";

export type IndexDocumentRequest = {
  chunks: Array<{ content: string; recordId: string }>;
  workspaceId: string;
};

/** A reviewed retrieval expectation. Keep expected evidence explicit and auditable. */
export type RetrievalEvaluationCase = {
  expectedChunkIds: string[];
  id: string;
  question: string;
};

export type RetrievalEvaluationResult = {
  citationRecall: number;
  caseId: string;
  retrievedChunkIds: string[];
};
