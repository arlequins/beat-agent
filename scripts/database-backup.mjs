#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  "DATABASE_HOST",
  "DATABASE_PORT",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
  "DATABASE_NAME",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const output = resolve(
  process.argv[2] ??
    `backups/${process.env.DATABASE_NAME}-${new Date().toISOString().replaceAll(":", "-")}.dump`,
);
mkdirSync(resolve(output, ".."), { recursive: true });
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
  [
    "pg_dump",
    [
      ...common,
      "--format=custom",
      "--compress=9",
      "--file",
      output,
      process.env.DATABASE_NAME,
    ],
  ],
  ["pg_restore", ["--list", output]],
]) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Verified database backup: ${output}`);
