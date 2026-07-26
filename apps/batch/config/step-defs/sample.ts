import type { BatchPipelineStep } from "../../shared";

/** Steps for `BatchScheduleId.SAMPLE` — imported by `RegisteredManifests` in `config/index.ts`. */
export const sampleSteps: BatchPipelineStep[] = [
  {
    stateName: "LogStart",
    handlerKey: "log-batch-start",
    useCase:
      "First step: RUNNING / audit / idempotency (like a “logger running” task).",
    withRetry: false,
    input: "{% $states.input %}",
  },
  {
    stateName: "ProcessMain",
    handlerKey: "process-main",
    useCase:
      "Main work for this batch. Add `lib/functions/<name>.ts` and register `handlerKey` in `config/handler.ts` (HandlerMap).",
    withRetry: true,
    input: {
      type: "raw",
    },
  },
  {
    stateName: "ProcessMain2",
    handlerKey: "process-main",
    useCase:
      "Main work for this batch. Add `lib/functions/<name>.ts` and register `handlerKey` in `config/handler.ts` (HandlerMap).",
    withRetry: true,
    input: {
      type: "db-query",
    },
  },
];
