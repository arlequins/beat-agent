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
  knowledgeReleaseId?: string;
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
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
};

export type JsonSchema = Record<string, unknown>;

export type ToolDefinition = {
  description: string;
  inputSchema: JsonSchema;
  name: string;
  requiresConfirmation?: boolean;
};

export type ToolCall = {
  id: string;
  input: unknown;
  name: string;
};

export type ToolResult = {
  content: string;
  id: string;
  isError?: boolean;
  name: string;
};

export type ToolExecutionContext = {
  requestId?: string;
  userId?: string;
  workspaceId: string;
};

export type AgentToolPort = {
  execute(input: {
    call: ToolCall;
    context: ToolExecutionContext;
  }): Promise<ToolResult>;
  list(): ToolDefinition[];
};

export type ModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ModelCapabilities = {
  toolUse: boolean;
};

export type ModelStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; call: ToolCall }
  | { type: "usage"; usage: ModelUsage }
  | { type: "stop"; reason?: string };

export type StreamTextRequest = {
  messages: ModelMessage[];
  signal?: AbortSignal;
  tools?: ToolDefinition[];
};

export type AgentInput = {
  conversationSummary?: string;
  history: ModelMessage[];
  profile: AgentProfile;
  question: string;
  requestId?: string;
  userId?: string;
  knowledgeReleaseId?: string;
  workspaceId: string;
};

export type AgentEvent =
  | {
      type: "retrieval-complete";
      citations: Citation[];
      knowledgeReleaseId?: string;
    }
  | { type: "retrieval-degraded"; reason: string }
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; call: ToolCall }
  | { type: "tool-result"; result: ToolResult }
  | { type: "usage"; usage: ModelUsage }
  | { type: "stop"; reason?: string }
  | {
      type: "complete";
      citations: Citation[];
      knowledgeReleaseId?: string;
    };

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
