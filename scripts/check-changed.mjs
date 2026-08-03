#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const requestedBase = baseIndex >= 0 ? args[baseIndex + 1] : undefined;
if (baseIndex >= 0 && !requestedBase) throw new Error("--base requires a ref");

function exists(ref) {
  return (
    spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], {
      stdio: "ignore",
    }).status === 0
  );
}

const candidates = [
  requestedBase,
  process.env.CHANGE_BASE,
  "origin/develop",
  "origin/main",
  "HEAD~1",
];
const base = candidates.find((candidate) => candidate && exists(candidate));
if (!base) throw new Error("Unable to find a comparison ref");

console.log(`Checking workspaces changed since ${base}.`);
const result = spawnSync(
  "pnpm",
  [
    "exec",
    "turbo",
    "run",
    "lint",
    "typecheck",
    "test",
    `--filter=...[${base}]`,
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
