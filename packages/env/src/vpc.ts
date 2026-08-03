import { serverEnv } from "./env-server.js";

/**
 * Parse comma-separated AWS resource IDs from env (e.g. `subnet-a,subnet-b`).
 */
export function parseAwsIdList(value: string | undefined): string[] {
  if (value === undefined || value.trim() === "") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Optional VPC id from `VPC_ID` (documentation / tooling; Lambda VPC uses subnet + SG ids only).
 */
export function vpcIdFromEnv(): string | undefined {
  const id = serverEnv.VPC_ID?.trim();
  return id && id.length > 0 ? id : undefined;
}

/**
 * `SUBNET_IDS` + `SECURITY_GROUP_IDS` (comma-separated). `undefined` if either list is empty.
 */
export function vpcFromEnv():
  | { subnetIds: string[]; securityGroups: string[] }
  | undefined {
  const subnetIds = parseAwsIdList(serverEnv.SUBNET_IDS);
  const securityGroups = parseAwsIdList(serverEnv.SECURITY_GROUP_IDS);
  if (subnetIds.length === 0 || securityGroups.length === 0) return undefined;

  return { subnetIds, securityGroups };
}
