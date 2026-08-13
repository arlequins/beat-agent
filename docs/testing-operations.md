# Test Operations

## Test Layers

For file naming, mocking, and test design rules, see the
[Testing Policy](conventions/testing.md).

- Unit and contract tests run on every pull request, with an aggregate 75%
  statement, branch, function, and line coverage gate.
- Repository tests cover immutable events, ETag conflicts, leases, tombstones,
  versioned releases, and active-release switching with deterministic storage
  doubles.
- Playwright creates an isolated MinIO bucket, exercises the real S3-compatible
  adapter, and removes the local stack after the suite.
- Playwright runs OIDC login persistence, workspace/document/memory journeys,
  PWA metadata and private-route cache boundaries, visual regression, and
  accessibility checks on desktop and mobile Chromium.
- AWS sandbox smoke tests validate both deployment presets on a schedule and on demand.
- The production contract smoke validates the deployed Pages, API health,
  CORS, PWA, OIDC discovery, and the unauthenticated agent boundary without
  using user credentials.
- The protected authenticated production smoke validates Beat OIDC login,
  browser session persistence, workspace selection, and sending a chat request
  through the deployed UI. It is manual-only and never runs with credentials
  on pull requests.
- k6 baseline load tests are manual and target a dedicated non-production endpoint.

Create a `sandbox` GitHub Environment and configure
`AWS_SMOKE_FUNCTION_URL` and `AWS_SMOKE_GATEWAY_URL` as environment variables.
Both values must be public HTTPS endpoints for disposable sandbox deployments.
The scheduled workflow fails clearly when either endpoint is missing instead of
silently skipping qualification.

```bash
gh api --method PUT repos/OWNER/REPOSITORY/environments/sandbox
gh variable set AWS_SMOKE_FUNCTION_URL --env sandbox --body "https://..."
gh variable set AWS_SMOKE_GATEWAY_URL --env sandbox --body "https://..."
gh workflow run aws-smoke.yml
```

For one-off validation, provide `function_url` and `gateway_url` through the
manual workflow inputs instead of changing the saved environment variables.
Configure `LOAD_TEST_API_URL` separately as a repository variable. Do not run
load tests against production without an approved capacity and incident plan.

Run the public production contract check manually when needed:

```bash
gh workflow run production-smoke.yml
```

The workflow uses the protected `production` Environment variables
`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_OIDC_AUTHORITY`. It never prints or
requires an access token. The authenticated workflow additionally requires a
dedicated Beat test identity and an existing workspace:

```bash
gh secret set PRODUCTION_AUTH_SMOKE_EMAIL --env production
gh secret set PRODUCTION_AUTH_SMOKE_PASSWORD --env production
gh variable set PRODUCTION_AUTH_SMOKE_WORKSPACE_ID --env production --body "workspace-id"
gh workflow run authenticated-production-smoke.yml -f expect_model=enabled
```

Enter the two secret values interactively; never put them in chat, source
files, `DEPLOYMENT_ENV_FILE`, or workflow logs. The production model is
configured separately through the Nova Lite handoff in
[Bedrock production operations](./bedrock-production.md). Use
`expect_model=enabled` only after that protected Environment payload and its
least-privilege IAM diff have been reviewed and deployed. Before the handoff,
`expect_model=disabled` is the expected state for the existing deployment.

## Flaky-test Policy

A failed test is a failure until understood. Retry is diagnostic, not a pass condition. Fix deterministic race, clock, data, and selector issues first. A temporarily quarantined test must have an issue, owner, expiry date, and separate non-blocking job. Do not add arbitrary sleeps; wait on observable state. Track retry rate and remove quarantine before the expiry date.
