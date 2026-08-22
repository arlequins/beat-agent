import { describe, expect, it } from "vitest";
import {
  AgentJobBusyError,
  createS3AgentPlatformRepository,
} from "./agent-platform-s3";
import { createMemoryJsonObjectStore } from "./s3-json-store";

async function fixture() {
  const store = createMemoryJsonObjectStore();
  const repository = createS3AgentPlatformRepository(store);
  const workspace = await repository.createWorkspace({
    name: "Arlequin",
    slug: "arlequin",
    userId: "user-1",
  });
  const actor = { userId: "user-1", workspaceId: workspace.id };
  return { actor, repository, store, workspace };
}

describe("S3 agent platform repository", () => {
  it("persists a private workspace, conversation, and immutable message events", async () => {
    const { actor, repository, store, workspace } = await fixture();
    expect(await repository.listWorkspaces("user-1")).toMatchObject([
      { id: workspace.id, role: "owner" },
    ]);
    const conversation = await repository.createConversation(actor, "첫 대화");
    await repository.addMessage(actor, {
      content: "안녕",
      conversationId: conversation.id,
      role: "user",
    });
    expect(await repository.listMessages(actor, conversation.id)).toMatchObject(
      [{ content: "안녕", role: "user" }],
    );
    expect(await store.list(`workspaces/${workspace.id}/events/`)).toHaveLength(
      3,
    );
  });

  it("rejects messages after a conversation is archived", async () => {
    const { actor, repository } = await fixture();
    const conversation = await repository.createConversation(actor);
    await repository.archiveConversation(actor, conversation.id);
    await expect(
      repository.addMessage(actor, {
        content: "늦은 메시지",
        conversationId: conversation.id,
        role: "user",
      }),
    ).rejects.toThrow("archived");
  });

  it("keeps deleted personal records as tombstoned immutable history", async () => {
    const { actor, repository, store } = await fixture();
    const memory = await repository.createMemory(actor, { content: "기억" });
    await repository.reviewMemory(actor, {
      memoryId: memory.id,
      status: "approved",
    });
    await repository.deleteMemory(actor, memory.id);
    expect(await repository.listMemories(actor)).toEqual([]);
    expect(
      await store.get(
        `workspaces/${actor.workspaceId}/state/memories/${memory.id}.json`,
      ),
    ).toBeDefined();
  });

  it("enforces owner membership and updates an existing member role", async () => {
    const { actor, repository } = await fixture();
    await repository.addWorkspaceMember(actor, "user-2", "member");
    const member = { userId: "user-2", workspaceId: actor.workspaceId };
    await expect(repository.assertMember(member)).resolves.toBeUndefined();
    await expect(repository.assertOwner(member)).rejects.toThrow("owner");
    await repository.addWorkspaceMember(actor, "user-2", "owner");
    await expect(repository.assertOwner(member)).resolves.toBeUndefined();
    await expect(
      repository.addWorkspaceMember(
        { userId: "outsider", workspaceId: actor.workspaceId },
        "user-3",
        "member",
      ),
    ).rejects.toThrow("owner");
  });

  it("ingests, embeds, lists, indexes, and tombstones a document", async () => {
    const { actor, repository, store } = await fixture();
    const document = await repository.ingestTextDocument(actor, {
      content: "Beat 문서",
      filename: "beat.txt",
    });
    await expect(
      store.get(document.sourceUri.replace("s3-content://", "")),
    ).resolves.toMatchObject({
      value: {
        content: "Beat 문서",
        contentHash: document.contentHash,
        contentType: "text/plain",
      },
    });
    await expect(
      repository.ingestTextDocument(actor, {
        content: "Beat 문서",
        filename: "duplicate.txt",
      }),
    ).rejects.toThrow("already exists");
    const [chunk] = await repository.listDocumentChunks(actor, document.id);
    await repository.setChunkEmbeddings(actor, [
      { embedding: [1, 0], id: chunk?.id ?? "" },
    ]);
    expect(
      await repository.listKnowledgeChunks(actor.workspaceId),
    ).toMatchObject([{ embedding: [1, 0], label: "beat.txt" }]);
    const run = await repository.createIndexRun(
      actor,
      document.id,
      "s3-vectors",
    );
    await repository.finishIndexRun(actor, {
      error: "provider failure",
      indexRunId: run.id,
      status: "failed",
    });
    expect(await repository.listIndexRuns(actor, document.id)).toMatchObject([
      { error: "provider failure", status: "failed" },
    ]);
    await repository.deleteDocument(actor, document.id);
    expect(await repository.listDocuments(actor)).toEqual([]);
    await expect(
      repository.listDocumentChunks(actor, document.id),
    ).rejects.toThrow("not found");
  });

  it("records both ordinary and investigation feedback with bounded audit data", async () => {
    const { actor, repository } = await fixture();
    const conversation = await repository.createConversation(actor);
    const message = await repository.addMessage(actor, {
      content: "답변",
      conversationId: conversation.id,
      role: "assistant",
    });
    const helpful = await repository.submitFeedback(actor, {
      kind: "helpful",
      messageId: message.id,
    });
    expect(helpful.investigation).toBeUndefined();
    const investigated = await repository.submitFeedback(actor, {
      comment: "근거 확인",
      kind: "needs-investigation",
      messageId: message.id,
    });
    expect(investigated.investigation).toMatchObject({ status: "queued" });
    expect(await repository.workspaceUsage(actor)).toEqual({
      documents: 0,
      memories: 0,
      messages: 1,
      monthlyModelTokens: 0,
      storageBytes: 0,
    });
    expect(await repository.listAuditLog(actor)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "feedback.submitted" }),
      ]),
    );
    await expect(
      repository.submitFeedback(actor, {
        kind: "incorrect",
        messageId: "missing",
      }),
    ).rejects.toThrow("Message was not found");
  });

  it("purges only expired live memories", async () => {
    const { actor, repository, store } = await fixture();
    const expired = await repository.createMemory(actor, {
      content: "expired",
    });
    const active = await repository.createMemory(actor, { content: "active" });
    for (const [memory, expiresAt] of [
      [expired, "2020-01-01T00:00:00.000Z"],
      [active, "2099-01-01T00:00:00.000Z"],
    ] as const) {
      const key = `workspaces/${actor.workspaceId}/state/memories/${memory.id}.json`;
      const record = await store.get<Record<string, unknown>>(key);
      await store.replace(
        key,
        { ...record?.value, expiresAt },
        record?.etag ?? "",
      );
    }
    await expect(repository.purgeExpiredMemories(actor)).resolves.toEqual({
      count: 1,
    });
    expect(await repository.listMemories(actor)).toMatchObject([
      { content: "active" },
    ]);
  });

  it("binds citations to an explicit knowledge release", async () => {
    const { actor, repository } = await fixture();
    const conversation = await repository.createConversation(actor);
    const message = await repository.addMessage(actor, {
      content: "답변",
      conversationId: conversation.id,
      role: "assistant",
    });
    const document = await repository.ingestTextDocument(actor, {
      content: "Beat의 근거 문서",
      filename: "beat.md",
    });
    const [chunk] = await repository.listDocumentChunks(actor, document.id);
    await repository.addMessageCitations(actor, {
      chunkIds: [chunk?.id ?? ""],
      knowledgeReleaseId: "release-2026-07-30",
      messageId: message.id,
    });
    expect(
      await repository.listMessageCitations(actor, message.id),
    ).toMatchObject([
      {
        filename: "beat.md",
        knowledgeReleaseId: "release-2026-07-30",
      },
    ]);
  });

  it("returns the active job estimate and recovers an expired lease", async () => {
    let current = new Date("2026-07-30T00:00:00.000Z");
    const repository = createS3AgentPlatformRepository(
      createMemoryJsonObjectStore(),
      { jobLeaseMs: 1_000, now: () => current },
    );
    const lease = await repository.acquireJob("user-1", {
      estimatedDurationMs: 500,
      kind: "chat",
    });
    await expect(
      repository.acquireJob("user-1", { kind: "chat" }),
    ).rejects.toMatchObject({
      estimatedCompletionAt: "2026-07-30T00:00:00.500Z",
      name: "AgentJobBusyError",
    });
    expect(
      await repository
        .acquireJob("user-1", { kind: "chat" })
        .catch((error) => error),
    ).toBeInstanceOf(AgentJobBusyError);
    current = new Date("2026-07-30T00:00:02.000Z");
    const recovered = await repository.acquireJob("user-1", { kind: "chat" });
    expect(recovered.jobId).not.toBe(lease.jobId);
    await repository.releaseJob(recovered);
    await expect(
      repository.acquireJob("user-1", { kind: "chat" }),
    ).resolves.toMatchObject({ status: "running" });
  });

  it("evaluates approved cases and rejects cross-workspace case ids", async () => {
    const { actor, repository } = await fixture();
    const evaluationCase = await repository.createEvaluationCase(actor, {
      expectedChunkIds: [],
      question: "무엇인가?",
    });
    const run = await repository.createEvaluationRun(actor, "manual");
    await repository.claimEvaluationRun(actor, run.id);
    await expect(
      repository.completeEvaluationRun(actor, {
        results: [
          {
            caseId: evaluationCase.id,
            citationRecall: 1,
            retrievedChunkIds: [],
          },
        ],
        runId: run.id,
      }),
    ).resolves.toEqual({
      averageCitationPrecision: 1,
      averageCitationRecall: 1,
      cases: 1,
    });
    await expect(
      repository.completeEvaluationRun(actor, {
        results: [
          {
            caseId: evaluationCase.id,
            citationRecall: 1,
            retrievedChunkIds: [],
          },
          {
            caseId: evaluationCase.id,
            citationRecall: 1,
            retrievedChunkIds: [],
          },
        ],
        runId: run.id,
      }),
    ).rejects.toThrow("at most once");
    const invalidRun = await repository.createEvaluationRun(actor, "weekly");
    await repository.claimEvaluationRun(actor, invalidRun.id);
    await expect(
      repository.completeEvaluationRun(actor, {
        results: [
          {
            caseId: "missing",
            citationRecall: 0,
            retrievedChunkIds: [],
          },
        ],
        runId: invalidRun.id,
      }),
    ).rejects.toThrow("invalid workspace case");
    expect(await repository.listEvaluationRuns(actor)).toHaveLength(2);
  });

  it("keeps the previous knowledge visible until a reviewed release is activated", async () => {
    const { actor, repository, store } = await fixture();
    const memory = await repository.createMemory(actor, {
      content: "승인 전 기억",
    });
    await repository.reviewMemory(actor, {
      memoryId: memory.id,
      status: "approved",
    });
    await expect(repository.publishRelease(actor)).rejects.toThrow(
      "completed evaluation",
    );
    const evaluationCase = await repository.createEvaluationCase(actor, {
      expectedChunkIds: [],
      question: "기억 확인",
    });
    const run = await repository.createEvaluationRun(actor, "manual");
    await repository.claimEvaluationRun(actor, run.id);
    await repository.completeEvaluationRun(actor, {
      results: [
        {
          caseId: evaluationCase.id,
          citationRecall: 1,
          retrievedChunkIds: [],
        },
      ],
      runId: run.id,
    });
    const release = await repository.publishRelease(actor);
    const later = await repository.createMemory(actor, {
      content: "다음 릴리스 기억",
    });
    await repository.reviewMemory(actor, {
      memoryId: later.id,
      status: "approved",
    });
    expect(
      await repository.listApprovedMemories(actor.workspaceId),
    ).toMatchObject([{ content: "승인 전 기억" }]);
    expect(await repository.activeRelease(actor.workspaceId)).toMatchObject({
      releaseId: release.releaseId,
    });
    expect(
      await store.get(
        `workspaces/${actor.workspaceId}/releases/${release.releaseId}/manifest.json`,
      ),
    ).toMatchObject({ value: { schemaVersion: 1 } });
  });
});
