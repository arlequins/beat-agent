# Deployment and Supply-Chain Security

## AWS OIDC Setup

Create separate AWS IAM roles for preview and production. Configure GitHub's OIDC provider as the federated principal and restrict the `sub` claim to this repository. Preview jobs use dynamic GitHub Environments, so allow `repo:OWNER/REPOSITORY:environment:pr-*` for the preview role. Allow only `repo:OWNER/REPOSITORY:environment:production` for the production role.

Store role ARNs as GitHub variables. Role ARNs identify resources and are not credentials:

- repository: `AWS_PREVIEW_ROLE_ARN`
- repository: `AWS_PRODUCTION_ROLE_ARN`
- repository: `AWS_PREVIEW_SECRET_NAME` and `AWS_PRODUCTION_SECRET_NAME`

The secret-name variables identify the Secrets Manager values loaded into the
deployment runner after OIDC authentication. They may contain a base name or a
complete ARN; they are identifiers, not secret payloads. Preview jobs remain
skipped until both preview variables are configured. See
[CI/CD Operations](ci-cd.md) for the complete environment contract.

Set `AWS_REGION` as an environment variable. Do not store AWS access keys in GitHub.

Start with the trust-policy template in [`docs/iam/github-oidc-trust-policy.json`](./iam/github-oidc-trust-policy.json). Replace placeholders and retain only the subject appropriate for each role before applying it. The deployment permission policy is intentionally not universal: generate it from CloudTrail after a sandbox deployment, then constrain actions and resources to the stacks, state bucket, asset bucket, and roles owned by this repository.

The agent runtime must use a separate role from CI. Its narrow starting policy is
[`docs/iam/agent-runtime-policy.json`](./iam/agent-runtime-policy.json); scope
it to a single model, document prefix, and S3 Vectors index before deployment.

## Environments and Branch Protection

Create a `production` GitHub Environment with required reviewers, prevent self-review, restrict deployment to protected release branches or tags, and configure an approval timeout. Protect `main` and `develop`, require the CI and Security checks, require review, dismiss stale approvals, and disallow force pushes.

Preview deployments only run for branches in the same repository. Fork pull requests never receive AWS credentials. A closed pull request removes its `pr-NUMBER` stage.

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
