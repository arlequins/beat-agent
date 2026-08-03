/**
 * Known `SST_STAGE` values for per-stage config maps (schedules, feature flags, …).
 * Personal sandbox names fall back to {@link DEFAULT_DEPLOY_STAGE} in {@link resolveDeployStage}.
 */

import { serverEnv } from "./env-server.js";

export const Stage = {
  PRODUCTION: "production",
  DEVELOP: "develop",
  OFFLINE: "offline",
  TEST: "test",
} as const;

export type Stage = (typeof Stage)[keyof typeof Stage];

export const DEPLOY_STAGES = [
  Stage.PRODUCTION,
  Stage.DEVELOP,
  Stage.OFFLINE,
  Stage.TEST,
] as const;

export type DeployStage = (typeof DEPLOY_STAGES)[number];

/**
 * When `SST_STAGE` is missing or not a known stage (e.g. a personal sandbox name),
 * this key is used for `Record<DeployStage, …>` lookups.
 */
export const DEFAULT_DEPLOY_STAGE: DeployStage = Stage.OFFLINE;

function isDeployStage(value: string): value is DeployStage {
  return (DEPLOY_STAGES as readonly string[]).includes(value);
}

/**
 * Resolves `SST_STAGE` to a {@link DeployStage} key. Unknown or empty → {@link DEFAULT_DEPLOY_STAGE}.
 */
export function resolveDeployStage(): DeployStage {
  const raw = serverEnv.SST_STAGE?.trim().toLowerCase();
  if (raw && isDeployStage(raw)) {
    return raw;
  }
  return DEFAULT_DEPLOY_STAGE;
}

/**
 * Trimmed `SST_STAGE` when set. Preserves personal sandbox names for unique resource prefixes.
 */
export function rawSstStage(): string | undefined {
  const raw = serverEnv.SST_STAGE?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

/** Used when `SST_STAGE` is unset (e.g. SST Lambda name segment). */
export const DEFAULT_RAW_SST_STAGE = Stage.OFFLINE;

/**
 * Segment for resource names: raw stage when set, otherwise {@link DEFAULT_RAW_SST_STAGE}.
 * Prefer {@link resolveDeployStage} for `Record<DeployStage, …>` lookups.
 */
export function sstStageForResourceNames(): string {
  return rawSstStage() ?? DEFAULT_RAW_SST_STAGE;
}
