#!/usr/bin/env node

function parseArgs(args) {
  const options = { baseUrl: process.env.API_URL };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--api-url") {
      const value = args[index + 1];
      if (!value) throw new Error("--api-url requires a value");
      options.baseUrl = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.baseUrl)
    throw new Error("Set API_URL or pass --api-url http://localhost:5000");
  return { ...options, baseUrl: options.baseUrl.replace(/\/$/, "") };
}

export async function checkAgentReadiness({ baseUrl, fetchImpl = fetch }) {
  const checks = ["/health/live", "/health/ready"];
  const results = await Promise.all(
    checks.map(async (path) => {
      try {
        const response = await fetchImpl(`${baseUrl}${path}`, {
          signal: AbortSignal.timeout(10_000),
        });
        const body = await response.json();
        return {
          ok: response.ok && body.status === "ok",
          path,
          status: response.status,
        };
      } catch {
        return { ok: false, path, status: "unreachable" };
      }
    }),
  );
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0)
    throw new Error(
      `Agent readiness failed: ${failed.map((result) => `${result.path} (${result.status})`).join(", ")}`,
    );
  return results;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const options = parseArgs(process.argv.slice(2));
  await checkAgentReadiness(options);
  console.log(`Agent readiness checks passed: ${options.baseUrl}`);
}
