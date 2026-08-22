import {
  createDocumentSecurityScanner,
  createRichDocumentExtraction,
} from "@arlequins/agent-core";
import { describe, expect, it, vi } from "vitest";

import { createS3AgentPlatformRepository } from "../adaptors/agent-platform-s3";
import { createMemoryJsonObjectStore } from "../adaptors/s3-json-store";
import type { TRPCServices } from "../context";
import {
  createAgentJob,
  dispatchAgentJob,
  failAgentJob,
  parseAgentJob,
  processAgentJob,
} from "./agent-jobs";

function mockServices() {
  const agent = {
    claimEvaluationRun: vi.fn().mockResolvedValue({
      acquired: true,
      run: { status: "running" },
    }),
    claimIndexRun: vi.fn().mockResolvedValue({
      acquired: true,
      run: { status: "running" },
    }),
    claimInvestigation: vi.fn().mockResolvedValue({
      acquired: true,
      investigation: { status: "running" },
    }),
    completeDocumentExtraction: vi.fn(),
    completeEvaluationRun: vi.fn(),
    failEvaluationRun: vi.fn(),
    finishIndexRun: vi.fn(),
    finishInvestigation: vi.fn(),
    listDocumentChunks: vi
      .fn()
      .mockResolvedValue([{ content: "chunk", id: "chunk-1" }]),
    listDocuments: vi.fn().mockResolvedValue([
      {
        contentType: "application/pdf",
        filename: "notes.pdf",
        id: "document-1",
        sourceUri: "s3://bucket/document",
      },
    ]),
    listEvaluationCases: vi.fn().mockResolvedValue([]),
    setChunkEmbeddings: vi.fn(),
  };
  const services = {
    agent,
    documentExtraction: {
      extract: vi.fn().mockResolvedValue({ text: "extracted", warnings: [] }),
    },
    documentSecurity: { scan: vi.fn().mockResolvedValue({ warnings: [] }) },
    documentSource: {
      createUploadTarget: vi.fn(),
      read: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      verifyUpload: vi.fn(),
    },
    knowledgeSearch: { search: vi.fn().mockResolvedValue([]) },
    memorySearch: { search: vi.fn().mockResolvedValue([]) },
    modelProvider: "none",
    quota: {
      maxCompletionTokens: 2_048,
      maxDocuments: 10,
      maxMemories: 10,
      maxMessages: 100,
      maxMonthlyModelTokens: 10_000,
      maxStorageBytes: 1_000_000,
    },
  } as unknown as TRPCServices;
  return { agent, services };
}

describe("agent async jobs", () => {
  it("validates job envelopes and dispatches FIFO metadata", async () => {
    const valid = createAgentJob(
      "index.document",
      { userId: "user", workspaceId: "workspace" },
      "job",
    );
    expect(parseAgentJob(valid)).toEqual(valid);
    for (const invalid of [
      null,
      {},
      { ...valid, id: 1 },
      { ...valid, occurredAt: 1 },
      { ...valid, version: 2 },
      { ...valid, name: "unknown" },
      { ...valid, payload: undefined },
      { ...valid, payload: { userId: 1, workspaceId: "workspace" } },
      { ...valid, payload: { userId: "user", workspaceId: 1 } },
    ])
      expect(() => parseAgentJob(invalid)).toThrow();

    const { services } = mockServices();
    const enqueue = vi.fn();
    services.jobQueue = { enqueue };
    await dispatchAgentJob(services, valid);
    expect(enqueue).toHaveBeenCalledWith(valid, {
      deduplicationId: "job",
      groupId: "user",
    });
  });

  it("rejects incomplete jobs and skips actively leased duplicates", async () => {
    const { agent, services } = mockServices();
    await expect(
      processAgentJob(
        services,
        createAgentJob(
          "index.document",
          { userId: "user", workspaceId: "workspace" },
          "job",
        ),
      ),
    ).rejects.toThrow("Index job payload");
    await expect(
      processAgentJob(
        services,
        createAgentJob(
          "investigate.feedback",
          { userId: "user", workspaceId: "workspace" },
          "job",
        ),
      ),
    ).rejects.toThrow("Investigation job payload");
    await expect(
      processAgentJob(
        services,
        createAgentJob(
          "evaluate.retrieval",
          { userId: "user", workspaceId: "workspace" },
          "job",
        ),
      ),
    ).rejects.toThrow("Evaluation job payload");

    agent.claimIndexRun.mockResolvedValueOnce({
      acquired: false,
      run: { status: "running" },
    });
    await expect(
      processAgentJob(
        services,
        createAgentJob(
          "index.document",
          {
            documentId: "document",
            indexRunId: "run",
            userId: "user",
            workspaceId: "workspace",
          },
          "run",
        ),
      ),
    ).resolves.toEqual({ status: "running" });
    agent.claimInvestigation.mockResolvedValueOnce({
      acquired: false,
      investigation: { status: "running" },
    });
    await expect(
      processAgentJob(
        services,
        createAgentJob(
          "investigate.feedback",
          {
            feedbackId: "feedback",
            investigationId: "investigation",
            userId: "user",
            workspaceId: "workspace",
          },
          "investigation",
        ),
      ),
    ).resolves.toEqual({ status: "running" });
    agent.claimEvaluationRun.mockResolvedValueOnce({
      acquired: false,
      run: { status: "running" },
    });
    await expect(
      processAgentJob(
        services,
        createAgentJob(
          "evaluate.retrieval",
          {
            evaluationRunId: "evaluation",
            userId: "user",
            workspaceId: "workspace",
          },
          "evaluation",
        ),
      ),
    ).resolves.toEqual({ status: "running" });
  });

  it("extracts uploaded documents and validates embedding cardinality", async () => {
    const { agent, services } = mockServices();
    services.embedding = { embed: vi.fn().mockResolvedValue([[0.1]]) };
    const job = createAgentJob(
      "extract.document",
      {
        documentId: "document-1",
        indexRunId: "run",
        userId: "user",
        workspaceId: "workspace",
      },
      "run",
    );
    await processAgentJob(services, job);
    expect(agent.completeDocumentExtraction).toHaveBeenCalled();
    expect(agent.setChunkEmbeddings).toHaveBeenCalledWith(expect.anything(), [
      { embedding: [0.1], id: "chunk-1" },
    ]);

    agent.claimIndexRun.mockResolvedValueOnce({
      acquired: true,
      run: { status: "running" },
    });
    services.embedding.embed = vi.fn().mockResolvedValue([]);
    await expect(processAgentJob(services, job)).rejects.toThrow(
      "Embedding response did not match",
    );

    const withoutSource = mockServices();
    delete withoutSource.services.documentSource;
    await expect(processAgentJob(withoutSource.services, job)).rejects.toThrow(
      "Document source is not configured",
    );
    const missingDocument = mockServices();
    missingDocument.agent.listDocuments.mockResolvedValueOnce([]);
    await expect(
      processAgentJob(missingDocument.services, job),
    ).rejects.toThrow("Document was not found");
  });

  it("marks terminal failures for every durable job type", async () => {
    const { agent, services } = mockServices();
    await failAgentJob(
      services,
      createAgentJob(
        "index.document",
        { indexRunId: "index", userId: "user", workspaceId: "workspace" },
        "index",
      ),
      new Error("index failed"),
    );
    await failAgentJob(
      services,
      createAgentJob(
        "investigate.feedback",
        {
          investigationId: "investigation",
          userId: "user",
          workspaceId: "workspace",
        },
        "investigation",
      ),
      "unknown",
    );
    await failAgentJob(
      services,
      createAgentJob(
        "evaluate.retrieval",
        {
          evaluationRunId: "evaluation",
          userId: "user",
          workspaceId: "workspace",
        },
        "evaluation",
      ),
      new Error("evaluation failed"),
    );
    await expect(
      failAgentJob(
        services,
        createAgentJob(
          "evaluate.retrieval",
          { userId: "user", workspaceId: "workspace" },
          "ignored",
        ),
        "ignored",
      ),
    ).resolves.toBeUndefined();
    expect(agent.finishIndexRun).toHaveBeenCalledWith(expect.anything(), {
      error: "index failed",
      indexRunId: "index",
      status: "failed",
    });
    expect(agent.finishInvestigation).toHaveBeenCalledWith(expect.anything(), {
      error: "Agent job failed",
      investigationId: "investigation",
      status: "failed",
    });
    expect(agent.failEvaluationRun).toHaveBeenCalled();
  });

  it("processes indexing, investigations, and reviewed retrieval idempotently", async () => {
    const repository = createS3AgentPlatformRepository(
      createMemoryJsonObjectStore(),
    );
    const workspace = await repository.createWorkspace({
      name: "Personal",
      slug: "personal",
      userId: "user-1",
    });
    const actor = { userId: "user-1", workspaceId: workspace.id };
    const document = await repository.ingestTextDocument(actor, {
      content: "검증할 근거 문장",
      filename: "notes.txt",
    });
    const [chunk] = await repository.listDocumentChunks(actor, document.id);
    if (!chunk) throw new Error("Expected a chunk");
    const services = {
      agent: repository,
      documentExtraction: createRichDocumentExtraction(),
      documentSecurity: createDocumentSecurityScanner(),
      knowledgeSearch: {
        search: async () => [
          {
            citation: {
              chunkId: chunk.id,
              documentId: document.id,
              label: document.filename,
            },
            content: chunk.content,
            score: 1,
          },
        ],
      },
      memorySearch: { search: async () => [] },
      modelProvider: "none",
      quota: {
        maxCompletionTokens: 2_048,
        maxDocuments: 10,
        maxMemories: 10,
        maxMessages: 100,
        maxMonthlyModelTokens: 10_000,
        maxStorageBytes: 1_000_000,
      },
    } satisfies TRPCServices;

    const indexRun = await repository.createIndexRun(actor, document.id);
    const indexJob = createAgentJob(
      "index.document",
      {
        documentId: document.id,
        indexRunId: indexRun.id,
        userId: actor.userId,
        workspaceId: actor.workspaceId,
      },
      indexRun.id,
    );
    await processAgentJob(services, indexJob);
    await processAgentJob(services, indexJob);
    expect((await repository.listIndexRuns(actor))[0]?.status).toBe(
      "completed",
    );

    const conversation = await repository.createConversation(actor);
    const message = await repository.addMessage(actor, {
      content: "확인이 필요한 답변",
      conversationId: conversation.id,
      role: "assistant",
    });
    const feedback = await repository.submitFeedback(actor, {
      kind: "needs-investigation",
      messageId: message.id,
    });
    if (!feedback.investigation) throw new Error("Expected an investigation");
    await processAgentJob(
      services,
      createAgentJob(
        "investigate.feedback",
        {
          feedbackId: feedback.feedback.id,
          investigationId: feedback.investigation.id,
          userId: actor.userId,
          workspaceId: actor.workspaceId,
        },
        feedback.investigation.id,
      ),
    );
    expect((await repository.listInvestigations(actor))[0]).toMatchObject({
      status: "completed",
    });

    await repository.createEvaluationCase(actor, {
      expectedChunkIds: [chunk.id],
      question: "근거는?",
    });
    const evaluation = await repository.createEvaluationRun(actor, "manual");
    await processAgentJob(
      services,
      createAgentJob(
        "evaluate.retrieval",
        {
          evaluationRunId: evaluation.id,
          userId: actor.userId,
          workspaceId: actor.workspaceId,
        },
        evaluation.id,
      ),
    );
    expect((await repository.listEvaluationRuns(actor))[0]).toMatchObject({
      status: "completed",
      summary: { averageCitationRecall: 1 },
    });
  });
});
