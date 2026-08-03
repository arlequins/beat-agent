#!/usr/bin/env node
/**
 * Read `.env` or JSON → CreateSecret / UpdateSecret (see `lib/shared.mjs`).
 */
import { existsSync } from "node:fs";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { errorName } from "./lib/safe-output.mjs";
import {
  applyProfile,
  fileToSecretString,
  parseGlobalFlags,
  putSecret,
  resolveDefaultEnvPath,
  resolveEnvFilePath,
  resolveEnvTargetCli,
  resolveRegion,
  resolveSecretBase,
  resolveSecretId,
  resolveStageCli,
} from "./lib/shared.mjs";

function printPushHelp() {
  console.log(`Usage: node push-secret-env.mjs [options]

Uploads a file to Secrets Manager as SecretString (JSON).
  .env files are parsed to an object then stored as JSON.
  .json files must contain a single JSON object.

Options:
  --file <path>             Input file (repo-root relative or absolute)
  --env-file <path>         Same as --file (alias; matches pull --env-file)
  --secret-name <prefix>    Middle path, e.g. environments
  --env-target <root|web|…> Last SM segment + default .env path (root → repo .env; else apps/<name>/.env)
  --stage <STAGE>           Path prefix (leading segment), e.g. offline → offline/environments/root
  --region, --profile, --dry-run

Environment:
  SECRET_NAME          Same as --secret-name (or full ARN)
  ENV_TARGET           Same as --env-target when --file omitted
  SM_PREFIX / SST_STAGE / STAGE   Prefix (prefer SM_PREFIX for pull/push)
  AWS_REGION / SST_AWS_REGION
  AWS_PROFILE / SST_AWS_PROFILE
`);
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const args = parseGlobalFlags(argv, 0);
  if (args.help) {
    printPushHelp();
    return;
  }
  const base = resolveSecretBase(args);
  if (!base?.trim()) {
    console.error(
      "push: set SECRET_NAME or pass --secret-name (secret base name)",
    );
    process.exit(1);
  }
  let defaultEnvPath;
  try {
    defaultEnvPath = resolveDefaultEnvPath(resolveEnvTargetCli(args));
  } catch (e) {
    console.error("push:", e.message ?? e);
    process.exit(1);
  }

  const filePath = args.file ? resolveEnvFilePath(args.file) : defaultEnvPath;
  if (!existsSync(filePath)) {
    console.error(`push: file not found: ${filePath}`);
    process.exit(1);
  }

  let secretString;
  try {
    secretString = fileToSecretString(filePath);
  } catch (e) {
    console.error("push:", e.message ?? e);
    process.exit(1);
  }

  const secretId = resolveSecretId(
    resolveStageCli(args),
    base,
    resolveEnvTargetCli(args),
  );
  if (args.dryRun) {
    console.log("Dry run: secret payload validated; no secret was updated.");
    return;
  }

  applyProfile(
    (args.profile?.trim() || undefined) ??
      process.env.AWS_PROFILE?.trim() ??
      process.env.SST_AWS_PROFILE?.trim(),
  );
  const region = resolveRegion(args);
  const client = new SecretsManagerClient({ region });

  try {
    await putSecret(client, secretId, secretString);
  } catch (e) {
    console.error("CreateSecret/UpdateSecret failed:", errorName(e));
    process.exit(1);
  }
  console.log("Updated the configured Secrets Manager secret.");
}

main().catch((e) => {
  console.error("Secret push failed:", errorName(e));
  process.exit(1);
});
