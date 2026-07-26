/**
 * SST loads real globals from `.sst/platform/config.d.ts` after `pnpm sst:install`.
 * This file keeps `sst.config.ts` typechecking in a fresh clone before that step.
 */

/** Available inside `$config` `run()` — app id from `app()` and active stage (e.g. `pnpm sst deploy --stage`). */
declare const $app: {
  name: string;
  stage: string;
};

type SstAppConfig = {
  name: string;
  removal: string;
  protect: boolean;
  home: string;
  providers?: {
    aws?: { profile?: string; region?: string } | string | boolean;
  };
};

declare const $config: (config: {
  app: (input?: { stage?: string }) => SstAppConfig | Promise<SstAppConfig>;
  run: () => void | Promise<void>;
}) => unknown;

type SfnState = {
  next: (other: SfnState) => SfnState;
};

/** Task from `lambdaInvoke`: `retry` → `catch` → `next` (success path). */
type SfnTaskState = SfnState & {
  retry: (args: Record<string, unknown>) => SfnTaskState;
  catch: (next: SfnState, args?: { errors?: string[] }) => SfnTaskState;
};

type StepFunctionsCtor = new (
  name: string,
  args: {
    definition: SfnState;
    type?: "standard" | "express";
    logging?: unknown;
  },
) => { arn: unknown };

/** @see https://sst.dev/docs/component/aws/step-functions/fail/#failargs */
type StepFunctionsFailArgs = {
  name: string;
  error?: unknown;
  cause?: unknown;
  output?: unknown;
  assign?: Record<string, unknown>;
};

type StepFunctionsStatics = {
  pass: (args: { name: string; output?: unknown }) => SfnState;
  succeed: (args: { name: string }) => SfnState;
  /** Terminal Fail state — e.g. after a Catch path’s alert Lambda. */
  fail: (args: StepFunctionsFailArgs) => SfnState;
  lambdaInvoke: (args: {
    name: string;
    function: unknown;
    payload?: Record<string, unknown> | string;
  }) => SfnTaskState;
};

/** Minimal shape for `new sst.aws.Function` — extend when using more properties in `sst.config.ts`. */
type SstAwsFunctionInstance = {
  arn: unknown;
};

declare const sst: {
  aws: {
    Function: new (
      name: string,
      args?: Record<string, unknown>,
    ) => SstAwsFunctionInstance;
    CronV2: new (name: string, args?: Record<string, unknown>) => unknown;
    StepFunctions: StepFunctionsCtor & StepFunctionsStatics;
  };
};
