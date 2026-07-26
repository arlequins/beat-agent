# AI Collaboration Convention

This document defines how AI coding agents should work in this repository.

## Operating Principles

- Read the repository before changing it. Prefer existing patterns, package boundaries, and local helper APIs over new abstractions.
- Keep changes narrowly scoped to the user's request.
- Do not rewrite unrelated code, metadata, generated files, or lockfiles unless the task requires it.
- Treat the working tree as shared. Never revert or overwrite user changes unless the user explicitly asks for that exact action.
- Prefer small, reviewable commits with Conventional Commit messages.
- Explain assumptions when a decision is not obvious from the codebase.

## Branches, Commits, and PRs

- Follow [Git conventions](git.md).
- Use branch names that describe the task, such as `feature/<short-description>`, `fix/<short-description>`, or `docs/<short-description>`.
- Keep PRs focused on one coherent change.
- Before opening or updating a PR, summarize the changed files, verification commands, and any known risks.
- Do not push directly to `main` or `develop`.

## Editing Rules

- Use named imports and named exports by default. Follow [TypeScript conventions](typescript.md).
- Use `@arlequins/*` for internal package references.
- Keep public APIs explicit through package `exports`.
- Add comments only when they clarify non-obvious behavior.
- Do not introduce default exports except for documented framework or tooling exceptions.
- Do not add dependencies casually. If a dependency is needed, add its version to the pnpm catalog first and reference it with `catalog:`.
- Keep generated files generated. Update their source or generator when practical.

## Monorepo Awareness

- Run commands from the repository root unless a package-specific command is clearly more appropriate.
- Use workspace-aware commands such as `pnpm -F @arlequins/<package> <script>` for targeted checks.
- When adding an application, package, or tRPC domain, prefer `pnpm turbo gen`.
- When adding or changing Turborepo tasks, update `turbo.json` with cacheability and `outputs` decisions.

## Verification

Choose checks based on risk and scope:

- Documentation-only changes: run `pnpm check`.
- Formatting-sensitive changes: run `pnpm check` or the relevant package
  command.
- Code changes: run targeted lint and typecheck first.
- Shared package or cross-package changes: run root `pnpm lint` and `pnpm typecheck`.
- Test changes or behavior changes: run the relevant Vitest suite once tests are available.

Always report verification results. If a check cannot be run, explain why.

## Environment and Secrets

- Do not invent or commit secrets.
- Do not read `process.env` directly in application code. Use the shared environment package, such as `@arlequins/env`.
- Use `env:pull` and `env:push` only when the user specifically asks or the task requires secret synchronization.
- Treat cloud, database, and production operations as high-impact. Confirm the target stage before acting.

## tRPC Work

- Keep routers thin. They should define procedures, validate input and output, and call usecase wrappers.
- Put business logic in `lib/services/{domain}`.
- Put I/O interfaces in `lib/services/ports`.
- Put Drizzle and external API implementations in `lib/adaptors`.
- Compose production dependencies in `lib/usecases/composition`.
- Add explicit Zod outputs for complex procedure results.

See [tRPC router convention](trpc.md) for the full pattern.

## Documentation Work

- Write repository documentation in English.
- Avoid references to one-off source projects unless documenting attribution or migration history.
- Use `@arlequins/*` in package examples.
- Keep docs actionable: include commands, paths, and rules that can guide future implementation.
- Update [docs index](../README.md) when adding new documentation pages.
