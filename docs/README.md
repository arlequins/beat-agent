# Documentation

Use this page as the entry point for project documentation. The root
[README](../README.md) covers installation and the shortest path to a running
local application; the pages below explain design decisions and ongoing work.

## Start Here

1. [S3-primary architecture](s3-primary-architecture.md) defines the immutable
   event, conditional state, release, concurrency and recovery model.
2. [Application architecture](architecture.md) explains workspace boundaries
   and the browser-to-S3 request flow.

## Development

- [OpenID Connect authentication](authentication.md): provider registration,
  local identity provider, token validation, and application authorization.
- [Agent operations](agent-operations.md): readiness monitoring, alert policy,
  quotas, S3 recovery, and retrieval-incident recovery.
- [Local agent demo](local-agent-demo.md): verify Ollama prerequisites and run
  the full no-cloud chat and RAG walkthrough.
- [SST local testing](sst-local-testing.md): what can be validated without SST
  sign-in or AWS credentials.
- [Test operations](testing-operations.md): test layers, external test
  environments, and flaky-test policy.
- [Dependency and release automation](automation.md): Renovate policy,
  automated release PRs, tags, and changelog updates.
- [Observability](observability.md): structured logs, metrics, traces, and OTLP
  collector configuration.
- [UI development](ui-development.md): component tests, Storybook, and
  accessibility checks.
- [S3 cache](s3-cache.md): API caching, TTL, invalidation, and
  local configuration.

## Deployment and Operations

- [CI/CD operations](ci-cd.md): workflow responsibilities, required repository
  settings, deployment environment loading, and release flow.
- [Deployment and supply-chain security](deployment-security.md): GitHub OIDC,
  protected environments, security checks, and response headers.
- [Incident runbook](incident-runbook.md): triage, mitigation, recovery, and
  observability integration points.
- [Semantic versioning](semantic-versioning.md): release impact and repository
  version policy.

## Engineering Conventions

- [Git, branches, commits, and releases](conventions/git.md)
- [Monorepo operations](conventions/monorepo.md)
- [Testing policy](conventions/testing.md)
- [tRPC router convention](conventions/trpc.md)
- [TypeScript, imports, exports, constants, and types](conventions/typescript.md)
- [AI collaboration convention](conventions/ai.md)

## AI Context

- [AI memory](ai-memory.md) is a compact repository map for coding agents. It
  supplements the engineering conventions and does not override them.

## Document Boundaries

- Put setup commands and the first successful local run in the root README.
- Put stable engineering rules under `docs/conventions/`.
- Put operational procedures in a dedicated top-level page under `docs/`.
- Update both the implementation and its canonical document in the same PR.
- Link to the canonical page instead of copying procedures into multiple files.
