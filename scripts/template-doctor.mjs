#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { connect } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateRuntime } from "./check-runtime.mjs";

const REQUIRED_LOCAL_ENV = [
  "DATABASE_HOST",
  "DATABASE_PORT",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
  "DATABASE_NAME",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_API_URL",
];
const REQUIRED_AUTH_ENV = [
  "OIDC_ISSUER_URL",
  "OIDC_AUDIENCE",
  "NEXT_PUBLIC_OIDC_AUTHORITY",
  "NEXT_PUBLIC_OIDC_CLIENT_ID",
  "NEXT_PUBLIC_OIDC_SCOPE",
];

export function parseEnv(source) {
  const values = {};
  for (const sourceLine of source.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

export function evaluateEnvironment({ env, features }) {
  const required = [...REQUIRED_LOCAL_ENV];
  if (features.includes("auth")) required.push(...REQUIRED_AUTH_ENV);
  const missing = required.filter((key) => !env[key]);
  const results = [
    {
      detail:
        missing.length === 0
          ? "Required local variables are present"
          : `Missing: ${missing.join(", ")}`,
      fix: "Copy .env.localhost.example to .env.localhost and fill every required value",
      name: "environment",
      status: missing.length === 0 ? "pass" : "fail",
    },
  ];
  if (
    features.includes("auth") &&
    env.NEXT_PUBLIC_OIDC_AUTHORITY !== env.OIDC_ISSUER_URL
  ) {
    results.push({
      detail: "Browser authority and API issuer differ",
      fix: "Set NEXT_PUBLIC_OIDC_AUTHORITY and OIDC_ISSUER_URL to the same local issuer",
      name: "oidc-contract",
      status: "fail",
    });
  } else if (features.includes("auth"))
    results.push({
      detail: "Browser and API use the same OIDC issuer",
      name: "oidc-contract",
      status: "pass",
    });
  if (features.includes("sst")) {
    const region = env.SST_AWS_REGION ?? env.AWS_REGION;
    results.push({
      detail: region ? `AWS region: ${region}` : "No AWS region configured",
      fix: "Set SST_AWS_REGION; credentials are not required for local SST validation",
      name: "sst-contract",
      status: region ? "pass" : "warn",
    });
  }
  return results;
}

function commandResult(name, command, args, fix) {
  try {
    const detail = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { detail: detail.split("\n")[0], name, status: "pass" };
  } catch {
    return { detail: `${command} is unavailable`, fix, name, status: "fail" };
  }
}

function probe(host, port, timeoutMs = 600) {
  return new Promise((resolveProbe) => {
    const socket = connect({ host, port: Number(port) });
    const finish = (reachable) => {
      socket.destroy();
      resolveProbe(reachable);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

export function parseDoctorArgs(args) {
  const options = { envFile: ".env.localhost", json: false, strict: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--strict") options.strict = true;
    else if (argument === "--env-file") {
      const value = args[index + 1];
      if (!value) throw new Error("--env-file requires a path");
      options.envFile = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

export async function runDoctor(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const results = [];
  try {
    const pnpmVersion = execFileSync("pnpm", ["--version"], {
      encoding: "utf8",
    }).trim();
    validateRuntime({
      nodeVersion: process.versions.node,
      userAgent: `pnpm/${pnpmVersion}`,
    });
    results.push({
      detail: `Node.js ${process.versions.node}, pnpm ${pnpmVersion}`,
      name: "runtime",
      status: "pass",
    });
  } catch (error) {
    results.push({
      detail: error instanceof Error ? error.message : String(error),
      fix: "Use the versions declared in package.json",
      name: "runtime",
      status: "fail",
    });
  }
  results.push(
    commandResult(
      "docker",
      "docker",
      ["--version"],
      "Install and start a compatible Docker runtime",
    ),
  );
  const features =
    JSON.parse(await readFile(resolve(cwd, "template.features.json"), "utf8"))
      .features ?? [];
  const envPath = resolve(cwd, options.envFile ?? ".env.localhost");
  let envSource;
  try {
    envSource = await readFile(envPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return [
      ...results,
      {
        detail: `${options.envFile ?? ".env.localhost"} does not exist`,
        fix: "cp .env.localhost.example .env.localhost",
        name: "environment-file",
        status: "warn",
      },
    ];
  }
  const env = { ...parseEnv(envSource), ...process.env };
  results.push(
    {
      detail: options.envFile ?? ".env.localhost",
      name: "environment-file",
      status: "pass",
    },
    ...evaluateEnvironment({ env, features }),
  );
  if (env.DATABASE_HOST && env.DATABASE_PORT) {
    const reachable = await probe(env.DATABASE_HOST, env.DATABASE_PORT);
    results.push({
      detail: `${env.DATABASE_HOST}:${env.DATABASE_PORT}`,
      fix: "Run pnpm db:start",
      name: "postgresql",
      status: reachable ? "pass" : "warn",
    });
  }
  if (features.includes("auth") && env.OIDC_ISSUER_URL) {
    const issuer = new URL(env.OIDC_ISSUER_URL);
    const reachable = await probe(
      issuer.hostname,
      issuer.port || (issuer.protocol === "https:" ? 443 : 80),
    );
    results.push({
      detail: env.OIDC_ISSUER_URL,
      fix: "Run pnpm dev:local to start the development OIDC provider",
      name: "oidc-provider",
      status: reachable ? "pass" : "warn",
    });
  }
  return results;
}

function printResults(results) {
  for (const result of results) {
    const marker = { fail: "FAIL", pass: "PASS", warn: "WARN" }[result.status];
    console.log(`[${marker}] ${result.name}: ${result.detail}`);
    if (result.fix && result.status !== "pass")
      console.log(`       Fix: ${result.fix}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseDoctorArgs(process.argv.slice(2));
    const results = await runDoctor(options);
    if (options.json) console.log(JSON.stringify({ results }, undefined, 2));
    else printResults(results);
    if (
      results.some((result) => result.status === "fail") ||
      (options.strict && results.some((result) => result.status === "warn"))
    )
      process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
