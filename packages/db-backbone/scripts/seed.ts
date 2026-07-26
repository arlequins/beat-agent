/**
 * Delegates to `runDrizzleSeeds` from `@arlequins/shared/seed` (runs `seeds/*.ts` beside this file).
 * See `@arlequins/shared` for ledger schema, ordering, and `stage` from `resolveDeployStage()`.
 */
/// <reference types="node" />
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverEnv } from "@arlequins/env";
import { runDrizzleSeeds } from "@arlequins/shared/seed";

import { closeDatabasePool, db } from "../src/client";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const seedDirectories = ["seeds/reference"];
  if (serverEnv.SEED_SAMPLE_DATA) seedDirectories.push("seeds/sample");
  await runDrizzleSeeds({ scriptDir: __dirname, db, seedDirectories });
} finally {
  await closeDatabasePool();
}
