# Changelog

This project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.0](https://github.com/arlequins/beat-agent/compare/v0.3.0...v0.4.0) (2026-08-04)


### Features

* establish Beat local assistant ([#1](https://github.com/arlequins/beat-agent/issues/1)) ([a2be7ec](https://github.com/arlequins/beat-agent/commit/a2be7ec1ae39588763f4ebfc1ccbce84c156a2b3))

## [0.3.0](https://github.com/arlequins/beat-agent/compare/v0.2.0...v0.3.0) (2026-07-26)


### Features

* complete local-first agent platform template ([cc74804](https://github.com/arlequins/beat-agent/commit/cc74804bff42c35686ac2b2aaed3af443ecc5270))

## [0.2.0](https://github.com/arlequins/beat-agent/compare/v0.1.0...v0.2.0) (2026-07-26)


### Features

* complete local RAG operations ([2c36958](https://github.com/arlequins/beat-agent/commit/2c36958d720d9604bdc7f581805714c09973ddd0))


### Bug Fixes

* document local embedding configuration ([1d512cf](https://github.com/arlequins/beat-agent/commit/1d512cf8369ddef54adfd1dd91f3f7bb46dac6af))

## [0.1.0](https://github.com/arlequins/beat-agent/compare/v0.0.1...v0.1.0) (2026-07-26)


### Features

* manage workspace documents and citations ([988b380](https://github.com/arlequins/beat-agent/commit/988b380b60c02b5af46e7a1a7945fb8471f054ae))


### Bug Fixes

* harden local agent feedback and e2e isolation ([56f6c25](https://github.com/arlequins/beat-agent/commit/56f6c25e3b795a12d53a7b87d33b1e019e22e93a))
* keep auth in minimal agent template ([4e6a74e](https://github.com/arlequins/beat-agent/commit/4e6a74e7cc80e747b10d7ce4534ef8571da91aba))
* make tag publishing idempotent ([54c774e](https://github.com/arlequins/beat-agent/commit/54c774ed4083b948ab09297814726ec23e9ff3ea))
* qualify required auth feature matrix ([389aa06](https://github.com/arlequins/beat-agent/commit/389aa06afd9dc7e3ae5978e342ce1927b7c80634))
* support generated agent contract extensions ([a5e7ec3](https://github.com/arlequins/beat-agent/commit/a5e7ec38e0971bda3eb75aeb58deaa4cf89249c5))

## [0.0.1] - 2026-07-26

### Added

- Initial generic conversational-agent template with workspace-scoped chat,
  PostgreSQL persistence, local Ollama streaming, local text-document RAG, and
  durable citations.
- Provider-neutral model, memory, knowledge, vector, and workflow ports, plus
  optional SST definitions for ingestion, feedback investigation, and weekly
  evaluation.
- CI, security scanning, preview/production SST deployment workflows, and
  Release Please automation gated on successful CI.

## [1.1.2](https://github.com/arlequins/beat-agent/compare/v1.1.1...v1.1.2) (2026-07-23)


### Bug Fixes

* **ci:** upgrade release action to Node 24 ([#52](https://github.com/arlequins/beat-agent/issues/52)) ([07cba06](https://github.com/arlequins/beat-agent/commit/07cba06ca9b65877d6e378f16227c5550c2496c5))

## [1.1.1](https://github.com/arlequins/beat-agent/compare/v1.1.0...v1.1.1) (2026-07-23)


### Bug Fixes

* **ci:** align release tag format ([#50](https://github.com/arlequins/beat-agent/issues/50)) ([31db2f9](https://github.com/arlequins/beat-agent/commit/31db2f9f257c16137be05446eb7fa2b395138923))
* **ci:** enable releases with GitHub token ([#48](https://github.com/arlequins/beat-agent/issues/48)) ([c6ae828](https://github.com/arlequins/beat-agent/commit/c6ae82812d4a20ec55758d67254f73aa01172857))
* **tooling:** redact secret synchronization logs ([#46](https://github.com/arlequins/beat-agent/issues/46)) ([bd52104](https://github.com/arlequins/beat-agent/commit/bd5210452d889ae3382326d6d21bcfdd6bdfdf16))

## [1.1.0] - 2026-07-22

### Added

- Interactive OpenAPI documentation with an API request explorer and browser E2E coverage.
- Clean Architecture feature generator for domain, port, use-case, adaptor, composition, router, and test scaffolding.
- Provider-neutral asynchronous messaging ports with in-memory and AWS adaptors.
- Retry-safe mutation support backed by idempotency keys and optimistic content versioning.
- Resilient S3 cache policies for stale reads, retry backoff, request coalescing, and observability hooks.
- Isolated database integration tests powered by Testcontainers.
- Responsive Playwright visual regression coverage for desktop and mobile layouts.
- Template doctor and feature-matrix checks for generated project qualification.

### Changed

- Standardized application errors across the service, tRPC, and Hono API layers.
- Enforced dead-code and dependency analysis in local tooling and CI.
- Expanded CI to validate database migrations, generated presets, architecture boundaries, Storybook, and browser workflows.

### Fixed

- Made template environment-file updates atomic.
- Stabilized cross-platform visual snapshots with fixed viewport baselines and platform rendering tolerance.

## [1.0.1] - 2026-04-10

### Added

- **`@arlequins/shared`** — cross-cutting helpers; exports `runDrizzleSeeds` from `@arlequins/shared/seed` for TypeScript-based Drizzle seeds (ledger table, `SST_STAGE` via `resolveDeployStage()`).
- **`@arlequins/types`** — shared types including `SeedContext` / `SeedRun` for seed modules.

### Changed

- **`@arlequins/db-backbone`** — `scripts/seed.ts` delegates to `runDrizzleSeeds`; seed files live under `packages/db-backbone/scripts/seeds/*.ts` (default export). Drizzle-related dependencies use **`catalog:`** entries.
- **Root `pnpm-workspace.yaml`** — `catalog` lists `drizzle-orm`, `drizzle-zod`, `drizzle-kit`, `postgres`, and `tsx` for consistent versions across packages.

### Docs

- Root [`README.md`](./README.md): database seed command, packages index link, pnpm catalog note.
- [`packages/README.md`](./packages/README.md), [`packages/db-backbone/README.md`](./packages/db-backbone/README.md), [`packages/shared/README.md`](./packages/shared/README.md), [`packages/types/README.md`](./packages/types/README.md).

## [1.0.0] - 2026-04-09

### Summary

- **Initial stable release.** Inspired by T3 / [create-t3-turbo](https://github.com/t3-oss/create-t3-turbo), but AWS deployment, batch jobs, and shared packages diverge significantly (see README _How this differs from a stock T3 template_).

### Included

- **Apps:** `apps/web` (Next.js static export + tRPC client), `apps/api` (TanStack Start + tRPC + Nitro on AWS), `apps/batch` (SST Step Functions + Lambda + EventBridge Cron).
- **Shared packages:** `@arlequins/db-backbone`, `@arlequins/trpc`, `@arlequins/ui`, `@arlequins/env`, `@arlequins/validators`, `@arlequins/types`, `@arlequins/shared`, etc.
- **Infrastructure:** SST (Ion) on AWS; `tooling/sst-bootstrap` for Secrets Manager ↔ root `.env` sync.
- **Tooling:** Turborepo, pnpm workspaces, and Biome.

### Docs

- Root README updated with tech stack, T3 divergence note, and repository layout.
