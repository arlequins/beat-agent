#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const target = await mkdtemp(join(tmpdir(), "template-generators-"));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: target,
    env: { ...process.env, CI: "true", HUSKY: "0" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} exited with ${result.status}`);
}

async function copyRepository() {
  const paths = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);

  for (const path of paths) {
    const source = resolve(root, path);
    const sourceStat = await stat(source).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!sourceStat || sourceStat.isDirectory()) continue;
    const destination = resolve(target, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}

try {
  await copyRepository();
  await copyFile(resolve(target, ".env.example"), resolve(target, ".env"));
  run(pnpm, ["install", "--frozen-lockfile"]);
  for (const [generator, ...args] of [
    ["app", "generated-app"],
    ["package", "generated-package"],
    ["domain", "order-history"],
    ["feature", "inventory-query", "query"],
  ]) {
    run(pnpm, ["turbo", "gen", generator, "--args", ...args]);
  }
  run(pnpm, ["check"]);
  run(pnpm, ["typecheck"]);

  const rootRouter = await readFile(
    resolve(target, "packages/trpc/src/root.ts"),
    "utf8",
  );
  if (!rootRouter.includes("orderHistory: orderHistoryRouter")) {
    throw new Error("Generated domain was not registered in the tRPC root");
  }
  if (!rootRouter.includes("inventoryQuery: inventoryQueryRouter")) {
    throw new Error("Generated feature was not registered in the tRPC root");
  }
  const featureRouter = await readFile(
    resolve(target, "packages/trpc/src/router/inventory-query.ts"),
    "utf8",
  );
  if (!featureRouter.includes(".query(")) {
    throw new Error("Generated query feature used the wrong procedure kind");
  }
  console.log(
    "Application, package, domain, and feature generators passed qualification.",
  );
} finally {
  await rm(target, { recursive: true, force: true });
}
