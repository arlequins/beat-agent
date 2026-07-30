#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const deniedLicenses = new Set(["AGPL-1.0", "AGPL-3.0", "GPL-2.0", "GPL-3.0"]);
const virtualStore = join(process.cwd(), "node_modules", ".pnpm");
const denied = new Set();
let inspected = 0;

function inspectManifest(path) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const license =
    typeof manifest.license === "string"
      ? manifest.license
      : manifest.license?.type;
  if (!license) return;

  inspected += 1;
  const tokens = license.split(/[^A-Za-z0-9.-]+/).filter(Boolean);
  if (tokens.some((token) => deniedLicenses.has(token))) {
    denied.add(`${manifest.name}@${manifest.version}: ${license}`);
  }
}

for (const storeEntry of readdirSync(virtualStore, { withFileTypes: true })) {
  if (!storeEntry.isDirectory() || storeEntry.name === "node_modules") continue;

  const modules = join(virtualStore, storeEntry.name, "node_modules");
  let dependencies;
  try {
    dependencies = readdirSync(modules, { withFileTypes: true });
  } catch {
    continue;
  }

  for (const dependency of dependencies) {
    if (!dependency.isDirectory() && !dependency.isSymbolicLink()) continue;
    const dependencyPath = join(modules, dependency.name);
    if (dependency.name.startsWith("@")) {
      for (const scopedPackage of readdirSync(dependencyPath, {
        withFileTypes: true,
      })) {
        if (!scopedPackage.isDirectory() && !scopedPackage.isSymbolicLink())
          continue;
        inspectManifest(
          join(dependencyPath, scopedPackage.name, "package.json"),
        );
      }
      continue;
    }
    inspectManifest(join(dependencyPath, "package.json"));
  }
}

if (denied.size > 0) {
  throw new Error(`Denied dependency licenses:\n${[...denied].join("\n")}`);
}

console.log(
  `${inspected} installed dependency manifests satisfy the Beat license policy.`,
);
