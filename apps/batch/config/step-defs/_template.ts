/**
 * Template for a new batch step list — **not wired in `index.ts`**.
 *
 * 1. Copy this file to `step-defs/<your-batch-id>.ts` (e.g. `nightly.ts`).
 * 2. Rename the export (e.g. `nightlySteps`) and edit `BatchPipelineStep[]` below.
 * 3. Register the batch in `config/index.ts` (see `config/README.md`).
 *
 * `handlerKey` values must exist in `config/handler.ts` → `HandlerMap`.
 */
import type { BatchPipelineStep } from "../../shared";

/** Rename to `<batchId>Steps` and keep the name in sync with `config/index.ts` imports. */
export const templateSteps: BatchPipelineStep[] = [
  {
    stateName: "FirstStep",
    handlerKey: "log-batch-start",
    useCase: "Human-readable description (not deployed).",
    withRetry: false,
    /** Omit `input` to pass through execution input / previous step output (JSONata default in sst.config). */
    // input: "{% $states.input %}",
  },
  // {
  //   stateName: "SecondStep",
  //   handlerKey: "process-main",
  //   useCase: "…",
  //   withRetry: true,
  //   input: { type: "raw" },
  // },
];
