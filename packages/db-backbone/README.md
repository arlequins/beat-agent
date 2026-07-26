# `@arlequins/db-backbone`

**Drizzle ORM** + **postgres.js** for this monorepo. Schema under `src/`, Drizzle Kit config in [`drizzle.config.ts`](./drizzle.config.ts).

## Scripts (from repo root)

| Root script                | Package script      | Description                                      |
| -------------------------- | ------------------- | ------------------------------------------------ |
| `pnpm db:setup`            | —                   | Run committed migrations, then pending seeds.    |
| `pnpm db:migrate`          | `migrate`           | Apply committed SQL migrations.                  |
| `pnpm db:seed`             | `seed`              | Run pending TypeScript seeds (see below).         |
| `pnpm db:create-migration` | `create-migration`  | Generate SQL and metadata from schema changes.   |
| `pnpm db:check`            | `check-migrations`  | Validate migration snapshot consistency.         |
| `pnpm db:push`             | `push`              | Push schema directly for local prototyping only. |
| `pnpm db:pull`             | `pull`              | Introspect an existing database into schema.      |
| `pnpm db:studio`           | `studio`            | Open Drizzle Studio.                              |

All use `pnpm with-env` and the **repository root** `.env` (`DATABASE_*`).

## Migration Workflow

SQL migrations and their snapshots are committed under `drizzle/`. The initial migration creates the `sample` schema and `post` table.

After changing files under `src/schemas/`:

```bash
pnpm db:create-migration --name=describe_change
pnpm db:check
```

Review and commit the generated SQL and metadata. Apply migrations and seeds to a configured database with:

```bash
pnpm db:setup
```

Deployments should run `pnpm db:migrate` as an explicit release step before starting code that requires the new schema. Do not run `db:push` against shared or production databases because it bypasses the committed migration history.

## Seeds

- **Entry:** [`scripts/seed.ts`](./scripts/seed.ts) calls `runDrizzleSeeds` from **`@arlequins/shared/seed`** with `scriptDir` set to this package’s `scripts/` directory.
- **Files:** add `scripts/seeds/*.ts` (sorted by filename). Each file must **default-export** an async function `( { tx, stage } ) => void` (see [`@arlequins/types`](../types/README.md)).
- **`stage`:** `resolveDeployStage()` from `@arlequins/env` (`production` \| `develop` \| `offline` \| `test`) — branch in TypeScript when SQL alone is not enough.
- **Sample data safety:** example seeds must call `assertSampleSeedAllowed(rawSstStage(), serverEnv.SEED_SAMPLE_DATA)`. They run automatically only when `SST_STAGE` is exactly `offline` or `test`; set `SEED_SAMPLE_DATA=true` to opt in elsewhere. Reference-data seeds should not use this guard.
- **Ledger:** applied seeds are recorded in **`drizzle.__drizzle_seeds`** (schema/table overridable via `runDrizzleSeeds` options; see [`packages/shared`](../shared/README.md)).
- **Idempotency:** a seed filename runs once. Never edit an applied seed; add a new, higher-numbered file instead.

## Exports

See [`package.json` → `exports`](./package.json): `@arlequins/db-backbone`, `@arlequins/db-backbone/client`, `@arlequins/db-backbone/schema`.
