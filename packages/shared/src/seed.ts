/// <reference types="node" />
import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveDeployStage } from "@arlequins/env";

import type { SeedRun } from "@arlequins/types";
import { sql } from "drizzle-orm";

const defaultLedger = {
  schema: "drizzle",
  table: "__drizzle_seeds",
} as const;

export type DrizzleSeedLedger = {
  schema: string;
  table: string;
};

export type RunDrizzleSeedsOptions<TDb> = {
  /** Typically `dirname(fileURLToPath(import.meta.url))` from the caller’s `scripts/seed.ts`; runs `seeds/*.ts` next to it in sorted order. */
  scriptDir: string;
  db: TDb;
  /** Default: `drizzle` schema, `__drizzle_seeds` table. */
  ledger?: DrizzleSeedLedger;
  /** Paths relative to `scriptDir`. Default: `seeds/reference`. */
  seedDirectories?: string[];
};

/**
 * Runs `seeds/*.ts` under `scriptDir` in filename order. Each file must default-export
 * `async ({ tx, stage }) => void` (`stage` from `resolveDeployStage()`).
 *
 * Applied seeds are recorded in `ledger.schema`.`ledger.table` by filename.
 */
export async function runDrizzleSeeds<TDb>(
  options: RunDrizzleSeedsOptions<TDb>,
): Promise<void> {
  const { scriptDir, db } = options;
  const ledger = options.ledger ?? defaultLedger;

  const ledgerTable = sql.raw(`"${ledger.schema}"."${ledger.table}"`);
  /** Minimal Drizzle `db` / transaction `tx` shape (cast from each package’s client). */
  type DrizzleSeedDb = {
    execute: (query: unknown) => Promise<unknown>;
    transaction: <R>(fn: (tx: DrizzleSeedDb) => Promise<R>) => Promise<R>;
  };
  const d = db as DrizzleSeedDb;

  async function ensureSeedsLedgerTable() {
    await d.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${ledger.schema}"`));
    await d.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS "${ledger.schema}"."${ledger.table}" (
        id serial PRIMARY KEY NOT NULL,
        name text NOT NULL,
        applied_at timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "${ledger.table}_name_unique" UNIQUE (name)
      )
    `),
    );
  }

  async function loadAppliedSeedNames(): Promise<Set<string>> {
    const rows = await d.execute(sql`SELECT name FROM ${ledgerTable}`);
    const names = new Set<string>();
    for (const row of rows as Record<string, unknown>[]) {
      const name = Reflect.get(row, "name");
      if (typeof name === "string") names.add(name);
    }
    return names;
  }

  async function listTsSeeds(): Promise<{ name: string; path: string }[]> {
    const out: { name: string; path: string }[] = [];
    for (const directory of options.seedDirectories ?? ["seeds/reference"]) {
      const directoryPath = join(scriptDir, directory);
      let entries: Dirent[];
      try {
        entries = await readdir(directoryPath, { withFileTypes: true });
      } catch (e: unknown) {
        const code =
          e && typeof e === "object" && "code" in e ? e.code : undefined;
        if (code === "ENOENT") continue;
        throw e;
      }
      for (const e of entries) {
        if (!e.isFile() || e.name.startsWith("_") || !e.name.endsWith(".ts")) {
          continue;
        }
        out.push({
          name: `${directory}/${e.name}`,
          path: join(directoryPath, e.name),
        });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, "en"));
  }

  const stage = resolveDeployStage();
  console.log(`Seeds: stage = "${stage}"`);

  await ensureSeedsLedgerTable();

  const files = await listTsSeeds();
  if (files.length === 0) {
    console.log("No seed files selected.");
    return;
  }

  const applied = await loadAppliedSeedNames();

  for (const { name, path } of files) {
    if (applied.has(name)) {
      console.log(`Skip (already seeded): ${name}`);
      continue;
    }

    console.log(`Seeding: ${name} …`);
    const mod = (await import(pathToFileURL(path).href)) as {
      default?: unknown;
    };
    const run = mod.default;
    if (typeof run !== "function") {
      throw new Error(
        `Seed "${name}" must default-export async ({ tx, stage }) => ...`,
      );
    }

    await d.transaction(async (tx) => {
      await (run as SeedRun<typeof tx>)({ tx, stage });
      await tx.execute(sql`INSERT INTO ${ledgerTable} (name) VALUES (${name})`);
    });

    applied.add(name);
    console.log(`Seeded: ${name}`);
  }

  console.log("All seeds completed.");
}
