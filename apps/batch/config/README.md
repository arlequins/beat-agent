# Adding steps

How to add **pipeline steps** and (optionally) a **new batch**. Step lists live under **`config/step-defs/`** and are registered from **`config/index.ts`** (same pattern as [`sample.ts`](./step-defs/sample.ts)).

## Terms

|              |                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **Step**     | One Step Functions Task. Order = **array order** in `BatchPipelineStep[]`.                                  |
| `stateName`  | Unique in the batch (PascalCase).                                                                           |
| `handlerKey` | Key in [`handler.ts`](./handler.ts) → `HandlerMap`. Add a new entry there only if you need new Lambda code. |

---

## 1. Add steps to an **existing** batch

1. Open **`config/step-defs/<batch>.ts`** (e.g. [`sample.ts`](./step-defs/sample.ts)).
2. Append objects to the exported `BatchPipelineStep[]`:

```ts
{
  stateName: "MyNewStep",
  handlerKey: "process-main",
  useCase: "What this step does (not deployed).",
  withRetry: true, // optional → batchTaskRetryPolicyForDeployStage (develop/production vs default)
  input: { foo: "bar" }, // optional; omit to chain previous output / execution input
},
```

3. Deploy or run `sst dev` so the state machine updates.

No change to `index.ts` if the batch id and import name stay the same.

---

## 2. New batch file from the template

When you need a **new** step file (new pipeline id):

1. **Copy** [`step-defs/_template.ts`](./step-defs/_template.ts) → **`step-defs/<batch-id>.ts`** (e.g. `nightly.ts`).
2. Rename the export (e.g. `nightlySteps`) and fill in **`BatchPipelineStep[]`** (`stateName`, `handlerKey`, `useCase`, optional `withRetry` / `input`).
3. **Wire `config/index.ts`** — mirror the **`sample`** pattern:
   1. **`BatchScheduleId`** — add a constant (e.g. `NIGHTLY: "nightly"`).
   2. **`ScheduleByStage`** — for **each** `DeployStage`, add a row for that id: `cron`, `enabled` ([EventBridge schedules](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)).
   3. **Import** your steps: `import { nightlySteps } from "./step-defs/nightly";`
   4. **`RegisteredManifests`** — append:

      ```ts
      createBatchManifest(
        BatchScheduleId.NIGHTLY,
        ScheduleByStage[stage][BatchScheduleId.NIGHTLY].cron,
        ScheduleByStage[stage][BatchScheduleId.NIGHTLY].enabled,
        nightlySteps,
      ),
      ```

4. Deploy from `apps/batch` (`pnpm sst:deploy` or your root script).

---

## 3. New handler (only if `handlerKey` does not exist yet)

1. Add **`lib/functions/<name>.ts`** with `export const handler` (see [`HandlerInvokeEvent`](../lib/index.ts)).
2. Register a new key in **[`config/handler.ts`](./handler.ts)** → **`HandlerMap`** (path like `lib/functions/<name>.handler`, memory/timeout/retention as for existing entries).
3. Use the new **`handlerKey`** in `step-defs/*.ts`.

---

## Quick checklist

| Step | Action                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Edit or create `config/step-defs/<batch>.ts` (copy from [`_template.ts`](./step-defs/_template.ts) for a new file).                             |
| 2    | For a **new batch id**: extend `BatchScheduleId`, `ScheduleByStage`, import, `RegisteredManifests` in [`index.ts`](./index.ts) like **sample**. |
| 3    | New Lambda code: `lib/functions/*` + [`handler.ts`](./handler.ts) `HandlerMap`.                                                                 |
| 4    | `pnpm sst:deploy` from **`apps/batch`**.                                                                                                        |

**Local try:** `pnpm run` in `apps/batch` (optional `-- --batch <id>`, `-- --step <stateName>`). Full stack: root `pnpm dev:sst`.

## Related

| File                                   | Role                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| [`index.ts`](./index.ts)               | `BatchScheduleId`, `ScheduleByStage`, `RegisteredManifests` |
| [`handler.ts`](./handler.ts)           | `HandlerMap`, `HandlerKey` — one deployed Lambda per key    |
| [`../sst.config.ts`](../sst.config.ts) | Step Functions graph, Lambdas                               |
| [`../lib/index.ts`](../lib/index.ts)   | `HandlerInvokeEvent` (payload shape for handlers)           |
| [`../README.md`](../README.md)         | App layout and scripts                                      |

Repo: [root `README.md`](../../../README.md), [`CHANGELOG.md`](../../../CHANGELOG.md), [`packages/README.md`](../../../packages/README.md).
