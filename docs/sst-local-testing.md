# SST Local Testing

SST Console sign-in is optional. This repository can validate application behavior, provider installation, generated SST platform types, and deployment configuration without an SST account or AWS credentials.

## Authentication-Free Validation

Copy the example environment if `.env` does not exist, then run:

```bash
cp .env.example .env
pnpm test:sst
```

The command:

1. Removes AWS credential environment variables from its child processes and disables EC2 metadata credential lookup.
2. Runs `sst install` for web, API, batch, and bootstrap with the root `.env` loaded.
3. Runs the API deployment preset unit tests.
4. Typechecks every workspace, including each `sst.config.ts` and its fresh generated platform types.

`sst install` downloads and installs provider packages in each workspace. It can require network access on a clean machine, but it does not create AWS resources or require AWS credentials.

Use a single-workspace check when iterating on one config:

```bash
pnpm sst:ws api install
pnpm --filter @arlequins/api typecheck
```

## Local Application Runtime

Run the application stack without SST or AWS:

```bash
cp .env.localhost.example .env.localhost
pnpm dev:local
```

This uses local PostgreSQL, the development OIDC provider, the Node Hono server, and the Next.js development server. The E2E suite exercises the same local path with isolated test data:

```bash
pnpm test:e2e
```

## What Still Requires AWS

`sst dev`, `sst diff`, and `sst deploy` create, inspect, or update AWS-backed infrastructure and state. They require AWS credentials with the appropriate permissions. Setting `home: "local"` only moves SST state storage to the local machine; it does not emulate Lambda, API Gateway, CloudFront, Step Functions, or other AWS services.

Use an isolated AWS sandbox stage for the final infrastructure preview:

```bash
pnpm sst:ws api deploy -- --stage sandbox
```

Keep this cloud-connected check separate from the authentication-free local test so contributors and ordinary CI jobs can validate the repository without account access.
