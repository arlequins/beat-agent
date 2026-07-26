import { createHash } from "node:crypto";
import type { Database } from "@arlequins/db-backbone/client";
import {
  AuditLog,
  Conversation,
  Document,
  DocumentChunk,
  EvaluationCase,
  EvaluationResult,
  EvaluationRun,
  Feedback,
  IndexRun,
  Investigation,
  MemoryRecord,
  Message,
  MessageCitation,
  Workspace,
  WorkspaceMember,
} from "@arlequins/db-backbone/schema";
import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";

export type WorkspaceActor = { userId: string; workspaceId: string };

/** Every query scopes through workspace membership; callers never supply an arbitrary tenant id alone. */
export function createAgentPlatformRepository(database: Database) {
  async function assertMember(actor: WorkspaceActor): Promise<void> {
    const [membership] = await database
      .select({ userId: WorkspaceMember.userId })
      .from(WorkspaceMember)
      .where(
        and(
          eq(WorkspaceMember.workspaceId, actor.workspaceId),
          eq(WorkspaceMember.userId, actor.userId),
        ),
      )
      .limit(1);
    if (!membership) throw new Error("Workspace membership is required");
  }

  async function assertOwner(actor: WorkspaceActor): Promise<void> {
    const [membership] = await database
      .select({ role: WorkspaceMember.role })
      .from(WorkspaceMember)
      .where(
        and(
          eq(WorkspaceMember.workspaceId, actor.workspaceId),
          eq(WorkspaceMember.userId, actor.userId),
          eq(WorkspaceMember.role, "owner"),
        ),
      )
      .limit(1);
    if (!membership) throw new Error("Workspace owner role is required");
  }

  async function audit(
    actor: WorkspaceActor,
    action: string,
    subjectId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await database.insert(AuditLog).values({
      action,
      actorUserId: actor.userId,
      ...(metadata ? { metadata } : {}),
      ...(subjectId ? { subjectId } : {}),
      workspaceId: actor.workspaceId,
    });
  }

  return {
    assertMember,
    assertOwner,
    async createWorkspace(input: {
      name: string;
      slug: string;
      userId: string;
    }) {
      return database.transaction(async (tx) => {
        const [workspace] = await tx
          .insert(Workspace)
          .values({ name: input.name, slug: input.slug })
          .returning();
        if (!workspace) throw new Error("Workspace creation failed");
        await tx.insert(WorkspaceMember).values({
          workspaceId: workspace.id,
          userId: input.userId,
          role: "owner",
        });
        return workspace;
      });
    },
    async listWorkspaces(userId: string) {
      return database
        .select({
          id: Workspace.id,
          name: Workspace.name,
          slug: Workspace.slug,
          role: WorkspaceMember.role,
          createdAt: Workspace.createdAt,
        })
        .from(WorkspaceMember)
        .innerJoin(Workspace, eq(WorkspaceMember.workspaceId, Workspace.id))
        .where(eq(WorkspaceMember.userId, userId))
        .orderBy(Workspace.name);
    },
    async addWorkspaceMember(
      actor: WorkspaceActor,
      userId: string,
      role: "member" | "owner",
    ) {
      await assertOwner(actor);
      const [membership] = await database
        .insert(WorkspaceMember)
        .values({ role, userId, workspaceId: actor.workspaceId })
        .onConflictDoUpdate({
          target: [WorkspaceMember.workspaceId, WorkspaceMember.userId],
          set: { role },
        })
        .returning();
      await audit(actor, "workspace.member.updated", userId, { role });
      return membership;
    },
    async createConversation(actor: WorkspaceActor, title?: string) {
      await assertMember(actor);
      const [conversation] = await database
        .insert(Conversation)
        .values({
          workspaceId: actor.workspaceId,
          createdByUserId: actor.userId,
          ...(title ? { title } : {}),
        })
        .returning();
      return conversation;
    },
    async listConversations(actor: WorkspaceActor) {
      await assertMember(actor);
      return database
        .select()
        .from(Conversation)
        .where(
          and(
            eq(Conversation.workspaceId, actor.workspaceId),
            isNull(Conversation.archivedAt),
          ),
        )
        .orderBy(desc(Conversation.updatedAt));
    },
    async archiveConversation(actor: WorkspaceActor, conversationId: string) {
      await assertMember(actor);
      const [conversation] = await database
        .update(Conversation)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(Conversation.id, conversationId),
            eq(Conversation.workspaceId, actor.workspaceId),
          ),
        )
        .returning();
      if (!conversation)
        throw new Error("Conversation was not found in this workspace");
      await audit(actor, "conversation.archived", conversation.id);
      return conversation;
    },
    async addMessage(
      actor: WorkspaceActor,
      input: {
        content: string;
        conversationId: string;
        model?: string;
        role: "assistant" | "system" | "user";
      },
    ) {
      await assertMember(actor);
      const [conversation] = await database
        .select({ archivedAt: Conversation.archivedAt, id: Conversation.id })
        .from(Conversation)
        .where(
          and(
            eq(Conversation.id, input.conversationId),
            eq(Conversation.workspaceId, actor.workspaceId),
          ),
        )
        .limit(1);
      if (!conversation)
        throw new Error("Conversation was not found in this workspace");
      if (conversation.archivedAt)
        throw new Error("Conversation is archived and cannot accept messages");
      return database.transaction(async (tx) => {
        const [message] = await tx.insert(Message).values(input).returning();
        await tx
          .update(Conversation)
          .set({ updatedAt: new Date() })
          .where(eq(Conversation.id, input.conversationId));
        return message;
      });
    },
    async listMessages(actor: WorkspaceActor, conversationId: string) {
      await assertMember(actor);
      const [conversation] = await database
        .select({ id: Conversation.id })
        .from(Conversation)
        .where(
          and(
            eq(Conversation.id, conversationId),
            eq(Conversation.workspaceId, actor.workspaceId),
          ),
        )
        .limit(1);
      if (!conversation)
        throw new Error("Conversation was not found in this workspace");
      return database
        .select({
          content: Message.content,
          createdAt: Message.createdAt,
          id: Message.id,
          role: Message.role,
        })
        .from(Message)
        .where(eq(Message.conversationId, conversationId))
        .orderBy(Message.createdAt);
    },
    async createDocument(
      actor: WorkspaceActor,
      input: {
        contentHash: string;
        contentType: string;
        filename: string;
        sizeBytes: number;
        sourceUri: string;
      },
    ) {
      await assertMember(actor);
      const [document] = await database
        .insert(Document)
        .values({
          ...input,
          workspaceId: actor.workspaceId,
          uploadedByUserId: actor.userId,
        })
        .returning();
      return document;
    },
    async ingestTextDocument(
      actor: WorkspaceActor,
      input: { content: string; filename: string },
    ) {
      await assertMember(actor);
      const contentHash = createHash("sha256")
        .update(input.content)
        .digest("hex");
      const chunks = input.content.match(/[\s\S]{1,1200}/g) ?? [];
      return database.transaction(async (tx) => {
        const [document] = await tx
          .insert(Document)
          .values({
            contentHash,
            contentType: "text/plain",
            filename: input.filename,
            sizeBytes: Buffer.byteLength(input.content),
            sourceUri: `local://text/${contentHash}`,
            status: "completed",
            uploadedByUserId: actor.userId,
            workspaceId: actor.workspaceId,
          })
          .returning();
        if (!document) throw new Error("Document creation failed");
        if (chunks.length > 0)
          await tx.insert(DocumentChunk).values(
            chunks.map((content, ordinal) => ({
              content,
              documentId: document.id,
              ordinal,
            })),
          );
        return document;
      });
    },
    async listDocuments(actor: WorkspaceActor) {
      await assertMember(actor);
      return database
        .select({
          createdAt: Document.createdAt,
          filename: Document.filename,
          id: Document.id,
          sizeBytes: Document.sizeBytes,
          status: Document.status,
        })
        .from(Document)
        .where(
          and(
            eq(Document.workspaceId, actor.workspaceId),
            isNull(Document.deletedAt),
          ),
        )
        .orderBy(desc(Document.createdAt));
    },
    async deleteDocument(actor: WorkspaceActor, documentId: string) {
      await assertOwner(actor);
      const [document] = await database
        .update(Document)
        .set({ deletedAt: new Date(), status: "deleted" })
        .where(
          and(
            eq(Document.id, documentId),
            eq(Document.workspaceId, actor.workspaceId),
            isNull(Document.deletedAt),
          ),
        )
        .returning({ id: Document.id });
      if (!document)
        throw new Error("Document was not found in this workspace");
      await audit(actor, "document.deleted", document.id);
      return document;
    },
    async listDocumentChunks(actor: WorkspaceActor, documentId: string) {
      await assertMember(actor);
      return database
        .select({ content: DocumentChunk.content, id: DocumentChunk.id })
        .from(DocumentChunk)
        .innerJoin(Document, eq(DocumentChunk.documentId, Document.id))
        .where(
          and(
            eq(DocumentChunk.documentId, documentId),
            eq(Document.workspaceId, actor.workspaceId),
            isNull(Document.deletedAt),
          ),
        )
        .orderBy(DocumentChunk.ordinal);
    },
    async setChunkEmbeddings(
      actor: WorkspaceActor,
      input: Array<{ embedding: number[]; id: string }>,
    ) {
      await assertMember(actor);
      await database.transaction(async (tx) => {
        for (const chunk of input) {
          await tx
            .update(DocumentChunk)
            .set({ embedding: chunk.embedding })
            .where(eq(DocumentChunk.id, chunk.id));
        }
      });
    },
    async listIndexRuns(actor: WorkspaceActor, documentId?: string) {
      await assertMember(actor);
      return database
        .select({
          completedAt: IndexRun.completedAt,
          createdAt: IndexRun.createdAt,
          documentId: IndexRun.documentId,
          error: IndexRun.error,
          id: IndexRun.id,
          provider: IndexRun.provider,
          startedAt: IndexRun.startedAt,
          status: IndexRun.status,
        })
        .from(IndexRun)
        .where(
          and(
            eq(IndexRun.workspaceId, actor.workspaceId),
            ...(documentId ? [eq(IndexRun.documentId, documentId)] : []),
          ),
        )
        .orderBy(desc(IndexRun.createdAt));
    },
    async listMessageCitations(actor: WorkspaceActor, messageId: string) {
      await assertMember(actor);
      return database
        .select({
          content: DocumentChunk.content,
          documentId: Document.id,
          filename: Document.filename,
          locator: DocumentChunk.locator,
          ordinal: MessageCitation.ordinal,
        })
        .from(MessageCitation)
        .innerJoin(Message, eq(MessageCitation.messageId, Message.id))
        .innerJoin(Conversation, eq(Message.conversationId, Conversation.id))
        .innerJoin(DocumentChunk, eq(MessageCitation.chunkId, DocumentChunk.id))
        .innerJoin(Document, eq(DocumentChunk.documentId, Document.id))
        .where(
          and(
            eq(MessageCitation.messageId, messageId),
            eq(Conversation.workspaceId, actor.workspaceId),
            eq(Document.workspaceId, actor.workspaceId),
            isNull(Document.deletedAt),
          ),
        )
        .orderBy(MessageCitation.ordinal);
    },
    async addMessageCitations(
      actor: WorkspaceActor,
      input: { chunkIds: string[]; messageId: string },
    ) {
      await assertMember(actor);
      if (input.chunkIds.length === 0) return;
      await database.insert(MessageCitation).values(
        input.chunkIds.map((chunkId, ordinal) => ({
          chunkId,
          messageId: input.messageId,
          ordinal,
        })),
      );
    },
    async createMemory(
      actor: WorkspaceActor,
      input: {
        content: string;
        importance?: number;
        sourceConversationId?: string;
      },
    ) {
      await assertMember(actor);
      if (input.sourceConversationId) {
        const [conversation] = await database
          .select({ id: Conversation.id })
          .from(Conversation)
          .where(
            and(
              eq(Conversation.id, input.sourceConversationId),
              eq(Conversation.workspaceId, actor.workspaceId),
            ),
          )
          .limit(1);
        if (!conversation)
          throw new Error("Conversation was not found in this workspace");
      }
      const [memory] = await database
        .insert(MemoryRecord)
        .values({
          content: input.content,
          importance: input.importance ?? 50,
          sourceConversationId: input.sourceConversationId,
          workspaceId: actor.workspaceId,
        })
        .returning();
      return memory;
    },
    async reviewMemory(
      actor: WorkspaceActor,
      input: { memoryId: string; status: "approved" | "rejected" },
    ) {
      await assertOwner(actor);
      const [memory] = await database
        .update(MemoryRecord)
        .set({ reviewedAt: new Date(), status: input.status })
        .where(
          and(
            eq(MemoryRecord.id, input.memoryId),
            eq(MemoryRecord.workspaceId, actor.workspaceId),
          ),
        )
        .returning();
      if (!memory) throw new Error("Memory was not found in this workspace");
      await audit(actor, `memory.${input.status}`, memory.id);
      return memory;
    },
    async listMemories(actor: WorkspaceActor) {
      await assertMember(actor);
      return database
        .select({
          content: MemoryRecord.content,
          createdAt: MemoryRecord.createdAt,
          expiresAt: MemoryRecord.expiresAt,
          id: MemoryRecord.id,
          importance: MemoryRecord.importance,
          status: MemoryRecord.status,
        })
        .from(MemoryRecord)
        .where(eq(MemoryRecord.workspaceId, actor.workspaceId))
        .orderBy(desc(MemoryRecord.createdAt));
    },
    async deleteMemory(actor: WorkspaceActor, memoryId: string) {
      await assertOwner(actor);
      const [memory] = await database
        .delete(MemoryRecord)
        .where(
          and(
            eq(MemoryRecord.id, memoryId),
            eq(MemoryRecord.workspaceId, actor.workspaceId),
          ),
        )
        .returning({ id: MemoryRecord.id });
      if (!memory) throw new Error("Memory was not found in this workspace");
      await audit(actor, "memory.deleted", memory.id);
      return memory;
    },
    async purgeExpiredMemories(actor: WorkspaceActor) {
      await assertOwner(actor);
      const removed = await database
        .delete(MemoryRecord)
        .where(
          and(
            eq(MemoryRecord.workspaceId, actor.workspaceId),
            lt(MemoryRecord.expiresAt, new Date()),
          ),
        )
        .returning({ id: MemoryRecord.id });
      await audit(actor, "memory.expired.purged", undefined, {
        count: removed.length,
      });
      return { count: removed.length };
    },
    async createIndexRun(
      actor: WorkspaceActor,
      documentId: string,
      provider = "local",
    ) {
      await assertMember(actor);
      const [document] = await database
        .select({ id: Document.id })
        .from(Document)
        .where(
          and(
            eq(Document.id, documentId),
            eq(Document.workspaceId, actor.workspaceId),
          ),
        )
        .limit(1);
      if (!document)
        throw new Error("Document was not found in this workspace");
      const [run] = await database
        .insert(IndexRun)
        .values({ documentId, provider, workspaceId: actor.workspaceId })
        .returning();
      return run;
    },
    async finishIndexRun(
      actor: WorkspaceActor,
      input: {
        error?: string;
        indexRunId: string;
        status: "completed" | "failed";
      },
    ) {
      await assertMember(actor);
      const [run] = await database
        .update(IndexRun)
        .set({
          ...(input.error ? { error: input.error.slice(0, 1_000) } : {}),
          completedAt: new Date(),
          startedAt: new Date(),
          status: input.status,
        })
        .where(
          and(
            eq(IndexRun.id, input.indexRunId),
            eq(IndexRun.workspaceId, actor.workspaceId),
          ),
        )
        .returning();
      if (!run) throw new Error("Index run was not found in this workspace");
      await audit(actor, `index.${input.status}`, run.id, {
        provider: run.provider,
      });
      return run;
    },
    async submitFeedback(
      actor: WorkspaceActor,
      input: {
        comment?: string;
        kind: "helpful" | "incorrect" | "missing" | "needs-investigation";
        messageId: string;
      },
    ) {
      await assertMember(actor);
      const [message] = await database
        .select({ id: Message.id })
        .from(Message)
        .innerJoin(Conversation, eq(Message.conversationId, Conversation.id))
        .where(
          and(
            eq(Message.id, input.messageId),
            eq(Conversation.workspaceId, actor.workspaceId),
          ),
        )
        .limit(1);
      if (!message) throw new Error("Message was not found in this workspace");
      return database.transaction(async (tx) => {
        const [feedback] = await tx
          .insert(Feedback)
          .values({
            ...input,
            workspaceId: actor.workspaceId,
            submittedByUserId: actor.userId,
          })
          .returning();
        if (!feedback) throw new Error("Feedback creation failed");
        const [investigation] =
          input.kind === "needs-investigation"
            ? await tx
                .insert(Investigation)
                .values({ feedbackId: feedback.id })
                .returning()
            : [];
        return { feedback, investigation };
      });
    },
    async listAuditLog(actor: WorkspaceActor) {
      await assertOwner(actor);
      return database
        .select({
          action: AuditLog.action,
          createdAt: AuditLog.createdAt,
          metadata: AuditLog.metadata,
          subjectId: AuditLog.subjectId,
        })
        .from(AuditLog)
        .where(eq(AuditLog.workspaceId, actor.workspaceId))
        .orderBy(desc(AuditLog.createdAt))
        .limit(100);
    },
    async workspaceUsage(actor: WorkspaceActor) {
      await assertMember(actor);
      const [[documents], [messages], [memories]] = await Promise.all([
        database
          .select({ count: count() })
          .from(Document)
          .where(
            and(
              eq(Document.workspaceId, actor.workspaceId),
              isNull(Document.deletedAt),
            ),
          ),
        database
          .select({ count: count() })
          .from(Message)
          .innerJoin(Conversation, eq(Message.conversationId, Conversation.id))
          .where(eq(Conversation.workspaceId, actor.workspaceId)),
        database
          .select({ count: count() })
          .from(MemoryRecord)
          .where(eq(MemoryRecord.workspaceId, actor.workspaceId)),
      ]);
      return {
        documents: documents?.count ?? 0,
        memories: memories?.count ?? 0,
        messages: messages?.count ?? 0,
      };
    },
    async createEvaluationCase(
      actor: WorkspaceActor,
      input: { expectedChunkIds: string[]; question: string },
    ) {
      await assertOwner(actor);
      const [evaluationCase] = await database
        .insert(EvaluationCase)
        .values({
          ...input,
          createdByUserId: actor.userId,
          workspaceId: actor.workspaceId,
        })
        .returning();
      if (!evaluationCase) throw new Error("Evaluation case creation failed");
      await audit(actor, "evaluation.case.created", evaluationCase.id);
      return evaluationCase;
    },
    async listEvaluationCases(actor: WorkspaceActor) {
      await assertOwner(actor);
      return database
        .select()
        .from(EvaluationCase)
        .where(
          and(
            eq(EvaluationCase.workspaceId, actor.workspaceId),
            eq(EvaluationCase.status, "approved"),
          ),
        )
        .orderBy(desc(EvaluationCase.createdAt));
    },
    async createEvaluationRun(
      actor: WorkspaceActor,
      trigger: "manual" | "weekly",
    ) {
      await assertOwner(actor);
      const [run] = await database
        .insert(EvaluationRun)
        .values({
          startedAt: new Date(),
          status: "running",
          trigger,
          workspaceId: actor.workspaceId,
        })
        .returning();
      if (!run) throw new Error("Evaluation run creation failed");
      await audit(actor, "evaluation.run.started", run.id, { trigger });
      return run;
    },
    async completeEvaluationRun(
      actor: WorkspaceActor,
      input: {
        results: Array<{
          caseId: string;
          citationRecall: number;
          retrievedChunkIds: string[];
        }>;
        runId: string;
      },
    ) {
      await assertOwner(actor);
      const resultCaseIds = input.results.map((result) => result.caseId);
      if (new Set(resultCaseIds).size !== resultCaseIds.length)
        throw new Error(
          "Evaluation results must contain each case at most once",
        );
      const averageCitationRecall = input.results.length
        ? input.results.reduce(
            (sum, result) => sum + result.citationRecall,
            0,
          ) / input.results.length
        : 0;
      await database.transaction(async (tx) => {
        const [run, cases] = await Promise.all([
          tx
            .select({ id: EvaluationRun.id })
            .from(EvaluationRun)
            .where(
              and(
                eq(EvaluationRun.id, input.runId),
                eq(EvaluationRun.workspaceId, actor.workspaceId),
                eq(EvaluationRun.status, "running"),
              ),
            )
            .limit(1),
          resultCaseIds.length
            ? tx
                .select({ id: EvaluationCase.id })
                .from(EvaluationCase)
                .where(
                  and(
                    eq(EvaluationCase.workspaceId, actor.workspaceId),
                    eq(EvaluationCase.status, "approved"),
                    inArray(EvaluationCase.id, resultCaseIds),
                  ),
                )
            : Promise.resolve([]),
        ]);
        if (!run)
          throw new Error("Evaluation run was not found or is not running");
        if (cases.length !== resultCaseIds.length)
          throw new Error(
            "Evaluation results include an invalid workspace case",
          );
        if (input.results.length)
          await tx.insert(EvaluationResult).values(
            input.results.map((result) => ({
              citationRecall: result.citationRecall,
              evaluationCaseId: result.caseId,
              evaluationRunId: input.runId,
              retrievedChunkIds: result.retrievedChunkIds,
            })),
          );
        const [completedRun] = await tx
          .update(EvaluationRun)
          .set({
            completedAt: new Date(),
            status: "completed",
            summary: { averageCitationRecall, cases: input.results.length },
          })
          .where(
            and(
              eq(EvaluationRun.id, input.runId),
              eq(EvaluationRun.workspaceId, actor.workspaceId),
              eq(EvaluationRun.status, "running"),
            ),
          )
          .returning({ id: EvaluationRun.id });
        if (!completedRun)
          throw new Error("Evaluation run was not found or is not running");
      });
      await audit(actor, "evaluation.run.completed", input.runId, {
        averageCitationRecall,
      });
      return { averageCitationRecall, cases: input.results.length };
    },
    async listEvaluationRuns(actor: WorkspaceActor) {
      await assertOwner(actor);
      return database
        .select()
        .from(EvaluationRun)
        .where(eq(EvaluationRun.workspaceId, actor.workspaceId))
        .orderBy(desc(EvaluationRun.createdAt))
        .limit(24);
    },
  };
}
