type StreamFailure = Error & {
  provider?: "bedrock" | "ollama" | "test" | "none";
  requestId?: string;
};

function requestIdHint(error: StreamFailure): string {
  return error.requestId ? ` (요청 ID: ${error.requestId})` : "";
}

export function streamErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  const failure =
    error instanceof Error ? (error as StreamFailure) : ({} as StreamFailure);
  const provider = failure.provider;
  if (provider === "bedrock" || message === "Bedrock model request failed") {
    return `Bedrock 모델 요청에 실패했습니다. 잠시 후 다시 시도하세요.${requestIdHint(failure)}`;
  }
  if (provider === "ollama" || message === "Ollama model request failed") {
    return "Ollama에 연결하지 못했습니다. `ollama serve`와 `ollama pull qwen2.5:3b`를 확인한 뒤 다시 보내세요.";
  }
  if (provider === "test" || message === "Test model request failed") {
    return `테스트 모델 요청에 실패했습니다.${requestIdHint(failure)}`;
  }
  if (
    message === "Model completion is not configured" ||
    message === "Local model completion is not configured" ||
    message === "Bedrock model completion is not configured" ||
    message === "Ollama model completion is not configured"
  ) {
    return "응답 모델이 설정되지 않았습니다. 운영 관리자에게 모델 설정을 확인해 달라고 요청하세요.";
  }
  if (message === "Local model request failed") {
    return `모델 요청에 실패했습니다. 잠시 후 다시 시도하세요.${requestIdHint(failure)}`;
  }
  if (message === "응답 스트림을 시작하지 못했습니다.") {
    return "에이전트 API에 연결하지 못했습니다. 로컬 개발 서버가 실행 중인지 확인한 뒤 다시 보내세요.";
  }
  return message;
}
