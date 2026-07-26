import { Stage, serverEnv } from "@arlequins/env";

/**
 * Maps `handlerKey` (from `BatchPipelineStep` / `config/step-defs`) to Lambda handler paths.
 * `sst.config.ts` deploys one `sst.aws.Function` per key; Step Tasks use `function: fn.arn` so
 * multiple steps can share the same Lambda without SST merging Task states in the ASL.
 *
 * Paths are relative to the `apps/batch` package root; each module must `export const handler`.
 * Use `path/to/file.handler` (not `.ts`) — SST parses `file.ext` as export name `ext`.
 */
export const HandlerMap = {
  "log-batch-start": {
    handler: "lib/functions/log-batch-start.handler",
    memory: "1024 MB",
    retention:
      serverEnv.SST_STAGE === Stage.PRODUCTION ? "13 months" : "2 weeks",
    timeout: "5 minutes",
  },
  "process-main": {
    handler: "lib/functions/process-main.handler",
    memory: "1024 MB",
    retention:
      serverEnv.SST_STAGE === Stage.PRODUCTION ? "13 months" : "2 weeks",
    timeout: "5 minutes",
  },
} as const;

export type HandlerMap = (typeof HandlerMap)[keyof typeof HandlerMap];

export type HandlerKey = keyof typeof HandlerMap;
