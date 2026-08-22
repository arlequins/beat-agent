export type ModelProvider = "bedrock" | "ollama" | "test" | "none";

export const MODEL_REQUEST_FAILED_CODE = "MODEL_REQUEST_FAILED";
export const IDEMPOTENCY_CONFLICT_CODE = "IDEMPOTENCY_CONFLICT";

export const idempotencyConflictMessage =
  "같은 요청 키가 이미 다른 질문에 사용되었습니다.";

export function modelRequestFailureMessage(provider: ModelProvider): string {
  switch (provider) {
    case "bedrock":
      return "Bedrock model request failed";
    case "ollama":
      return "Ollama model request failed";
    case "test":
      return "Test model request failed";
    default:
      return "Model request failed";
  }
}

export function modelNotConfiguredMessage(provider: ModelProvider): string {
  switch (provider) {
    case "bedrock":
      return "Bedrock model completion is not configured";
    case "ollama":
      return "Ollama model completion is not configured";
    default:
      return "Model completion is not configured";
  }
}
