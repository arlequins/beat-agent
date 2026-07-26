# Developer Experience

## Dead Code

Run `pnpm lint:dead-code` after removing template features or changing package
exports. Knip checks unused files and dependencies, unlisted imports, unresolved
imports, and script binaries. Dynamic batch, seed, infrastructure, generator,
and load-test entrypoints are declared in `knip.json`; keep exceptions narrow
when adding another runtime-loaded module.

## Project Initialization

`pnpm template:init` separates machine-facing identity from user-facing
branding:

- `--name` sets the npm-safe repository and SST application slug.
- `--display-name` sets web metadata and shell branding. It defaults to a
  title-cased version of `--name`.
- `--scope` replaces the `@arlequins/*` workspace namespace.
- `--domain` replaces example hostnames.
- `--preset` and `--features` choose optional modules; `--prune` removes them.

The resulting `template.features.json` is the local composition manifest. Keep
it committed so generators and future automation can discover the initialized
identity and enabled features without parsing package files.

## Reproducible Workspace

Open the repository in a Dev Container or GitHub Codespaces to get Node.js 24, Docker access, forwarded local ports, Biome, and installed workspace dependencies. Docker remains outside the container so PostgreSQL and E2E services use the same Compose files as local development.

## Generators

Run `pnpm turbo gen` and select one of these generators:

| Generator | Result |
| --- | --- |
| `app` | A runnable TypeScript workspace under `apps/` |
| `package` | A compiled TypeScript library under `packages/` |
| `domain` | A DIP-aligned tRPC domain with types, port, service, adapter, composition, use case, router registration, and contract update |
| `feature` | A clean-architecture command or query across `@arlequins/service` and `@arlequins/trpc`, including its first unit test |

Names must be lowercase kebab-case. The active package scope is read from the initialized workspace instead of being hard-coded.

Use `pnpm gen:feature`, enter a feature name, and select `command` or `query`.
The generator registers the router, updates the public contract, formats the
result, and runs the architecture boundary check. Replace the generated message
input and pass-through adapter with domain-specific types and infrastructure;
the generated dependency direction should remain intact.

## Fast Feedback

- `pnpm env:check` verifies every validated server and browser variable appears in `.env.example`.
- `pnpm check:changed` runs lint, typecheck, and test only for workspaces changed since `origin/develop`. Pass `-- --base <ref>` or set `CHANGE_BASE` to override it.
- `pnpm example:remove` removes the public example post CRUD surface and preserves its source in `.template/example-crud`.
- `pnpm example:regenerate` restores that preserved CRUD surface.

Commit `.template/example-crud` together with an intentional example removal if later regeneration must remain available to other contributors.

## Generated Project Qualification

CI qualifies generated full and minimal repositories without AWS credentials. The manual `Quickstart deployment qualification` workflow additionally renames a fresh template, validates it, assumes `AWS_QUICKSTART_ROLE_ARN` through GitHub OIDC, performs the first API and web deployment, and always removes the sandbox stage.
