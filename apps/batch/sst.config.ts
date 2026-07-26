/// <reference path="./sst-globals.d.ts" />

function toPascalCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter((s) => s.length > 0)
    .map(
      (segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
    )
    .join("");
}

/**
 * SST disallows top-level imports in `sst.config.ts` — use dynamic `import()` inside `app` / `run`.
 * `app()` loads {@link serverEnv} / {@link sstAwsRegion} / {@link Stage} from `@arlequins/env` (Zod-validated).
 */
export default $config({
  async app(input) {
    const { serverEnv, sstAwsRegion, Stage } = await import("@arlequins/env");
    const localAwsProfile = serverEnv.SST_AWS_PROFILE?.trim();
    const region = sstAwsRegion();

    return {
      name: "beat-agent-batch",
      removal: input?.stage === Stage.PRODUCTION ? "retain" : "remove",
      protect: input?.stage === Stage.PRODUCTION,
      home: "aws",
      providers: {
        aws: {
          region,
          ...(localAwsProfile ? { profile: localAwsProfile } : {}),
        },
      },
    };
  },
  async run() {
    type HandlerKey = keyof typeof HandlerMap;
    const { vpcFromEnv, Stage, resolveDeployStage, LambdaEnvironment } =
      await import("@arlequins/env");
    const { RegisteredManifests } = await import("./config");
    const { HandlerMap } = await import("./config/handler");
    const { batchTaskRetryPolicyForDeployStage } = await import("./shared");

    const environment = LambdaEnvironment;

    /**
     * Default: pass the Task’s state input into `HandlerInvokeEvent.input`.
     * Override per step in the manifest with a JSONata string or a static object.
     */
    function pipelineStepPayloadInput(step: { input?: unknown }): unknown {
      return step.input === undefined ? "{% $states.input %}" : step.input;
    }

    /**
     * For each item in `RegisteredManifests` (`config/index.ts`): one Step Functions state machine
     * + optional EventBridge schedule + starter Lambda.
     * @see https://sst.dev/docs/component/aws/step-functions/
     *
     * Cron `function` gets `STATE_MACHINE_ARN` and `states:StartExecution` on the pipeline ARN.
     *
     * Pipeline steps: one **`sst.aws.Function` per `handlerKey`** (see `HandlerMap` in `config/handler.ts`).
     * Passing the **same `Function` component** to multiple `lambdaInvoke({ function })` calls can
     * merge Task states in the generated ASL; pass **`function: fn.arn`** so each Task stays a
     * distinct state while invoking the same deployed Lambda.
     *
     * Without VPC env (`SUBNET_IDS` / `SECURITY_GROUP_IDS`), Lambdas are not placed in a VPC.
     *
     * **`task.next(x)` returns `x`, not `task`.** After linking, set `chain = task` so the next
     * iteration prepends another Task. Using `chain = task.next(chain)` drops intermediate steps.
     */
    const deployStage = resolveDeployStage();
    const batchTaskRetryPolicy =
      batchTaskRetryPolicyForDeployStage(deployStage);

    const attach = vpcFromEnv();
    const vpc = attach
      ? {
          privateSubnets: attach.subnetIds,
          securityGroups: attach.securityGroups,
        }
      : undefined;

    const fnByHandlerKey = new Map<HandlerKey, SstAwsFunctionInstance>();
    for (const key of Object.keys(HandlerMap) as HandlerKey[]) {
      const def = HandlerMap[key];
      fnByHandlerKey.set(
        key,
        new sst.aws.Function(`${toPascalCase(String(key))}`, {
          handler: def.handler,
          timeout: def.timeout,
          memory: def.memory,
          retention: def.retention,
          ...(vpc ? { vpc } : {}),
          environment,
        }),
      );
    }

    /** One Lambda for all pipelines; `batchId` is passed in `lambdaInvoke.payload` per state machine. */
    const pipelineFailureFn = new sst.aws.Function(`PipelineFailure`, {
      handler: "lib/functions/common/pipeline-failure.handler",
      timeout: "1 minute",
      memory: "1024 MB",
      retention: deployStage === Stage.PRODUCTION ? "13 months" : "2 weeks",
      ...(vpc ? { vpc } : {}),
      environment,
    });

    for (const manifest of RegisteredManifests) {
      const batchId = manifest.id;
      const name = toPascalCase(batchId);

      /** Top-level SST names must be unique — do not reuse `manifest.id` for both Step Functions and Cron. */
      const failureHandled = sst.aws.StepFunctions.fail({
        name: "PipelineFailureHandled",
      });

      const pipelineFailureAlert = sst.aws.StepFunctions.lambdaInvoke({
        name: "pipelineFailureAlert",
        function: pipelineFailureFn,
        payload: {
          batchId,
          stepFunctionsInput: "{% $states.input %}",
        },
      }).next(failureHandled);

      let chain = sst.aws.StepFunctions.succeed({
        name: "PipelineSucceeded",
      });

      for (const step of [...manifest.steps].reverse()) {
        const handlerFn = fnByHandlerKey.get(step.handlerKey);
        if (!handlerFn) {
          throw new Error(
            `Unknown handlerKey "${step.handlerKey}" (step "${step.stateName}"). Register it in config/handler.ts (HandlerMap)`,
          );
        }
        let task = sst.aws.StepFunctions.lambdaInvoke({
          name: step.stateName,
          function: handlerFn.arn,
          payload: {
            batchId,
            stateName: step.stateName,
            input: pipelineStepPayloadInput(step),
          },
        });

        if (step.withRetry) {
          task = task.retry(batchTaskRetryPolicy);
        }

        task = task.catch(pipelineFailureAlert, {
          errors: ["States.ALL"],
        });

        task.next(chain);
        chain = task;
      }

      const pipeline = new sst.aws.StepFunctions(`Step${name}`, {
        definition: chain,
      });

      new sst.aws.CronV2(`Cron${name}`, {
        schedule: manifest.schedule,
        enabled: manifest.eventBridgeScheduleEnabled,
        function: {
          handler: manifest.starterHandler,
          timeout: "1 minute",
          link: [pipeline],
          environment: {
            STATE_MACHINE_ARN: pipeline.arn,
          },
          permissions: [
            {
              actions: ["states:StartExecution"],
              resources: [pipeline.arn],
            },
          ],
        },
      });
    }
  },
});
