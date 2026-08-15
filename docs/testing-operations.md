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
  question submission, deterministic assistant response persistence, citation
  rendering, feedback recording, PWA metadata and private-route cache
  boundaries, visual regression, and accessibility checks on desktop and
  mobile Chromium.
- The chat journey uses `AGENT_TEST_MODEL=true` only in the isolated
  `SST_STAGE=test` E2E profile. It never reaches a deployed Lambda and avoids
  model-provider cost while still exercising the real S3, OIDC, API, and UI
  boundaries.
- AWS sandbox smoke tests validate both deployment presets on a schedule and on demand.
- The production contract smoke validates the deployed Pages, API health,
  CORS, PWA, OIDC discovery, and the unauthenticated agent boundary without
  using user credentials.
- The protected Google SSO production smoke validates that the deployed Agent
  starts Beat's OIDC flow and that Beat redirects to Google's authorization
  endpoint with an exact `/auth/google/callback` redirect. It never uses a
  Google password or a stored workspace ID.
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

The workflow checks the deployed Pages URL and never prints or requires an
access token. Run the Google SSO contract check manually:

```bash
gh workflow run production-google-sso-smoke.yml --repo arlequins/beat-agent
```

The actual Google account approval and the first Agent login are completed in
the user's browser. Workspaces are created and listed inside the authenticated
user's scope; no workspace ID belongs in GitHub configuration.

## Flaky-test Policy

A failed test is a failure until understood. Retry is diagnostic, not a pass condition. Fix deterministic race, clock, data, and selector issues first. A temporarily quarantined test must have an issue, owner, expiry date, and separate non-blocking job. Do not add arbitrary sleeps; wait on observable state. Track retry rate and remove quarantine before the expiry date.
