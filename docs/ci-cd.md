# CI/CD Operations

This page is the operational map for repository validation, deployment, and
release automation. Security policy and AWS trust configuration remain in
[Deployment and Supply-Chain Security](deployment-security.md).

## Workflow Map

| Workflow | Trigger | Responsibility |
| --- | --- | --- |
| `CI` | pull requests, `main`, merge queue | Formatting, linting, workflow validation, production builds, types, tests, Storybook, and E2E |
| `PR title` | pull request title changes | Conventional Commit validation for squash merges |
| `Security` | pull requests, merge queue, `main`, `develop`, weekly | Dependency review, CodeQL, secret scanning, license policy, and SBOM |
| `Preview deployment` | same-repository pull requests | Deploy or remove isolated `pr-NUMBER` API and web stages |
| `Production deployment` | manual | Deploy one application through the protected `production` environment |
| `GitHub Pages deployment` | `main` web changes, manual | Build and publish the static web application at `/beat-agent/` |
| `Release` | successful `CI` on `main`, manual | Maintain the Release Please PR and create version tags |
| `Publish tagged release` | `vX.Y.Z` tag push | Re-verify the tagged source and create the GitHub Release |
| `AWS sandbox smoke` | manual, weekly | Exercise Function URL and API Gateway sandbox endpoints |
| `Production contract smoke` | Pages deployment, manual, daily | Verify the public Pages, API, CORS, PWA, and OIDC contracts |
| `Baseline load test` | manual | Run the k6 baseline against an approved HTTPS target |

CI jobs use the shared `tooling/github/setup` action. It reads the pinned Node
and pnpm versions, restores the pnpm store cache, and performs a frozen-lockfile
install.

## Required Repository Settings

Protect `main` and require these checks before merge:

- `PR title / conventional-commit`
- every non-skipped job under `CI`
- `Security / codeql`, `Security / secrets`, and `Security / supply-chain`
- `Security / dependency-review` after the dependency graph is enabled

Enable merge queue only after the same CI checks have run successfully for a
`merge_group` event. Require at least one review, dismiss stale approvals, and
block force pushes and branch deletion.

Configure deployment values as GitHub Environment secrets, not as
repository-wide variables. The reusable deployment job selects `preview` for
pull-request stages and `production` for the manual production workflow.

| Environment secret | Used by |
| --- | --- |
| `AWS_DEPLOY_REGION` | SST provider and GitHub OIDC credential configuration for that environment |
| `AWS_DEPLOY_ROLE_ARN` | GitHub OIDC role for preview deploy/cleanup or production deployment |
| `AWS_SMOKE_FUNCTION_URL` | Scheduled Function URL smoke test |
| `AWS_SMOKE_GATEWAY_URL` | Scheduled API Gateway smoke test |
| `LOAD_TEST_API_URL` | k6 baseline |
| `DEPENDENCY_REVIEW_ENABLED` | Makes dependency-review findings blocking when set to `true` |

Every deployable GitHub Environment also needs the secret
`DEPLOYMENT_ENV_FILE`. Its value is the complete dotenv payload written to the
runner's root `.env` immediately before SST runs. Keep OIDC configuration,
S3 settings, CORS origins, and `NEXT_PUBLIC_*` deployment values
there; never commit it or print it in workflow logs. GitHub masks the secret,
and the workflow writes it with owner-only file permissions.

The optional non-sensitive Environment variables `API_CORS_ORIGINS`,
`OIDC_ISSUER_URL`, and `NEXT_PUBLIC_OIDC_AUTHORITY` are appended after
`DEPLOYMENT_ENV_FILE` when present. Set `API_CORS_ORIGINS` to browser origins
only, without a path, for example
`https://arlequins.github.io`. Set `OIDC_ISSUER_URL` to the shared Beat OIDC
issuer, ending in `/auth`, for example
`https://<beat-api-host>/auth`. This lets the Pages project site use
`/beat-agent/` for its web path while the API keeps an exact origin-only CORS
allowlist and validates tokens issued by Beat. Keep
`NEXT_PUBLIC_OIDC_AUTHORITY` equal to the same issuer so the static browser
bundle and API share one authentication contract. The production smoke
workflow detects public contract mismatches.

The API must be deployed before the static web application. For unattended API
then web deployment, use stable custom domains: set `API_CUSTOM_DOMAIN` and set
`NEXT_PUBLIC_API_URL` to that same HTTPS API URL in `DEPLOYMENT_ENV_FILE` before
triggering the workflow. The web build cannot safely discover a newly-created
Function URL after it has started, so a generated endpoint is not suitable for
the one-click API-plus-web path.

No release secret is required: Release Please uses the workflow's short-lived
`GITHUB_TOKEN`. `RELEASE_PLEASE_TOKEN` is an optional override for a GitHub App
installation token or fine-grained token when release PR checks must start
without manual workflow approval. npm Trusted Publishing credentials apply
only when a derived project adds npm publication. Do not store AWS access keys
in GitHub; deployments use short-lived OIDC credentials.

If the repository or organization disables pull-request creation by
`GITHUB_TOKEN`, enable **Settings → Actions → General → Workflow permissions →
Allow GitHub Actions to create and approve pull requests**, or add a
`RELEASE_PLEASE_TOKEN` secret for a GitHub App or fine-grained token with
Contents and Pull requests read/write access. Release Please cannot create the
version PR until one of these authorization paths is available.

## Deployment Environment Contract

Create a `preview` Environment and a `production` Environment. Put the three
environment-specific secrets `AWS_DEPLOY_REGION`, `AWS_DEPLOY_ROLE_ARN`, and
`DEPLOYMENT_ENV_FILE` on each one. Set the non-sensitive repository variable
`PREVIEW_DEPLOY_ENABLED=true` only after the preview Environment is complete;
until then preview jobs are skipped. Production deployment always passes through
the protected `production` Environment; configure required reviewers and
prevent self-review there.

Preview stages retain the SST name `pr-NUMBER` while using the shared `preview`
GitHub Environment. This permits a single non-production secret set without
exposing production configuration to pull-request deployments. The production
workflow can deploy `all` (SST API, then GitHub Pages web) or a single
application. The production web target publishes the Pages artifact and does
not provision an AWS StaticSite; SST is reserved for the API deployment.

Production application deployment is intentionally manual and separate from
Release Please. Review the S3 data policy, active release, OIDC settings, and
desired traffic-shift policy before triggering the production workflow.

## GitHub Pages production web

The web application is also published as a static project site at
`https://arlequins.github.io/beat-agent/`. The `GitHub Pages deployment`
workflow builds the existing Next.js export with `GITHUB_PAGES=true`, which
sets the Next `basePath` and asset prefix to `/beat-agent`. It does not deploy
AWS resources and does not use AWS credentials.

Before the first Pages run, configure these non-sensitive variables on the
protected `production` Environment:

| Environment variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The deployed Beat Agent API HTTPS origin |
| `NEXT_PUBLIC_OIDC_AUTHORITY` | The Beat OIDC issuer, ending in `/auth` |

The workflow fixes the remaining public contract at build time:

```text
NEXT_PUBLIC_SITE_URL=https://arlequins.github.io/beat-agent
NEXT_PUBLIC_OIDC_CLIENT_ID=beat-agent-web
NEXT_PUBLIC_OIDC_SCOPE=openid profile email offline_access
```

The resulting callback URLs are therefore exactly:

```text
https://arlequins.github.io/beat-agent/auth/callback/
https://arlequins.github.io/beat-agent/auth/logout-callback/
```

Register both exact URLs in Beat's `BEAT_AUTH_CLIENTS_JSON` allowlist. Do not
add wildcard callbacks or put an OIDC secret in the Pages Environment; the
browser client is public and uses Authorization Code + PKCE S256. Beat's API
must allow the browser origin `https://arlequins.github.io` in
`API_CORS_ORIGINS`.

## Current production snapshot

The following public endpoints were verified after the `v0.6.1` release on
2026-08-13:

| Surface | URL |
| --- | --- |
| GitHub Pages web app | `https://arlequins.github.io/beat-agent/` |
| API | `https://p3akjheufygfnr54k7vhz6kria0inkun.lambda-url.ap-northeast-1.on.aws/` |
| Beat OIDC issuer | `https://4kfwvp7y2qoprape5p2jr5qvra0ekgcl.lambda-url.ap-northeast-1.on.aws/auth` |

The API liveness endpoint and the Pages site returned HTTP 200 during the
release handoff. The production API is currently deployed without a model
provider configuration, so authentication and health checks are available but
chat completion remains intentionally disabled. Do not put a placeholder model
ID in the production Environment; add an approved Bedrock model ID and exact
model ARN only after the corresponding least-privilege IAM diff has been
reviewed through the protected infrastructure workflow.

The `Production contract smoke` workflow runs without credentials and checks the
deployed Pages project path, PWA manifest and service worker, callback routes,
API liveness/readiness, Pages-origin CORS, and the Beat OIDC discovery document.
It runs after a successful Pages deployment, daily, or manually with optional
HTTPS URL overrides. It deliberately does not attempt an interactive login or
send conversation content; those checks require a protected test identity and
belong in a separate authenticated browser workflow.

## Failure Diagnostics

Each job has a bounded timeout, and superseded pull-request validation runs are
cancelled. Matrix qualification uses `fail-fast: false` so all platform or
preset failures remain visible. Failed E2E runs upload Playwright traces and
test output for seven days.

Deployment concurrency is serialized per stage and application. Do not cancel
an in-progress infrastructure update; allow it to finish, inspect the SST
state, then deploy a corrected revision. Preview cleanup runs when the pull
request closes.

## Release Flow

1. Merge Conventional Commits to `main` after CI and Security pass.
2. Release Please updates the release PR, changelog, and version manifest.
3. Review and merge the release PR through the same protected path.
4. Release Please pushes `vX.Y.Z`; `Publish tagged release` re-verifies that
   exact source and creates the GitHub Release automatically.
5. Run the production deployment procedure when that release is approved for
   the target environment.

Release creation and production deployment remain separate audit events. This
keeps publishing the template from implicitly changing cloud infrastructure.
