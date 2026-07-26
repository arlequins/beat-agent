# Testing Policy

## Framework

Use Vitest.

- It fits Vite, tsx, ESM, TypeScript, and monorepo workflows well.
- It is straightforward to manage through pnpm catalogs.

## Test Layers

- Use unit tests for pure validators, utilities, and service behavior.
- Use contract tests for public tRPC input and output shapes.
- Use PostgreSQL integration tests for migrations, seeds, adapters, and
  representative service paths.
- Use Playwright for browser authentication and critical user journeys.
- Keep AWS sandbox smoke tests separate from credential-free pull-request jobs.

Operational details and the flaky-test policy live in
[Test Operations](../testing-operations.md).

## Policy

- Prefer dependency injection and manual test doubles for database and external
  service dependencies. Use `vi.mock` when a module boundary cannot reasonably
  be injected.
- Use a real isolated PostgreSQL instance when SQL behavior, migrations,
  transactions, or constraints are part of the contract.
- Apply the existing Biome formatter, linter, and import-order conventions to
  test code.
- There is no mandatory coverage percentage yet. At minimum, cover public API happy paths and representative edge cases.

## Test File Location and Naming

- Place tests next to source files, such as `packages/<name>/src/foo.ts` and `packages/<name>/src/foo.test.ts`.
- Use `*.test.ts` and `*.test.tsx`.
- Do not use `*.spec.ts`.
- Shared helpers for multiple tests belong in `packages/<name>/src/__tests__/helpers/*.ts`. Helper files that do not match `*.test.*` should not be direct test targets.

## CI and Turbo Integration

- Define workspace test tasks in `turbo.json` and declare cache outputs when a
  task writes reports.
- Run all workspace tests from the root with `pnpm test`.
- Run tests in CI alongside lint, format, and typecheck jobs.
- Run Playwright E2E tests in a separate CI job with isolated external dependencies.
- Do not run tests in pre-commit hooks. Keep pre-commit fast and stop at typecheck.

## Mocking Examples

### Pure Functions

Call the function directly and assert on the result. No mock is needed.

```ts
import { describe, expect, it } from "vitest";

import { createBatchSchema } from "./batch";

describe("createBatchSchema", () => {
  it("accepts valid payload", () => {
    const result = createBatchSchema.safeParse({
      /* ... */
    });

    expect(result.success).toBe(true);
  });
});
```

### Functions that Use a Database

Design the function so it receives a Drizzle client or repository dependency as an argument. In tests, pass a manual double. Replacing an entire module with `vi.mock` should be a last resort.

```ts
// service
export function createPostService(db: Database) {
  return {
    listPublished: () => db.select().from(Posts).where(/* ... */),
  };
}

// test
const dbDouble = {
  select: () => ({ from: () => ({ where: () => [] }) }),
};

const svc = createPostService(dbDouble as unknown as Database);
```
