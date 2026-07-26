#!/usr/bin/env node
/**
 * GetSecretValue → overwrite `.env` (repo root or `apps/<name>/.env` via --env-target / ENV_TARGET).
 */
import { writeFileSync } from "node:fs";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { errorName } from "./lib/safe-output.mjs";
import {
  applyProfile,
  fetchSecret,
  parseGlobalFlags,
  resolveDefaultEnvPath,
  resolveEnvFilePath,
  resolveEnvTargetCli,
  resolveRegion,
  resolveSecretBase,
  resolveSecretId,
  resolveStageCli,
  serializeEnv,
} from "./lib/shared.mjs";

function printPullHelp() {
  console.log(`Usage: node pull-secret-env.mjs [options]

Options:
  --secret-name, --path <prefix>   Middle path (not ARN), e.g. environments
  --env-target <root|web|…>       Last SM path segment + default .env path (root → repo .env; else apps/<name>/.env)
  --stage <STAGE>                 Path prefix (leading segment), e.g. offline → offline/environments/root
  --out <path>              Write to this file (repo-root relative or absolute)
  --env-file <path>         Same as --out (same flag name as push --file)
  --region, --profile, --dry-run

Environment:
  SECRET_NAME (legacy: SSM_ENV_PATH)   Same as --secret-name prefix or full ARN
  ENV_TARGET   Same as --env-target
  SM_PREFIX / SST_STAGE / STAGE   Prefix (SM_PREFIX avoids SST_STAGE=offline from app .env)
  SECRETS_MANAGER_PLAIN_KEY   When secret is plain text (pull → one env key, default SECRET_VALUE)
  AWS_REGION / SST_AWS_REGION   Default us-east-1
  AWS_PROFILE / SST_AWS_PROFILE
`);
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const args = parseGlobalFlags(argv, 0);
  if (args.help) {
    printPullHelp();
    return;
  }
  const base = resolveSecretBase(args);
  if (!base?.trim()) {
    console.error(
      "pull: set SECRET_NAME or pass --secret-name (secret base name or ARN)",
    );
    process.exit(1);
  }
  const envTarget = resolveEnvTargetCli(args);
  const stagePrefix = resolveStageCli(args);
  const secretId = resolveSecretId(stagePrefix, base, envTarget);

  let outFile;
  try {
    outFile =
      resolveEnvFilePath(args.outFile) ?? resolveDefaultEnvPath(envTarget);
  } catch (e) {
    console.error("pull:", e.message ?? e);
    process.exit(1);
  }

  applyProfile(
    (args.profile?.trim() || undefined) ??
      process.env.AWS_PROFILE?.trim() ??
      process.env.SST_AWS_PROFILE?.trim(),
  );
  const region = resolveRegion(args);
  const client = new SecretsManagerClient({ region });

  let fromRemote;
  try {
    fromRemote = await fetchSecret(client, secretId);
  } catch (e) {
    console.error("GetSecretValue failed:", errorName(e));
    process.exit(1);
  }

  if (Object.keys(fromRemote).length === 0) {
    console.warn("No keys were parsed from Secrets Manager.");
  }

  const body = serializeEnv(fromRemote);
  if (args.dryRun) {
    console.log("Dry run: secret fetched; no file was written.");
    return;
  }
  writeFileSync(outFile, body, "utf8");
  console.log("Wrote secret values to the configured environment file.");
}

main().catch((e) => {
  console.error("Secret pull failed:", errorName(e));
  process.exit(1);
});
