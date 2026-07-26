import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("agent runtime IAM policy is scoped to explicit resources", async () => {
  const source = await readFile(
    new URL("../docs/iam/agent-runtime-policy.json", import.meta.url),
    "utf8",
  );
  const policy = JSON.parse(source);
  assert.equal(policy.Version, "2012-10-17");
  for (const statement of policy.Statement) {
    assert.notEqual(statement.Resource, "*");
    for (const action of statement.Action)
      assert.equal(action.includes("*"), false);
  }
});
