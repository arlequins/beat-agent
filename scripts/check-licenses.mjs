#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const deniedLicenses = ["AGPL-1.0", "AGPL-3.0", "GPL-2.0", "GPL-3.0"];
const output = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
  encoding: "utf8",
});
const report = JSON.parse(output);
const denied = [];

for (const [license, packages] of Object.entries(report)) {
  const licenseTokens = license.split(/[^A-Za-z0-9.-]+/).filter(Boolean);
  if (
    !deniedLicenses.some((deniedLicense) =>
      licenseTokens.includes(deniedLicense),
    )
  ) {
    continue;
  }
  for (const dependency of packages) {
    denied.push(
      `${dependency.name}@${dependency.versions.join(",")}: ${license}`,
    );
  }
}

if (denied.length > 0) {
  throw new Error(`Denied production licenses:\n${denied.join("\n")}`);
}

console.log("Production dependency licenses satisfy the template policy.");
