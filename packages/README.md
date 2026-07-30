# `packages/` — workspace libraries

Shared **`@arlequins/*`** packages consumed by the Beat applications.

| Package | Role |
| --- | --- |
| [`@arlequins/agent-core`](./agent-core) | Provider-neutral agent loop, retrieval context, citations, and stream events |
| [`@arlequins/env`](./env) | Zod-validated environment, stages, and optional existing-VPC parsing |
| `@arlequins/trpc` | tRPC routers and server/client wiring |
| `@arlequins/ui` | Shared React UI |
| `@arlequins/validators` | Zod schemas shared across API and web |
| `@arlequins/auth` | Provider-neutral OIDC access-token verification and sessions |
| `@arlequins/service` | Domain / application services |

Dependency versions are centralized in the root [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) **`catalog:`** and referenced from package manifests as `"catalog:"`.
