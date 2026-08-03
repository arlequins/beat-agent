# AI Memory

This page is a durable context note for AI agents working in Beat Agent.

## Repository Identity

- Beat Agent is Arlequin's personal assistant, built as a pnpm and Turborepo monorepo.
- The web app is a PWA; the API runs locally in Node and in AWS Lambda.
- Beat's production source of truth is a private, versioned S3 bucket.
- Local development uses MinIO, the development OIDC mock, and Ollama.
- Production authentication uses the Beat project's OIDC provider.
- PostgreSQL and Aurora are not part of this repository's runtime architecture.

## Package Layout

- `apps/web`: Next.js PWA and browser-side tRPC client.
- `apps/api`: Hono API, local server, Lambda entry point, and SST infrastructure.
- `packages/trpc`: typed transport, composition, S3 repositories, retrieval, and model adapters.
- `packages/service`: framework-neutral domain and application services.
- `packages/agent-*`: provider-neutral agent behavior plus Ollama, Bedrock, and vector adapters.
- `packages/auth`: OIDC token verification and authorization policy.
- `packages/env`: validated environment variables.
- `packages/ui`: shared React UI.

## Architecture Memory

- Immutable events, document blobs, and reviewed release snapshots are append-only S3 objects.
- Mutable heads, leases, and active-release pointers use ETag conditional writes.
- Reads remain on the previous complete release until a new manifest is complete and activated.
- A per-user lease prevents concurrent personal-assistant work; busy responses include an estimated completion time when known.
- Sensitive conversation and counseling context may be retained for the authenticated owner, with audit events and tombstones.
- Bedrock is opt-in and receives permission only for the configured model ARN.
- The local OIDC mock must never be deployed as a production identity provider.

## Verification

Run `pnpm check`, `pnpm lint:dead-code`, `pnpm typecheck`, `pnpm test`,
`pnpm test:coverage`, `pnpm test:sst`, `pnpm build`, and `pnpm test:e2e` before
merging architecture changes.
