# Monorepo Operations

This repository uses pnpm workspaces and Turborepo.

## Version Alignment with pnpm Catalogs

- Manage external dependency versions centrally in `pnpm-workspace.yaml` through `catalog:` and named `catalogs`, such as `catalogs.react19`.
- In each package `package.json`, reference catalog entries with values such as `"drizzle-orm": "catalog:"` instead of writing concrete versions.
- When adding a new dependency, update the catalog first, then reference it from the relevant package.

```yaml
# pnpm-workspace.yaml excerpt
catalog:
  drizzle-orm: ^0.45.2
  zod: ^4.3.6
  typescript: ^5.9.3
catalogs:
  react19:
    react: 19.2.5
    react-dom: 19.2.5
```

```jsonc
// packages/db-backbone/package.json excerpt
{
  "dependencies": {
    "drizzle-orm": "catalog:",
  },
}
```

## Workspace Dependencies

- Use `"@arlequins/<package>": "workspace:*"` for internal package dependencies.
- Internal packages should be `"private": true` and should not be published to npm unless the repository explicitly defines a publication workflow.

## Automated Dependency Updates

Renovate uses [`.github/renovate.json`](../../.github/renovate.json) and follows these rules:

- Patch, pin, digest, and weekly lockfile updates may merge automatically after all configured CI checks pass.
- Minor updates may merge automatically only when the installed package is already at version `1.0.0` or later. Treat `0.x` minor updates as potentially breaking and review them manually.
- All major updates require manual review.
- TypeScript, the Next.js and React runtime, SST, Drizzle, and authentication library majors are grouped into separate stack-specific PRs. Do not combine those migrations with unrelated dependency updates.
- npm releases observe a minimum release age before routine update PRs become eligible, reducing exposure to immediately withdrawn or compromised releases.
- Renovate PR titles use `chore(deps): ...` so they satisfy the repository's Conventional Commits checks.

Automerge still depends on CI being present and meaningful. Keep lint, format, typecheck, unit tests, migration checks, and E2E jobs enabled for dependency PRs. Security alerts can require a faster manual update than the routine schedule.

## Dependency Key Order with Sherif

- `sherif` checks dependency key order in each `package.json`.
- If it fails, run `pnpm dlx sherif@latest --fix` or the repository workspace-fix script.
- The root `package.json` should wire workspace lint and fix scripts, and may run workspace lint from `postinstall`.

## Task Execution

Run common tasks from the repository root through Turborepo.

| Command                           | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `pnpm build`                      | Production build for all workspaces.              |
| `pnpm dev`                        | Start development servers in watch mode.          |
| `pnpm dev:next`                   | Watch the web app and its dependencies.           |
| `pnpm dev:sst`                    | Start `web`, `api`, and `batch` in SST mode.      |
| `pnpm check` / `pnpm check:fix`   | Biome lint, format, and assist checks.            |
| `pnpm lint` / `pnpm lint:fix`     | Biome lint, optionally with automatic fixes.      |
| `pnpm format` / `pnpm format:fix` | Biome format, optionally with automatic fixes.    |
| `pnpm typecheck`                  | Run TypeScript checks.                            |
| `pnpm test:sst`                   | Validate SST providers and configs without AWS credentials. |
| `pnpm clean`                      | Remove untracked files, including `node_modules`. |
| `pnpm db:*` / `pnpm sst:ws`       | Database and SST workspace helper scripts.        |

When adding a new task, define it in `turbo.json` and explicitly decide whether it is cacheable and what its `outputs` are.

## Pre-commit Hooks

`.husky/pre-commit` should run the fast checks needed to keep the repository healthy. A typical sequence is:

1. `pnpm check:fix`
2. `git add -u`
3. `pnpm typecheck`

Commit message validation belongs in `.husky/commit-msg`; see [Git enforcement](git.md#enforcement).

## Creating Packages

Prefer the Turborepo generator over manual scaffolding.

```bash
pnpm turbo gen
```

Select the `package` generator and provide a lowercase kebab-case name. The
generator reads the active package scope from the initialized workspace.

Generated files should include:

| File                               | Purpose                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| `packages/<name>/package.json`     | `private: true`, `type: "module"`, scripts, and dependencies. |
| `packages/<name>/tsconfig.json`    | Extends `@arlequins/tsconfig`.                                     |
| `packages/<name>/src/index.ts`     | Minimal named-export package entry point.                     |

After running the generator:

1. Add the package's public API with named exports.
2. Add external dependencies through the pnpm catalog.
3. Add any package-specific tasks to `turbo.json`.
4. Run `pnpm install` from the root.
5. Run `pnpm check`, `pnpm typecheck`, and the package tests.

The `app` and `domain` generators cover runnable applications and complete tRPC
domain slices. See [Developer Experience](../developer-experience.md#generators).

## Environment Variables and Secrets

- Apps should not keep scattered `apps/<name>/.env.*` files when the environment is injected through shared tooling or deployment infrastructure.
- Use root-level `env:pull` and `env:push` scripts to synchronize secrets when those scripts are available.
- Do not read `process.env` directly throughout application code. Centralize environment loading and validation in a shared environment package, such as `@arlequins/env`.
