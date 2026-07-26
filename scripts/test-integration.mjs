#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";

function dockerHost() {
  if (process.env.DOCKER_HOST) return process.env.DOCKER_HOST;
  try {
    return execFileSync(
      "docker",
      ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
      { encoding: "utf8" },
    ).trim();
  } catch {
    return undefined;
  }
}

const host = dockerHost();
const nonStandardSocket =
  host?.startsWith("unix://") && host !== "unix:///var/run/docker.sock";
const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["--filter", "@arlequins/db-backbone", "test:integration"],
  {
    env: {
      ...process.env,
      DOCKER_HOST: host,
      TESTCONTAINERS_RYUK_DISABLED:
        process.env.TESTCONTAINERS_RYUK_DISABLED ??
        (nonStandardSocket ? "true" : undefined),
    },
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
