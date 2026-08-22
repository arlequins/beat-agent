import { describe, expect, it, vi } from "vitest";

import type { TRPCServices } from "../context";
import {
  assertWorkspaceQuota,
  WorkspaceQuotaExceededError,
} from "./workspace-quota";

describe("workspace quota", () => {
  it("reserves the completion ceiling before a model call", async () => {
    const services = {
      agent: {
        workspaceUsage: vi.fn().mockResolvedValue({
          documents: 1,
          memories: 2,
          messages: 3,
          monthlyModelTokens: 9_000,
          storageBytes: 100,
        }),
      },
      quota: {
        maxCompletionTokens: 2_048,
        maxDocuments: 10,
        maxMemories: 10,
        maxMessages: 100,
        maxMonthlyModelTokens: 10_000,
        maxStorageBytes: 1_000,
      },
    } as unknown as TRPCServices;

    await expect(
      assertWorkspaceQuota(
        services,
        { userId: "user", workspaceId: "workspace" },
        { monthlyModelTokens: services.quota.maxCompletionTokens },
      ),
    ).rejects.toBeInstanceOf(WorkspaceQuotaExceededError);
  });
});
