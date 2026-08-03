import assert from "node:assert/strict";
import test from "node:test";

import { checkAgentReadiness } from "./agent-readiness.mjs";

test("accepts live and ready checks", async () => {
  const results = await checkAgentReadiness({
    baseUrl: "http://agent.test",
    fetchImpl: async () =>
      new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
  });
  assert.equal(results.length, 2);
});

test("reports a failed readiness check", async () => {
  await assert.rejects(
    () =>
      checkAgentReadiness({
        baseUrl: "http://agent.test",
        fetchImpl: async () =>
          new Response(JSON.stringify({ status: "error" }), { status: 503 }),
      }),
    /health\/live \(503\)/,
  );
});
