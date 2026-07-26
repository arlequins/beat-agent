# CI/CD Operations

This page is the operational map for repository validation, deployment, and
release automation. Security policy and AWS trust configuration remain in
[Deployment and Supply-Chain Security](deployment-security.md).

## Workflow Map

| Workflow | Trigger | Responsibility |
| --- | --- | --- |
| `CI` | pull requests, `main`, merge queue | Formatting, linting, workflow validation, production builds, types, tests, generated-template qualification, Storybook, and E2E |
| `PR title` | pull request title changes | Conventional Commit validation for squash merges |
| `Security` | pull requests, merge queue, `main`, `develop`, weekly | Dependency review, CodeQL, secret scanning, license policy, and SBOM |
| `Preview deployment` | same-repository pull requests | Deploy or remove isolated `pr-NUMBER` API and web stages |
| `Production deployment` | manual | Deploy one application through the protected `production` environment |
| `Release` | successful `CI` on `main`, manual | Maintain the Release Please PR and create version tags |
| `Publish tagged release` | `vX.Y.Z` tag push | Re-verify the tagged source and create the GitHub Release |
| `AWS sandbox smoke` | manual, weekly | Exercise Function URL and API Gateway sandbox endpoints |
| `Quickstart deployment qualification` | manual | Rename, validate, deploy, and remove a fresh full template |
| `Baseline load test` | manual | Run the k6 baseline against an approved HTTPS target |

CI jobs use the shared `tooling/github/setup` action. It reads the pinned Node
and pnpm versions, restores the pnpm store cache, and performs a frozen-lockfile
install. Generated-template jobs may explicitly opt out after intentionally
rewriting package metadata.

## Required Repository Settings

Protect `main` and require these checks before merge:

- `PR title / conventional-commit`
- every non-skipped job under `CI`
- `Security / codeql`, `Security / secrets`, and `Security / supply-chain`
- `Security / dependency-review` after the dependency graph is enabled

Enable merge queue only after the same CI checks have run successfully for a
`merge_group` event. Require at least one review, dismiss stale approvals, and
block force pushes and branch deletion.

Set these repository variables when the associated workflow is enabled:

| Variable | Used by |
| --- | --- |
| `AWS_REGION` | All AWS deployment workflows |
| `AWS_PREVIEW_ROLE_ARN` | Preview deploy and cleanup |
| `AWS_PREVIEW_SECRET_NAME` | Preview runtime and SST environment |
| `AWS_PRODUCTION_ROLE_ARN` | Production deployment |
| `AWS_PRODUCTION_SECRET_NAME` | Production runtime and SST environment |
| `AWS_QUICKSTART_ROLE_ARN` | Generated-template cloud qualification |
| `AWS_SMOKE_FUNCTION_URL` | Scheduled Function URL smoke test |
| `AWS_SMOKE_GATEWAY_URL` | Scheduled API Gateway smoke test |
| `LOAD_TEST_API_URL` | k6 baseline |
| `DEPENDENCY_REVIEW_ENABLED` | Makes dependency-review findings blocking when set to `true` |

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

`AWS_PREVIEW_SECRET_NAME` and `AWS_PRODUCTION_SECRET_NAME` may be a complete
Secrets Manager ARN or a base name. A complete ARN is read directly. A base
name resolves to `<stage>/<base-name>/root`, such as
`production/environments/root`.

The secret value must be a JSON object containing the environment values
required by the selected SST application. The reusable workflow validates all
deployment inputs, assumes the configured AWS role, writes the secret to the
runner's root `.env`, and only then invokes SST. The assumed role therefore
needs least-privilege access to that secret and to the resources managed by the
selected stack.

Preview deployment is skipped for forks and when either preview variable is
missing. Production deployment always passes through the protected
`production` GitHub Environment. Configure required reviewers and prevent
self-review there.

Production application deployment is intentionally manual and separate from
Release Please. A generic template cannot know the target database network,
backup provider, migration window, or desired traffic-shift policy. Follow
[Database Operations](database-operations.md) before deploying API or batch
changes, then trigger the production workflow for the required applications.

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
