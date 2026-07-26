#!/usr/bin/env node
import { fileURLToPath } from "node:url";

export function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value ?? "");
  if (!match) throw new Error(`Invalid version: ${value}`);
  return match.slice(1).map(Number);
}

export function validateRuntime({ nodeVersion, userAgent }) {
  const [nodeMajor, nodeMinor] = parseVersion(nodeVersion);
  if (nodeMajor !== 24 || nodeMinor < 14) {
    throw new Error(
      `Node.js 24.14 or newer in the 24.x line is required; found ${nodeVersion}. Use the version in .nvmrc.`,
    );
  }

  if (!userAgent) return;
  const pnpmMatch = /pnpm\/(\d+)\.(\d+)\.(\d+)/.exec(userAgent);
  if (!pnpmMatch) {
    throw new Error(
      "pnpm 10.19 or newer is required. Enable Corepack and run corepack use pnpm@10.19.0.",
    );
  }
  const [, pnpmMajor, pnpmMinor] = pnpmMatch.map(Number);
  if (pnpmMajor !== 10 || pnpmMinor < 19) {
    throw new Error(
      `pnpm 10.19 or newer in the 10.x line is required; found ${pnpmMatch[0].slice(5)}.`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    validateRuntime({
      nodeVersion: process.versions.node,
      userAgent: process.env.npm_config_user_agent,
    });
    console.log(
      `Runtime OK: Node.js ${process.versions.node}${process.env.npm_config_user_agent ? `, ${process.env.npm_config_user_agent.split(" ")[0]}` : ""}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
