import type { TRPCServices } from "../context";

type QuotaDelta = {
  documents?: number;
  memories?: number;
  messages?: number;
  monthlyModelTokens?: number;
  storageBytes?: number;
};

export class WorkspaceQuotaExceededError extends Error {
  readonly resource: string;

  constructor(resource: string) {
    super(`워크스페이스의 ${resource} 사용 한도에 도달했습니다.`);
    this.name = "WorkspaceQuotaExceededError";
    this.resource = resource;
  }
}

export async function assertWorkspaceQuota(
  services: TRPCServices,
  actor: { userId: string; workspaceId: string },
  delta: QuotaDelta,
) {
  const usage = await services.agent.workspaceUsage(actor);
  const checks = [
    {
      current: usage.documents,
      delta: delta.documents ?? 0,
      limit: services.quota.maxDocuments,
      resource: "문서 수",
    },
    {
      current: usage.memories,
      delta: delta.memories ?? 0,
      limit: services.quota.maxMemories,
      resource: "기억 수",
    },
    {
      current: usage.messages,
      delta: delta.messages ?? 0,
      limit: services.quota.maxMessages,
      resource: "메시지 수",
    },
    {
      current: usage.monthlyModelTokens,
      delta: delta.monthlyModelTokens ?? 0,
      limit: services.quota.maxMonthlyModelTokens,
      resource: "월간 모델 토큰",
    },
    {
      current: usage.storageBytes,
      delta: delta.storageBytes ?? 0,
      limit: services.quota.maxStorageBytes,
      resource: "문서 저장 용량",
    },
  ];
  const exceeded = checks.find(
    (check) => check.current + check.delta > check.limit,
  );
  if (exceeded) throw new WorkspaceQuotaExceededError(exceeded.resource);
  return usage;
}
