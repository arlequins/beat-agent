import type { AsyncMessage } from "@arlequins/service";

import type { TRPCServices } from "../context";
import { runRetrievalEvaluation } from "./retrieval-evaluation";

export const AGENT_JOB_NAMES = [
  "evaluate.retrieval",
  "extract.document",
  "index.document",
  "investigate.feedback",
] as const;

export type AgentJobName = (typeof AGENT_JOB_NAMES)[number];

type JobPayload = {
  documentId?: string;
  evaluationRunId?: string;
  feedbackId?: string;
  indexRunId?: string;
  investigationId?: string;
  userId: string;
  workspaceId: string;
};

export type AgentAsyncJob = AsyncMessage<JobPayload> & {
  name: AgentJobName;
};

export function createAgentJob(
  name: AgentJobName,
  payload: JobPayload,
  id: string,
): AgentAsyncJob {
  return {
    id,
    name,
    occurredAt: new Date().toISOString(),
    payload,
    version: 1,
  };
}

export function parseAgentJob(value: unknown): AgentAsyncJob {
  if (!value || typeof value !== "object")
    throw new Error("Agent job must be an object");
  const candidate = value as Partial<AgentAsyncJob>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.occurredAt !== "string" ||
    candidate.version !== 1 ||
    !AGENT_JOB_NAMES.includes(candidate.name as AgentJobName) ||
    !candidate.payload ||
    typeof candidate.payload.userId !== "string" ||
    typeof candidate.payload.workspaceId !== "string"
  )
    throw new Error("Agent job has an invalid envelope");
  return candidate as AgentAsyncJob;
}

export async function dispatchAgentJob(
  services: TRPCServices,
  job: AgentAsyncJob,
) {
  if (!services.jobQueue) return processAgentJob(services, job);
  await services.jobQueue.enqueue(job, {
    deduplicationId: job.id,
    groupId: job.payload.userId,
  });
}

export async function processAgentJob(
  services: TRPCServices,
  job: AgentAsyncJob,
) {
  const actor = {
    userId: job.payload.userId,
    workspaceId: job.payload.workspaceId,
  };
  if (job.name === "index.document" || job.name === "extract.document") {
    if (!job.payload.indexRunId || !job.payload.documentId)
      throw new Error("Index job payload is incomplete");
    const claim = await services.agent.claimIndexRun(
      actor,
      job.payload.indexRunId,
    );
    if (!claim.acquired) return claim.run;
    if (job.name === "extract.document") {
      if (!services.documentSource)
        throw new Error("Document source is not configured");
      const documents = await services.agent.listDocuments(actor);
      const document = documents.find(
        (item) => item.id === job.payload.documentId,
      );
      if (!document) throw new Error("Document was not found for extraction");
      const bytes = await services.documentSource.read({
        sourceUri: document.sourceUri,
        workspaceId: actor.workspaceId,
      });
      await services.documentSecurity.scan({
        bytes,
        contentType: document.contentType,
        filename: document.filename,
      });
      const extracted = await services.documentExtraction.extract({
        bytes,
        contentType: document.contentType,
        filename: document.filename,
      });
      await services.agent.completeDocumentExtraction(actor, {
        documentId: document.id,
        text: extracted.text,
        warnings: extracted.warnings,
      });
    }
    const chunks = await services.agent.listDocumentChunks(
      actor,
      job.payload.documentId,
    );
    if (services.embedding && chunks.length) {
      const embeddings = await services.embedding.embed({
        input: chunks.map((chunk) => chunk.content),
      });
      if (embeddings.length !== chunks.length)
        throw new Error("Embedding response did not match document chunks");
      await services.agent.setChunkEmbeddings(
        actor,
        chunks.map((chunk, index) => ({
          embedding: embeddings[index] ?? [],
          id: chunk.id,
        })),
      );
    }
    return services.agent.finishIndexRun(actor, {
      indexRunId: job.payload.indexRunId,
      status: "completed",
    });
  }

  if (job.name === "investigate.feedback") {
    if (!job.payload.investigationId || !job.payload.feedbackId)
      throw new Error("Investigation job payload is incomplete");
    const claim = await services.agent.claimInvestigation(
      actor,
      job.payload.investigationId,
    );
    if (!claim.acquired) return claim.investigation;
    return services.agent.finishInvestigation(actor, {
      investigationId: job.payload.investigationId,
      status: "completed",
    });
  }

  if (!job.payload.evaluationRunId)
    throw new Error("Evaluation job payload is incomplete");
  const claim = await services.agent.claimEvaluationRun(
    actor,
    job.payload.evaluationRunId,
  );
  if (!claim.acquired) return claim.run;
  const cases = await services.agent.listEvaluationCases(actor);
  const results = await runRetrievalEvaluation(services, {
    cases,
    workspaceId: actor.workspaceId,
  });
  return services.agent.completeEvaluationRun(actor, {
    results,
    runId: job.payload.evaluationRunId,
  });
}

export async function failAgentJob(
  services: TRPCServices,
  job: AgentAsyncJob,
  error: unknown,
) {
  const actor = {
    userId: job.payload.userId,
    workspaceId: job.payload.workspaceId,
  };
  const message = error instanceof Error ? error.message : "Agent job failed";
  if (
    (job.name === "index.document" || job.name === "extract.document") &&
    job.payload.indexRunId
  )
    return services.agent.finishIndexRun(actor, {
      error: message,
      indexRunId: job.payload.indexRunId,
      status: "failed",
    });
  if (job.name === "investigate.feedback" && job.payload.investigationId)
    return services.agent.finishInvestigation(actor, {
      error: message,
      investigationId: job.payload.investigationId,
      status: "failed",
    });
  if (job.name === "evaluate.retrieval" && job.payload.evaluationRunId)
    return services.agent.failEvaluationRun(actor, {
      error: message,
      runId: job.payload.evaluationRunId,
    });
}
