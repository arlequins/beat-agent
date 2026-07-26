#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const [backupArg, targetDatabase] = process.argv.slice(2);
if (!backupArg || !targetDatabase) {
  throw new Error("Usage: pnpm db:restore:verify -- BACKUP.dump NEW_DATABASE");
}
if (targetDatabase === process.env.DATABASE_NAME) {
  throw new Error("The verification database must differ from DATABASE_NAME");
}

const backup = resolve(backupArg);
const common = [
  "--host",
  process.env.DATABASE_HOST,
  "--port",
  process.env.DATABASE_PORT,
  "--username",
  process.env.DATABASE_USER,
];
const env = { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD };
for (const [command, args] of [
  ["pg_restore", ["--list", backup]],
  ["createdb", [...common, targetDatabase]],
  [
    "pg_restore",
    [
      ...common,
      "--exit-on-error",
      "--no-owner",
      "--dbname",
      targetDatabase,
      backup,
    ],
  ],
  [
    "psql",
    [
      ...common,
      "--dbname",
      targetDatabase,
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      "select 1",
    ],
  ],
]) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Side-by-side restore verified in database: ${targetDatabase}`);
