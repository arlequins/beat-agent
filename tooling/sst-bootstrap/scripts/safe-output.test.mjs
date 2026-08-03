import * as assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { errorName } from "./lib/safe-output.mjs";

describe("secret synchronization output", () => {
  it("returns only a safe error classification", () => {
    const error = new Error("secret-value");
    error.name = "AccessDeniedException";
    assert.equal(errorName(error), "AccessDeniedException");
    assert.equal(errorName("secret-value"), "UnknownError");
  });

  it("does not print secret identifiers or values during a push dry run", () => {
    const directory = mkdtempSync(join(tmpdir(), "secret-output-"));
    const envFile = join(directory, ".env");
    try {
      writeFileSync(
        envFile,
        "TOKEN=do-not-log\nPASSWORD=also-secret\n",
        "utf8",
      );

      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL("./push-secret-env.mjs", import.meta.url)),
          "--file",
          envFile,
          "--secret-name",
          "sensitive/secret-id",
          "--dry-run",
        ],
        { encoding: "utf8" },
      );

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /secret payload validated/);
      assert.doesNotMatch(result.stdout, /sensitive\/secret-id/);
      assert.doesNotMatch(result.stdout, /do-not-log|also-secret/);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
