/**
 * Batch app wiring: schedule keys, per-stage cron/enabled flags, and the list of manifests
 * consumed by `sst.config.ts`.
 *
 * Step arrays live in `config/step-defs/` and are passed to `createBatchManifest` from `../shared`.
 *
 * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html
 */

import type { DeployStage } from "@arlequins/env";
import { resolveDeployStage } from "@arlequins/env";

import type { BatchManifest } from "../shared";
import { createBatchManifest } from "../shared";
import {
  documentIngestionSteps,
  feedbackInvestigationSteps,
  weeklyEvaluationSteps,
} from "./step-defs/agent";
import { sampleSteps } from "./step-defs/sample";

export type BatchScheduleId =
  (typeof BatchScheduleId)[keyof typeof BatchScheduleId];

/** Extend when adding a batch: add a row in `ScheduleByStage` for every `DeployStage`. */
export const BatchScheduleId = {
  DOCUMENT_INGESTION: "document-ingestion",
  FEEDBACK_INVESTIGATION: "feedback-investigation",
  SAMPLE: "sample",
  WEEKLY_EVALUATION: "weekly-evaluation",
} as const;

/** Every batch here gets its own Step Functions + Cron + starter Lambda. Order does not matter. */
const stage = resolveDeployStage();

/**
 * Per-stage cron/rate per batch id (`sample`, …). Add a column when you add a batch folder.
 */
export const ScheduleByStage: Record<
  DeployStage,
  Record<BatchScheduleId, { cron: string; enabled: boolean }>
> = {
  production: {
    [BatchScheduleId.DOCUMENT_INGESTION]: {
      cron: "cron(0 3 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.FEEDBACK_INVESTIGATION]: {
      cron: "cron(0 4 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.SAMPLE]: {
      cron: "cron(0 2 * * ? *)",
      enabled: true,
    },
    [BatchScheduleId.WEEKLY_EVALUATION]: {
      cron: "cron(0 5 ? * MON *)",
      enabled: true,
    },
  },
  develop: {
    [BatchScheduleId.DOCUMENT_INGESTION]: {
      cron: "cron(0 3 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.FEEDBACK_INVESTIGATION]: {
      cron: "cron(0 4 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.SAMPLE]: {
      cron: "cron(0 2 * * ? *)",
      enabled: true,
    },
    [BatchScheduleId.WEEKLY_EVALUATION]: {
      cron: "cron(0 5 ? * MON *)",
      enabled: false,
    },
  },
  offline: {
    [BatchScheduleId.DOCUMENT_INGESTION]: {
      cron: "cron(0 3 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.FEEDBACK_INVESTIGATION]: {
      cron: "cron(0 4 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.SAMPLE]: {
      cron: "cron(0 2 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.WEEKLY_EVALUATION]: {
      cron: "cron(0 5 ? * MON *)",
      enabled: false,
    },
  },
  test: {
    [BatchScheduleId.DOCUMENT_INGESTION]: {
      cron: "cron(0 3 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.FEEDBACK_INVESTIGATION]: {
      cron: "cron(0 4 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.SAMPLE]: {
      cron: "cron(0 2 * * ? *)",
      enabled: false,
    },
    [BatchScheduleId.WEEKLY_EVALUATION]: {
      cron: "cron(0 5 ? * MON *)",
      enabled: false,
    },
  },
};

/** Every batch here gets its own Step Functions + Cron + starter Lambda. Order does not matter. */
export const RegisteredManifests: BatchManifest[] = [
  createBatchManifest(
    BatchScheduleId.DOCUMENT_INGESTION,
    ScheduleByStage[stage][BatchScheduleId.DOCUMENT_INGESTION].cron,
    ScheduleByStage[stage][BatchScheduleId.DOCUMENT_INGESTION].enabled,
    documentIngestionSteps,
  ),
  createBatchManifest(
    BatchScheduleId.FEEDBACK_INVESTIGATION,
    ScheduleByStage[stage][BatchScheduleId.FEEDBACK_INVESTIGATION].cron,
    ScheduleByStage[stage][BatchScheduleId.FEEDBACK_INVESTIGATION].enabled,
    feedbackInvestigationSteps,
  ),
  createBatchManifest(
    BatchScheduleId.SAMPLE,
    ScheduleByStage[stage][BatchScheduleId.SAMPLE].cron,
    ScheduleByStage[stage][BatchScheduleId.SAMPLE].enabled,
    sampleSteps,
  ),
  createBatchManifest(
    BatchScheduleId.WEEKLY_EVALUATION,
    ScheduleByStage[stage][BatchScheduleId.WEEKLY_EVALUATION].cron,
    ScheduleByStage[stage][BatchScheduleId.WEEKLY_EVALUATION].enabled,
    weeklyEvaluationSteps,
  ),
];
