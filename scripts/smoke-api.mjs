#!/usr/bin/env node
const baseUrl = process.argv[2]?.replace(/\/$/, "");
if (!baseUrl) throw new Error("Usage: node scripts/smoke-api.mjs API_URL");

for (const path of ["/health/live", "/health/ready"]) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const body = await response.json();
  if (body.status !== "ok") throw new Error(`${path} did not return ok`);
}
console.log(`API smoke checks passed: ${baseUrl}`);
