import type { DeployStage } from "@arlequins/env";

export type { DeployStage };

/**
 * Example: derive `tx` from your DB package’s `Database` type:
 *
 * ```ts
 * import type { Database } from "../../src/client"; // adjust path to your package’s client
 * type SeedTx = Parameters<Parameters<Database["transaction"]>[0]>[0];
 * export default async function seed({ tx, stage }: SeedContext<SeedTx>) { ... }
 * ```
 */
export type SeedContext<TTx> = {
  tx: TTx;
  stage: DeployStage;
};

export type SeedRun<TTx> = (ctx: SeedContext<TTx>) => void | Promise<void>;
