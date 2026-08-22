export type AgentStreamEvent = {
  code?: string;
  estimatedCompletionAt?: string;
  message?: string;
  phase?: "generating" | "persisting" | "retrieving" | "started";
  provider?: "bedrock" | "ollama" | "test" | "none";
  requestId?: string;
  text?: string;
  type: "complete" | "delta" | "error" | "status";
};

/** Parse one NDJSON line emitted by the agent stream. */
export function parseAgentStreamLine(
  line: string,
): AgentStreamEvent | undefined {
  const normalized = line.trim();
  if (!normalized) return undefined;
  return JSON.parse(normalized) as AgentStreamEvent;
}

/**
 * Split a decoded stream chunk into complete lines while retaining a final
 * partial line for the next read. The caller must flush the returned remainder
 * after the reader reports `done`.
 */
export function splitAgentStreamChunk(input: string): {
  lines: string[];
  remainder: string;
} {
  const parts = input.split("\n");
  return {
    lines: parts.slice(0, -1),
    remainder: parts.at(-1) ?? "",
  };
}
