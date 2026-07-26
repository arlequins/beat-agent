# `apps/batch` — Step Functions + EventBridge cron

(Template **v1.0.1** — see repo-root [`CHANGELOG.md`](../../CHANGELOG.md).)

Runs **batch pipelines** as sequential **AWS Step Functions**, optionally on a schedule via **EventBridge** (`CronV2`). One **starter Lambda** (`shared/entry.ts`) calls `StartExecution` when the schedule fires.

## Requirements

- Use a **repository root** `.env` for DB and shared vars ([`.env.example`](../../.env.example)). Scripts in this package load it via `with-env` (`dotenv -e ../../.env`).
- Run **`pnpm` scripts from `apps/batch`** (or use `pnpm -C apps/batch …` from the repo root).

## Scripts

| Script            | Description                                                                         |
| ----------------- | ----------------------------------------------------------------------------------- |
| `pnpm run`        | Interactive local step runner — optional `-- --batch <id>`, `-- --step <stateName>` |
| `pnpm sst:dev`    | SST dev (Live Lambdas + multiplexer)                                                |
| `pnpm sst:deploy` | Deploy this app’s stack                                                             |
| `pnpm sst:remove` | Remove stack                                                                        |

## What each registered batch includes

`RegisteredManifests` in **`config/index.ts`** lists batches. For each manifest, SST provisions roughly:

| Piece               | Role                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **State machine**   | Runs `steps` in **array order**. Each step invokes the Lambda for `handlerKey` (see **`HandlerMap`** in [`config/handler.ts`](config/handler.ts)).                                                               |
| **Handler Lambdas** | One **deployed function per distinct `handlerKey`** (reused by multiple steps when needed). `sst.config.ts` uses `function: fn.arn` so the ASL keeps a separate Task per step.                                   |
| **Cron (`CronV2`)** | Optional; `schedule` + `enabled` come from **`ScheduleByStage`** for the current deploy stage (`resolveDeployStage()` in `@arlequins/env`).                                                                           |
| **Starter Lambda**  | `shared/entry.ts` — uses env **`STATE_MACHINE_ARN`** (injected for that batch’s Cron).                                                                                                                           |
| **Failure path**    | Retries when `withRetry: true` (`batchTaskRetryPolicyForDeployStage` in `shared/index.ts` — develop/production vs default), then **Catch** → `lib/functions/common/pipeline-failure` → `PipelineFailureHandled`. |

## Directory layout

```text
apps/batch/
  sst.config.ts           # Step Functions definition, Lambdas, Cron
  config/
    index.ts              # BatchScheduleId, ScheduleByStage, RegisteredManifests
    handler.ts            # HandlerMap, HandlerKey (Lambda path per handlerKey)
    README.md             # How to add steps (copy _template, wire index.ts)
    step-defs/            # sample.ts, _template.ts (copy for new batch), …
  shared/
    index.ts              # Types, createBatchManifest, retry policy
    entry.ts              # Scheduled StartExecution
  lib/
    index.ts              # HandlerInvokeEvent
    functions/            # Pipeline handlers + common/pipeline-failure
    usecases/
  scripts/                # dev.ts, run-pipeline.ts
```

## Documentation

| Doc                                              | Contents                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| [**`config/README.md`**](config/README.md)       | **Add steps** — `step-defs/`, [`handler.ts`](config/handler.ts) for new `handlerKey`, [`index.ts`](config/index.ts) like `sample` |
| [Repository `README.md`](../../README.md)        | Monorepo tech stack, SST / deploy overview                                                                                        |
| [`packages/README.md`](../../packages/README.md) | Workspace packages (`@arlequins/db-backbone`, `@arlequins/shared`, …)                                                                       |
| [`CHANGELOG.md`](../../CHANGELOG.md)             | Release notes                                                                                                                     |

For **local debugging** without full SST, see `scripts/dev.ts` and `scripts/run-pipeline.ts`.
