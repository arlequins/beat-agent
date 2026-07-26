# Clean Architecture

This template keeps policy independent from delivery frameworks and providers.
The example content slice is intentionally small, but it demonstrates the same
dependency direction expected from production features.

```text
apps/web -> tRPC router -> application use case -> port <- adapter
apps/api ------^                                      <- Drizzle / S3 / OIDC
apps/batch -> composition -> application use case    <- provider SDKs
```

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain | `packages/*/src/domain` | Business vocabulary and rules with no framework dependencies |
| Application | `packages/*/src/application` | Use cases and outbound ports |
| Adapters | `packages/trpc/src/adaptors`, `packages/db-backbone`, `apps/*/src/adaptors` | Translate databases, object storage, identity, and delivery mechanisms into ports |
| Composition | `packages/trpc/src/composition`, `apps/*/composition` | Select concrete adapters and construct use cases |
| Delivery | tRPC routers, Hono routes, Lambda handlers, React views | Validate and translate requests, then call application behavior |

Dependencies point inward. Domain and application code never imports Drizzle,
Hono, tRPC, AWS SDKs, environment loaders, or concrete logging packages.

Application failures use stable framework-neutral codes from `@arlequins/service`.
Delivery adapters map those contracts to tRPC codes or HTTP status responses;
unknown infrastructure errors remain private and are reported as internal errors.

## Workspace Responsibilities

| Workspace | Responsibility |
| --- | --- |
| `apps/web` | Static Next.js App Router output, browser interactions, and client-side tRPC queries |
| `apps/api` | Hono delivery adapter, HTTP policy, health endpoints, local server, and Lambda entry point |
| `apps/batch` | Step Functions and Lambda delivery adapters plus batch composition roots |
| `packages/trpc` | Typed transport contracts, middleware, infrastructure adapters, and request composition |
| `packages/service` | Framework-independent domain models, application ports, and use cases |
| `packages/db-backbone` | Drizzle adapters, PostgreSQL schema, migrations, and seeds |
| `packages/auth` | Authorization policy, session use cases, and OIDC infrastructure adapters |
| `packages/logger` | Structured logging and telemetry adapters |

## Request Flow

1. A Client Component calls the browser-safe `@arlequins/trpc/client` entry point.
2. The client sends a request to `${NEXT_PUBLIC_API_URL}/api/trpc`.
3. Hono applies request IDs, request guards, security headers, and CORS.
4. The tRPC composition root validates the OIDC session and constructs use cases.
5. A router validates input, applies authorization, and calls one use case.
6. The use case reaches external systems only through injected ports.

Client Components must never import the server entry point `@arlequins/trpc`. Use
`@arlequins/trpc/client`, which contains browser-safe constants, error helpers, and
types.

## Feature Workflow

1. Define domain vocabulary without transport or persistence types.
2. Define an application port for every required external effect.
3. Implement and unit test a use case against port doubles.
4. Implement adapters at the infrastructure boundary.
5. Select adapters in a composition root.
6. Add a thin transport handler that validates input and calls the use case.

Run `pnpm architecture:check` after moving files or adding dependencies. The
check is also part of the root test command and rejects common inward dependency
violations.

## Local Development

For the complete local stack, create the local environment file and run:

```bash
cp .env.localhost.example .env.localhost
pnpm dev:local
```

This starts PostgreSQL, applies migrations and seeds, and runs the local OIDC
provider, API, and web app. The defaults are:

- Web: `http://localhost:3000`
- API: `http://localhost:5000`
- Liveness: `http://localhost:5000/health/live`
- Readiness: `http://localhost:5000/health/ready`
- API explorer: `http://localhost:5000/docs`
- OpenAPI contract: `http://localhost:5000/openapi.json`
- tRPC: `http://localhost:5000/api/trpc`

`API_PORT` changes the local API port. `API_CORS_ORIGINS` accepts a
comma-separated allowlist and defaults to `NEXT_PUBLIC_SITE_URL`.

## Deployment

- `apps/web/sst.config.ts` deploys the static Next.js export to S3 and CloudFront.
- `apps/api/sst.config.ts` selects a Lambda Function URL or API Gateway HTTP API preset.
- Optional VPC variables attach API and batch Lambdas to private resources.

After deploying the API, set `NEXT_PUBLIC_API_URL` to its public URL before
building and deploying the web app.

## Extension Rules

- Add typed application APIs as thin routers in `packages/trpc/src/router`.
- Add ordinary HTTP endpoints as dedicated Hono route modules.
- Put provider implementations in adapter directories and select them in composition roots.
- Add Drizzle tables under `packages/db-backbone/src/schemas` and export them from `schema.ts`.
- Centralize environment parsing in `@arlequins/env` and update examples plus `turbo.json`.
- Commit a migration for every schema change and numbered seeds for data changes.
