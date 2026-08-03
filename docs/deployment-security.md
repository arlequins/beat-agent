# Deployment and Supply-Chain Security

## AWS OIDC Setup

Create separate AWS IAM roles for preview and production. Configure GitHub's
OIDC provider as the federated principal and restrict the `sub` claim to this
repository. The workflow uses the stable GitHub Environments `preview` and
`production`, so allow only `repo:OWNER/REPOSITORY:environment:preview` for the
preview role and `repo:OWNER/REPOSITORY:environment:production` for the
production role.

Store these values as secrets on the matching GitHub Environment. Role ARNs
identify resources and are not credentials, but keeping all deployment inputs
in the same protected Environment prevents accidental cross-environment use:

- environment secret: `AWS_DEPLOY_ROLE_ARN`
- environment secret: `AWS_DEPLOY_REGION`
- environment secret: `DEPLOYMENT_ENV_FILE`

`DEPLOYMENT_ENV_FILE` is a complete dotenv payload. The deployment runner
writes it to its root `.env` after OIDC authentication and before SST runs; it
does not fetch runtime configuration from AWS Secrets Manager. Preview jobs
remain skipped until the repository variable `PREVIEW_DEPLOY_ENABLED=true` is
set after the preview Environment is configured. See
[CI/CD Operations](ci-cd.md) for the complete environment contract.

Set `AWS_DEPLOY_REGION` as a GitHub Environment secret. Do not store AWS access keys in GitHub.

Start with the trust-policy template in [`docs/iam/github-oidc-trust-policy.json`](./iam/github-oidc-trust-policy.json). Replace placeholders and retain only the subject appropriate for each role before applying it. The deployment permission policy is intentionally not universal: generate it from CloudTrail after a sandbox deployment, then constrain actions and resources to the stacks, state bucket, asset bucket, and roles owned by this repository.

The agent runtime must use a separate role from CI. Its narrow starting policy is
[`docs/iam/agent-runtime-policy.json`](./iam/agent-runtime-policy.json); scope
it to a single model, document prefix, and S3 Vectors index before deployment.

## Environments and Branch Protection

Create `preview` and `production` GitHub Environments. Require reviewers,
prevent self-review, restrict deployment to protected release branches or tags,
and configure an approval timeout for `production`; do not give the preview
Environment production secrets. Protect `main` and `develop`, require the CI
and Security checks, require review, dismiss stale approvals, and disallow
force pushes.

Preview deployments only run for branches in the same repository. Fork pull
requests never receive AWS credentials. A closed pull request removes its
`pr-NUMBER` stage. API then web deployment requires stable custom-domain values
in the environment secret; do not rely on a newly-created Function URL for a
static web build.

## Security Checks

The Security workflow performs dependency review, CodeQL analysis, full-history secret scanning, production-license policy validation, and SPDX JSON SBOM generation. Enable GitHub's Dependency Graph, then set the repository variable `DEPENDENCY_REVIEW_ENABLED=true` to make dependency-review failures blocking. Before that opt-in, unsupported Dependency Review results are reported without failing the workflow. Repository administrators should also enable GitHub secret scanning and push protection.

The license policy rejects AGPL and GPL production dependencies by default. Adjust `scripts/check-licenses.mjs` only after legal review.

## Headers and CSP

The Hono API uses `secureHeaders` and strict CORS. For the statically exported web application, configure a CloudFront response-headers policy with HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame restrictions, and a tested Content Security Policy. Start CSP in report-only mode because OIDC issuer and API origins vary by generated project, then enforce it after collecting violations. Do not hard-code a template-wide production issuer.

## Application Request Guards

The Hono boundary rejects tRPC request bodies larger than
`API_BODY_LIMIT_BYTES` and applies a fixed-window limiter through the
provider-neutral `RateLimitPort`. The bundled in-memory adapter is useful for
local development and as per-instance defense in depth. It is not a global
quota across serverless instances.

Production workloads should keep API Gateway throttling enabled or replace the
port with a shared, atomic store adapter. A WAF remains appropriate for edge
abuse controls. Rate-limited responses use HTTP 429 with `Retry-After` and
`RateLimit-*` metadata; oversized requests use HTTP 413. Health checks and CORS
preflight requests are not counted.
