/**
 * Whether to skip Zod validation for `createEnv` (CI / tooling without a filled `.env`).
 * Must read `process.env` directly — {@link serverEnv} depends on this flag (no circular import).
 */
export const skipEnvValidation =
  !!process.env.CI || process.env.npm_lifecycle_event === "lint";
