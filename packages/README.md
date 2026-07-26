# `packages/` — workspace libraries

Shared **`@arlequins/*`** packages consumed by `apps/*` and each other. Replace the scope when you fork.

| Package | Role |
| --- | --- |
| [`@arlequins/agent-core`](./agent-core) | Provider-neutral agent loop, retrieval context, citations, and stream events |
| [`@arlequins/db-backbone`](./db-backbone/README.md) | Drizzle schema, postgres client, migrations, **TS seeds** (via `@arlequins/shared`) |
| [`@arlequins/env`](./env) | Zod-validated env (`serverEnv`, `clientEnv`), stages, DB URL helpers, VPC from env |
| [`@arlequins/shared`](./shared/README.md) | Cross-cutting utilities (e.g. `runDrizzleSeeds`) |
| [`@arlequins/types`](./types/README.md) | Shared TypeScript types (`SeedContext`, …) |
| `@arlequins/trpc` | tRPC routers and server/client wiring |
| `@arlequins/ui` | Shared React UI |
| `@arlequins/validators` | Zod schemas shared across API and web |
| `@arlequins/auth` | Provider-neutral OIDC access-token verification and sessions |
| `@arlequins/service` | Domain / application services |

Dependency versions for several tools (Drizzle, `postgres`, `tsx`, …) are centralized in the repo root [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) **`catalog:`** and referenced from individual `package.json` files as `"catalog:"`.
