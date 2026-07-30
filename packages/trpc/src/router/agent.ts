import {
  addMessageInputSchema,
  addWorkspaceMemberInputSchema,
  completeAgentInputSchema,
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
  reviewMemoryInputSchema,
  startIndexInputSchema,
  submitFeedbackInputSchema,
  workspaceScopeInputSchema,
} from "@arlequins/validators";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { streamAgentCompletion } from "../application/agent-completion";
import { runRetrievalEvaluation } from "../application/retrieval-evaluation";
import { protectedProcedure } from "../trpc";

function actor(userId: string, workspaceId: string) {
  return { userId, workspaceId };
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
      const [run, cases] = await Promise.all([
        ctx.services.agent.createEvaluationRun(actorInput, "manual"),
        ctx.services.agent.listEvaluationCases(actorInput),
      ]);
      const results = await runRetrievalEvaluation(ctx.services, {
        cases,
        workspaceId: input.workspaceId,
      });
      return ctx.services.agent.completeEvaluationRun(actorInput, {
        results,
        runId: run.id,
      });
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
      return ctx.services.agent.activeRelease(input.workspaceId);
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
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...message } = input;
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
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...memory } = input;
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
          message: "Local model completion is not configured",
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
        throw new TRPCError({
          code: "BAD_GATEWAY",
          cause: error,
          message: "Local model request failed",
        });
      }
      if (!message) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { message };
    }),
  createDocument: protectedProcedure
    .input(createDocumentInputSchema)
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...document } = input;
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
      if (input.provider !== "local" || !ctx.services.embedding)
        return indexRun;
      try {
        const chunks = await ctx.services.agent.listDocumentChunks(
          actorInput,
          input.documentId,
        );
        const embeddings = await ctx.services.embedding.embed({
          input: chunks.map((chunk) => chunk.content),
        });
        if (embeddings.length !== chunks.length)
          throw new Error("Embedding response did not match document chunks");
        await ctx.services.agent.setChunkEmbeddings(
          actorInput,
          chunks.map((chunk, index) => ({
            embedding: embeddings[index] ?? [],
            id: chunk.id,
          })),
        );
        return ctx.services.agent.finishIndexRun(actorInput, {
          indexRunId: indexRun.id,
          status: "completed",
        });
      } catch (error) {
        return ctx.services.agent.finishIndexRun(actorInput, {
          error:
            error instanceof Error ? error.message : "Local indexing failed",
          indexRunId: indexRun.id,
          status: "failed",
        });
      }
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
    .mutation(({ ctx, input }) => {
      const { workspaceId, ...feedback } = input;
      return ctx.services.agent.submitFeedback(
        actor(ctx.session.user.id, workspaceId),
        feedback,
      );
    }),
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
