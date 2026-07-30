# Beat

Beat은 Arlequin이 맥에서 로컬로 실행하는 개인 비서입니다. 대화 이력,
검토된 기억, 개인 문서를 바탕으로 답하며, 문서 근거는 인용으로 확인할 수
있습니다. 반성적 대화는 지원하지만 의료·정신건강 진단이나 위기 대응 서비스를
대체하지 않습니다.

현재 v0.3.0 `template-agent` 기반의 첫 번째 제품화 단계입니다. 로컬 기본값은
PostgreSQL, OIDC mock, Ollama이며 클라우드 배포는 실행하지 않습니다.

블로그 `arlequins/beat`에는 Beat 위젯을 별도 PR로 연결합니다. 인증된 사용자의
대화는 이 저장소의 API만 사용하며, 블로그 페이지 본문은 명시적으로 등록하거나
공개 문서로 승인된 경우에만 검색 근거로 사용합니다. 자세한 경계는
[Beat 제품 방향](./docs/beat-product.md)을 참고하세요.

## 로컬에서 시작하기

```bash
pnpm install
pnpm agent:setup
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
pnpm dev:local
```

`http://localhost:3000`에서 **Beat 시작하기**를 선택하고, 로컬 OIDC 화면에서
임의의 사용자 이름과 비밀번호로 로그인하세요. 첫 워크스페이스와 대화를 만든
뒤 바로 질문할 수 있습니다.

---

A provider-neutral conversational AI-agent template built on
`template-t3-turbo-sst`. It starts locally with PostgreSQL and the included OIDC
mock, then adds AWS services only when a feature needs them.

## Cost-aware defaults

- Local PostgreSQL and a local model are the default development path.
- Aurora PostgreSQL is an optional SST application and is disabled by default.
- Do not create a NAT Gateway, always-on container, or production database in a
  personal sandbox without an explicit decision.
- Treat Amazon Bedrock inference as usage-priced, even when the surrounding AWS
  infrastructure is within a free-tier allowance.

See [Optional Aurora PostgreSQL with SST](./docs/aurora-sst.md).

**v1.0.1** - A reusable pnpm monorepo template for a client-only Next.js
frontend, Hono and tRPC API, Drizzle PostgreSQL persistence, OIDC authentication,
and optional SST batch and deployment infrastructure.

## Stack

| Area | Technology |
| --- | --- |
| Workspace | pnpm catalogs, Turborepo, TypeScript, Biome |
| Web | Next.js App Router, client-only static export, React, Tailwind CSS |
| API | Hono, tRPC, local Node.js server, AWS Lambda deployment |
| Database | PostgreSQL, Drizzle ORM, migrations, and idempotent seeds |
| Authentication | OpenID Connect Authorization Code with PKCE and JWT validation |
| Infrastructure | SST Ion, CloudFront, Lambda, Step Functions, EventBridge |
| Testing | Vitest, PostgreSQL integration tests, Playwright, accessibility checks |

Internal packages use the placeholder scope `@arlequins/*`. The initializer replaces
it when creating a project.

## Requirements

- Node.js and pnpm versions matching [`package.json`](./package.json)
- Docker for local PostgreSQL and end-to-end tests
- AWS credentials only for cloud-backed SST commands

Use the Node.js version in [`.nvmrc`](./.nvmrc). The preinstall check reports an
actionable error when the runtime does not match.

## Create a Project

Preview repository-wide replacements before applying them:

```bash
pnpm template:init -- --name customer-portal --display-name "Customer Portal" --scope @company --domain customer.example.org --dry-run
pnpm template:init -- --name customer-portal --display-name "Customer Portal" --scope @company --domain customer.example.org --description "Customer portal"
pnpm install
```

The initializer updates package names, SST application names, repository
metadata, and example domains. It refuses to modify a dirty worktree unless
`--force` is provided.

`--display-name` controls user-facing branding and defaults to a title-cased
version of `--name`. The generated `template.features.json` records the project
identity, selected preset, and enabled optional features for later tooling.

The default preset retains the complete template. For a smaller starting point:

```bash
pnpm template:init -- --name customer-portal --scope @company --domain customer.example.org --preset minimal --prune
pnpm install
```

The minimal preset keeps `web + api + trpc + db`. Use `--features` to select
`auth`, `batch`, `sst`, or `example-ui`. `--prune` physically removes omitted
modules and the lockfile; the next install creates a lockfile for the selected
composition.

## Local Quickstart

Start PostgreSQL, apply migrations and seeds, and launch the local OIDC provider,
API, and web app:

```bash
pnpm install
pnpm agent:setup
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
pnpm agent:demo:check
pnpm dev:local
```

Open `http://localhost:3000`. The development identity provider accepts any
non-empty username and password. After signing in, create a workspace, start a
conversation, optionally register text knowledge, then send a question. The
default local model is `qwen2.5:3b`; run `ollama serve` if the Ollama service is
not already running. `nomic-embed-text` enables semantic document retrieval;
when it is unavailable, the application safely falls back to keyword search.
Alternatively run `docker compose --profile ollama up -d ollama` (native Ollama
is generally faster on Apple Silicon). PostgreSQL uses host port `55433` by default. Stop the
database with `pnpm db:stop`.

The API endpoints are:

- Liveness: `http://localhost:5000/health/live`
- PostgreSQL-backed readiness: `http://localhost:5000/health/ready`
- Interactive API explorer: `http://localhost:5000/docs`
- OpenAPI document: `http://localhost:5000/openapi.json`
- tRPC: `http://localhost:5000/api/trpc`

See [Application Architecture](./docs/architecture.md) for request flow and
workspace boundaries, and [OpenID Connect Authentication](./docs/authentication.md)
for provider configuration.

## Common Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev:local` | Start the complete local application stack. |
| `pnpm agent:setup` | Create `.env.localhost` without overwriting an existing local configuration. |
| `pnpm agent:demo:check` | Verify the local Ollama chat and embedding models without downloading them. |
| `pnpm dev` | Run development tasks when dependencies are already available. |
| `pnpm dev:sst` | Run web, API, and batch through cloud-backed SST development. |
| `pnpm check` / `pnpm check:fix` | Check or fix Biome formatting and lint rules. |
| `pnpm typecheck` | Typecheck every workspace. |
| `pnpm test` | Run unit and contract tests. |
| `pnpm test:coverage` | Run unit tests and enforce the 75% aggregate coverage gate. |
| `pnpm test:e2e` | Run isolated PostgreSQL and browser end-to-end tests. |
| `pnpm db:setup` | Apply committed migrations and pending seeds. |
| `pnpm turbo gen` | Generate an application, package, or tRPC domain. |
| `pnpm gen:feature` | Generate a clean-architecture command or query slice. |

Database schema changes use:

```bash
pnpm db:create-migration --name=describe_change
pnpm db:check
```

See [`packages/db-backbone/README.md`](./packages/db-backbone/README.md) for the
migration workflow and [Database Operations](./docs/database-operations.md) for
backup, restore, and deployment ordering.

## Environment and Secrets

- `.env.localhost.example` is the complete local-stack configuration.
- `.env.example` documents shared and cloud-oriented variables.
- `pnpm env:check` verifies environment schemas and examples stay synchronized.
- `pnpm env:pull` and `pnpm env:push` synchronize supported values with AWS
  Secrets Manager.

Application code should access validated environment values through `@arlequins/env`
instead of reading `process.env` throughout the codebase.

## Local RAG and workspace operations

The local agent accepts `.txt` and `.md` documents up to 1MB. It chunks them,
creates local Ollama embeddings when `nomic-embed-text` is available, and stores
citations with every assistant response. If that optional embedding model is
offline, safe workspace-scoped keyword retrieval remains available.

Workspace owners manage members, document deletion, memory review, retention,
and the audit trail. Members can only act within workspaces where they have a
membership. See [Agent Platform](./docs/agent-platform.md) for the data model,
retention boundary, Docker Ollama profile, and optional cloud adapters.

For a complete click-through local verification, see [Local agent demo](./docs/local-agent-demo.md).

## Template Qualification

Validate SST configuration without SST sign-in or AWS credentials:

```bash
cp .env.example .env
pnpm test:sst
```

Validate complete generated repositories:

```bash
pnpm test:template-output full
pnpm test:template-output minimal
```

These checks do not emulate AWS. Cloud deployment, preview stages, and sandbox
smoke tests still require AWS credentials. See [SST Local Testing](./docs/sst-local-testing.md)
and [Template Readiness](./docs/template-readiness.md).

## Deployment

- Web builds as a static export for S3 and CloudFront.
- API deploys through a Lambda Function URL or API Gateway HTTP API preset.
- Batch workflows use Step Functions, Lambda, and EventBridge schedules.

Read [Deployment and Supply-Chain Security](./docs/deployment-security.md) before
configuring GitHub OIDC roles or production environments. Deployment-specific
commands and tradeoffs live in [`apps/api/README.md`](./apps/api/README.md) and
[`apps/batch/README.md`](./apps/batch/README.md).
The complete workflow map and required GitHub Environment variables and secrets are documented in
[CI/CD Operations](./docs/ci-cd.md).

## Documentation

Use the [documentation index](./docs/README.md) to find architecture,
development, operations, security, and engineering conventions. Package-level
details live beside their implementation under `apps/*/README.md` and
`packages/*/README.md`.

## Publishing a Fork

1. Run `pnpm template:init` and prune unused modules.
2. Replace example identity, domain, seed, and IAM values.
3. Configure branch protection, deployment environments, and cloud roles.
4. Update `LICENSE`, `NOTICE`, ownership, support, and incident contacts.
5. Run local, generated-template, and relevant cloud qualification checks.

## Changelog and License

See [CHANGELOG.md](./CHANGELOG.md). The project is available under the
[MIT License](./LICENSE), with upstream attribution in [NOTICE](./NOTICE).
