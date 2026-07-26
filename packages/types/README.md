# `@arlequins/types`

Lightweight **shared TypeScript types** for the monorepo. Domain-specific types usually live next to their feature; use this package for types referenced across several workspaces.

## Exports

| Subpath            | Contents                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@arlequins/types`      | Barrel ([`src/index.ts`](./src/index.ts))                                                                                                                                  |
| `@arlequins/types/seed` | [`SeedContext<TTx>`](./src/seed.ts), [`SeedRun<TTx>`](./src/seed.ts), re-exported `DeployStage` — used by Drizzle seed modules under `packages/db-backbone/scripts/seeds/` |

## Seeds

Example signature for a seed file’s default export:

```ts
import type { SeedContext } from "@arlequins/types";
// Derive `tx` from your DB client — see packages/db-backbone `scripts/seeds/*.ts`
export default async function seed({ tx, stage }: SeedContext<YourTx>) { ... }
```
