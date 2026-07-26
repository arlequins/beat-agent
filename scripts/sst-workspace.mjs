#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const PACKAGES = {
  web: "@arlequins/web",
  api: "@arlequins/api",
  batch: "@arlequins/batch",
};
const TO_SCRIPT = {
  dev: "sst:dev",
  deploy: "sst:deploy",
  /** SST platform types; runs `sst install` in that app */
  types: "sst:install",
  install: "sst:install",
  remove: "sst:remove",
};

const [appKey, cmdKey, ...forward] = process.argv.slice(2);

if (!appKey || !cmdKey) {
  console.error(
    "Usage: pnpm sst:ws <web|api|batch> <dev|deploy|install|types|remove> [-- extra sst args]\n" +
      "Example: pnpm sst:ws api deploy -- --stage production",
  );
  process.exit(1);
}

const pkg = PACKAGES[appKey];
const script = TO_SCRIPT[cmdKey];

if (!pkg) {
  console.error(
    `Unknown app "${appKey}". Use: ${Object.keys(PACKAGES).join(", ")}`,
  );
  process.exit(1);
}
if (!script) {
  console.error(
    `Unknown command "${cmdKey}". Use: ${Object.keys(TO_SCRIPT).join(", ")}`,
  );
  process.exit(1);
}

const result = spawnSync("pnpm", ["-F", pkg, "run", script, ...forward], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status === null ? 1 : result.status);
