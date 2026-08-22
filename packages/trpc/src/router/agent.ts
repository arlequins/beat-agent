import {
  addMessageInputSchema,
  addWorkspaceMemberInputSchema,
  completeAgentInputSchema,
  completeDocumentUploadInputSchema,
  conversationScopeInputSchema,
  createConversationInputSchema,
  createDocumentInputSchema,
  createEvaluationCaseInputSchema,
  createMemoryInputSchema,
  createWorkspaceInputSchema,
  documentScopeInputSchema,
  ingestTextDocumentInputSchema,
  memoryScopeInputSchema,
  messageCitationInputSchema,
  publishReleaseInputSchema,
  requestDocumentUploadInputSchema,
  reviewMemoryInputSchema,
  startIndexInputSchema,
  submitFeedbackInputSchema,
  workspaceScopeInputSchema,
} from "@arlequins/validators";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { streamAgentCompletion } from "../application/agent-completion";
import { createAgentJob, dispatchAgentJob } from "../application/agent-jobs";
import {
  assertWorkspaceQuota,
  WorkspaceQuotaExceededError,
} from "../application/workspace-quota";
import {
  modelNotConfiguredMessage,
  modelRequestFailureMessage,
} from "../model-errors";
import { protectedProcedure } from "../trpc";

function actor(userId: string, workspaceId: string) {
  return { userId, workspaceId };
}

async function enforceQuota(
  services: Parameters<typeof assertWorkspaceQuota>[0],
  workspaceActor: ReturnType<typeof actor>,
  delta: Parameters<typeof assertWorkspaceQuota>[2],
) {
  try {
    return await assertWorkspaceQuota(services, workspaceActor, delta);
  } catch (error) {
    if (error instanceof WorkspaceQuotaExceededError)
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: error.message,
      });
    throw error;
  }
}

/** Workspace is taken from validated input and checked by the repository on every operation. */
export const agentRouter = {
  workspaces: protectedProcedure.query(({ ctx }) =>
    ctx.services.agent.listWorkspaces(ctx.session.user.id),
  ),
  createWorkspace: protectedProcedure
    .input(createWorkspaceInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.createWorkspace({
        ...input,
        userId: ctx.session.user.id,
      }),
    ),
  addWorkspaceMember: protectedProcedure
    .input(addWorkspaceMemberInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.addWorkspaceMember(
        actor(ctx.session.user.id, input.workspaceId),
        input.userId,
        input.role,
      ),
    ),
  createEvaluationCase: protectedProcedure
    .input(createEvaluationCaseInputSchema)
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...evaluationCase } = input;
      return ctx.services.agent.createEvaluationCase(
        actor(ctx.session.user.id, workspaceId),
        evaluationCase,
      );
    }),
  evaluationCases: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listEvaluationCases(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  runEvaluation: protectedProcedure
    .input(workspaceScopeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const actorInput = actor(ctx.session.user.id, input.workspaceId);
      const run = await ctx.services.agent.createEvaluationRun(
        actorInput,
        "manual",
      );
      await dispatchAgentJob(
        ctx.services,
        createAgentJob(
          "evaluate.retrieval",
          {
            evaluationRunId: run.id,
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
          run.id,
        ),
      );
      return run;
    }),
  evaluationRuns: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listEvaluationRuns(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  activeRelease: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(async ({ ctx, input }) => {
      const actorInput = actor(ctx.session.user.id, input.workspaceId);
      await ctx.services.agent.assertMember(actorInput);
      return (
        (await ctx.services.agent.activeRelease(input.workspaceId)) ?? null
      );
    }),
  publishRelease: protectedProcedure
    .input(publishReleaseInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.publishRelease(
        actor(ctx.session.user.id, input.workspaceId),
        { minimumCitationRecall: input.minimumCitationRecall },
      ),
    ),
  conversations: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listConversations(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  archiveConversation: protectedProcedure
    .input(conversationScopeInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.archiveConversation(
        actor(ctx.session.user.id, input.workspaceId),
        input.conversationId,
      ),
    ),
  messages: protectedProcedure
    .input(conversationScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listMessages(
        actor(ctx.session.user.id, input.workspaceId),
        input.conversationId,
      ),
    ),
  createConversation: protectedProcedure
    .input(createConversationInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.createConversation(
        actor(ctx.session.user.id, input.workspaceId),
        input.title,
      ),
    ),
  addMessage: protectedProcedure
    .input(addMessageInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, ...message } = input;
      await enforceQuota(
        ctx.services,
        actor(ctx.session.user.id, workspaceId),
        { messages: 1 },
      );
      return ctx.services.agent.addMessage(
        actor(ctx.session.user.id, workspaceId),
        message,
      );
    }),
  ingestTextDocument: protectedProcedure
    .input(ingestTextDocumentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { content, contentType, filename, workspaceId } = input;
      const actorInput = actor(ctx.session.user.id, workspaceId);
      await enforceQuota(ctx.services, actorInput, {
        documents: 1,
        storageBytes: new TextEncoder().encode(content).byteLength,
      });
      const extracted = await ctx.services.documentExtraction.extract({
        bytes: new TextEncoder().encode(content),
        contentType,
        filename,
      });
      const created = await ctx.services.agent.ingestTextDocument(actorInput, {
        content: extracted.text,
        filename,
      });
      if (ctx.services.embedding) {
        try {
          const chunks = await ctx.services.agent.listDocumentChunks(
            actorInput,
            created.id,
          );
          const embeddings = await ctx.services.embedding.embed({
            input: chunks.map((chunk) => chunk.content),
          });
          if (embeddings.length === chunks.length)
            await ctx.services.agent.setChunkEmbeddings(
              actorInput,
              chunks.map((chunk, index) => ({
                embedding: embeddings[index] ?? [],
                id: chunk.id,
              })),
            );
        } catch {
          // Keyword retrieval is a deliberate local fallback when the embedding model is unavailable.
        }
      }
      return created;
    }),
  requestDocumentUpload: protectedProcedure
    .input(requestDocumentUploadInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.services.documentSource)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "문서 업로드 저장소가 구성되지 않았습니다.",
        });
      const workspaceActor = actor(ctx.session.user.id, input.workspaceId);
      await enforceQuota(ctx.services, workspaceActor, {
        documents: 1,
        storageBytes: input.sizeBytes,
      });
      await ctx.services.agent.assertMember(workspaceActor);
      return ctx.services.documentSource.createUploadTarget({
        ...input,
        userId: ctx.session.user.id,
      });
    }),
  completeDocumentUpload: protectedProcedure
    .input(completeDocumentUploadInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.services.documentSource)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "문서 업로드 저장소가 구성되지 않았습니다.",
        });
      const workspaceActor = actor(ctx.session.user.id, input.workspaceId);
      await enforceQuota(ctx.services, workspaceActor, {
        documents: 1,
        storageBytes: input.sizeBytes,
      });
      await ctx.services.documentSource.verifyUpload(input);
      const document = await ctx.services.agent.createDocument(workspaceActor, {
        contentHash: input.contentHash,
        contentType: input.contentType,
        filename: input.filename,
        sizeBytes: input.sizeBytes,
        sourceUri: input.sourceUri,
      });
      const run = await ctx.services.agent.createIndexRun(
        workspaceActor,
        document.id,
        "extract",
      );
      await dispatchAgentJob(
        ctx.services,
        createAgentJob(
          "extract.document",
          {
            documentId: document.id,
            indexRunId: run.id,
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
          run.id,
        ),
      );
      return { document, run };
    }),
  documents: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listDocuments(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  deleteDocument: protectedProcedure
    .input(documentScopeInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.deleteDocument(
        actor(ctx.session.user.id, input.workspaceId),
        input.documentId,
      ),
    ),
  messageCitations: protectedProcedure
    .input(messageCitationInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listMessageCitations(
        actor(ctx.session.user.id, input.workspaceId),
        input.messageId,
      ),
    ),
  createMemory: protectedProcedure
    .input(createMemoryInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, ...memory } = input;
      await enforceQuota(
        ctx.services,
        actor(ctx.session.user.id, workspaceId),
        { memories: 1 },
      );
      return ctx.services.agent.createMemory(
        actor(ctx.session.user.id, workspaceId),
        memory,
      );
    }),
  reviewMemory: protectedProcedure
    .input(reviewMemoryInputSchema)
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...memory } = input;
      return ctx.services.agent.reviewMemory(
        actor(ctx.session.user.id, workspaceId),
        memory,
      );
    }),
  memories: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listMemories(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  deleteMemory: protectedProcedure
    .input(memoryScopeInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.deleteMemory(
        actor(ctx.session.user.id, input.workspaceId),
        input.memoryId,
      ),
    ),
  purgeExpiredMemories: protectedProcedure
    .input(workspaceScopeInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.agent.purgeExpiredMemories(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  complete: protectedProcedure
    .input(completeAgentInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.services.model) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: modelNotConfiguredMessage(ctx.services.modelProvider),
        });
      }
      let message:
        | Awaited<ReturnType<typeof ctx.services.agent.addMessage>>
        | undefined;
      try {
        for await (const event of streamAgentCompletion(
          ctx.services,
          ctx.session.user.id,
          input,
        )) {
          if (event.type === "complete") message = event.message;
        }
      } catch (error) {
        if (error instanceof WorkspaceQuotaExceededError)
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: error.message,
          });
        throw new TRPCError({
          code: "BAD_GATEWAY",
          cause: error,
          message: modelRequestFailureMessage(ctx.services.modelProvider),
        });
      }
      if (!message) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { message };
    }),
  createDocument: protectedProcedure
    .input(createDocumentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, ...document } = input;
      await enforceQuota(
        ctx.services,
        actor(ctx.session.user.id, workspaceId),
        { documents: 1, storageBytes: document.sizeBytes },
      );
      return ctx.services.agent.createDocument(
        actor(ctx.session.user.id, workspaceId),
        document,
      );
    }),
  startIndex: protectedProcedure
    .input(startIndexInputSchema)
    .mutation(async ({ ctx, input }) => {
      const actorInput = actor(ctx.session.user.id, input.workspaceId);
      const indexRun = await ctx.services.agent.createIndexRun(
        actorInput,
        input.documentId,
        input.provider,
      );
      if (!indexRun) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await dispatchAgentJob(
        ctx.services,
        createAgentJob(
          "index.document",
          {
            documentId: input.documentId,
            indexRunId: indexRun.id,
            userId: ctx.session.user.id,
            workspaceId: input.workspaceId,
          },
          indexRun.id,
        ),
      );
      return indexRun;
    }),
  indexRuns: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listIndexRuns(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  submitFeedback: protectedProcedure
    .input(submitFeedbackInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, ...feedback } = input;
      const result = await ctx.services.agent.submitFeedback(
        actor(ctx.session.user.id, workspaceId),
        feedback,
      );
      if (result.investigation)
        await dispatchAgentJob(
          ctx.services,
          createAgentJob(
            "investigate.feedback",
            {
              feedbackId: result.feedback.id,
              investigationId: result.investigation.id,
              userId: ctx.session.user.id,
              workspaceId,
            },
            result.investigation.id,
          ),
        );
      return result;
    }),
  investigations: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listInvestigations(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  auditLog: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.listAuditLog(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
  usage: protectedProcedure
    .input(workspaceScopeInputSchema)
    .query(({ ctx, input }) =>
      ctx.services.agent.workspaceUsage(
        actor(ctx.session.user.id, input.workspaceId),
      ),
    ),
} satisfies TRPCRouterRecord;
