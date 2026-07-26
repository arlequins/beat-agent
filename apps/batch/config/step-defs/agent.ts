import type { BatchPipelineStep } from "../../shared";

/**
 * Definitions are deliberately provider-neutral commands. The deployed host binds
 * the `process-main` adapter to its document parser, vector provider, and evaluator.
 * They can also be started manually with a validated `{ indexRunId }` or `{ feedbackId }`.
 */
export const documentIngestionSteps: BatchPipelineStep[] = [
  {
    stateName: "MarkIndexRunRunning",
    handlerKey: "log-batch-start",
    useCase: "Record the accepted index run before any external side effect.",
    input: "{% $states.input %}",
  },
  {
    stateName: "ExtractAndChunk",
    handlerKey: "process-main",
    useCase: "Read the authorized document source and produce bounded chunks.",
    withRetry: true,
    input: { type: "raw" },
  },
  {
    stateName: "UpsertVectors",
    handlerKey: "process-main",
    useCase:
      "Write chunks through the selected VectorIndexPort and persist vector record ids.",
    withRetry: true,
    input: { type: "raw" },
  },
  {
    stateName: "CompleteIndexRun",
    handlerKey: "process-main",
    useCase:
      "Atomically mark the document and index run complete after vector writes succeed.",
    withRetry: true,
    input: { type: "db-query" },
  },
];

export const feedbackInvestigationSteps: BatchPipelineStep[] = [
  {
    stateName: "MarkInvestigationRunning",
    handlerKey: "log-batch-start",
    useCase: "Claim one queued investigation.",
    input: "{% $states.input %}",
  },
  {
    stateName: "CollectEvidence",
    handlerKey: "process-main",
    useCase:
      "Load the feedback, answer, citations, and authorized source chunks.",
    withRetry: true,
    input: { type: "db-query" },
  },
  {
    stateName: "EvaluateFinding",
    handlerKey: "process-main",
    useCase:
      "Produce a reviewable finding; it must not mutate active knowledge.",
    withRetry: true,
    input: { type: "raw" },
  },
  {
    stateName: "CompleteInvestigation",
    handlerKey: "process-main",
    useCase: "Persist the finding for human review.",
    withRetry: true,
    input: { type: "db-query" },
  },
];

export const weeklyEvaluationSteps: BatchPipelineStep[] = [
  {
    stateName: "SelectEvaluationSet",
    handlerKey: "log-batch-start",
    useCase:
      "Snapshot reviewed investigations and approved regressions for the week.",
    input: "{% $states.input %}",
  },
  {
    stateName: "RunEvaluation",
    handlerKey: "process-main",
    useCase:
      "Execute the provider-neutral evaluation suite and capture metrics.",
    withRetry: true,
    input: { type: "raw" },
  },
  {
    stateName: "PublishEvaluationRun",
    handlerKey: "process-main",
    useCase: "Persist an auditable result; no automatic knowledge promotion.",
    withRetry: true,
    input: { type: "db-query" },
  },
];
