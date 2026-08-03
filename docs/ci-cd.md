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
| `Release` | successful `CI` on `main`, manual | Maintain the Release Please PR and create version tags |
| `Publish tagged release` | `vX.Y.Z` tag push | Re-verify the tagged source and create the GitHub Release |
| `AWS sandbox smoke` | manual, weekly | Exercise Function URL and API Gateway sandbox endpoints |
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
workflow can deploy `all` (API, then web) or a single application.

Production application deployment is intentionally manual and separate from
Release Please. Review the S3 data policy, active release, OIDC settings, and
desired traffic-shift policy before triggering the production workflow.

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
