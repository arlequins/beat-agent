import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseVersion, validateRuntime } from "./check-runtime.mjs";

describe("runtime validation", () => {
  it("parses semantic versions", () => {
    assert.deepEqual(parseVersion("24.14.1"), [24, 14, 1]);
    assert.throws(() => parseVersion("latest"));
  });

  it("accepts supported Node.js and pnpm versions", () => {
    assert.doesNotThrow(() =>
      validateRuntime({
        nodeVersion: "24.14.0",
        userAgent: "pnpm/10.19.0 npm/? node/v24.14.0 darwin arm64",
      }),
    );
  });

  it("rejects unsupported Node.js and package managers", () => {
    assert.throws(() =>
      validateRuntime({ nodeVersion: "22.20.0", userAgent: "pnpm/10.19.0" }),
    );
    assert.throws(() =>
      validateRuntime({ nodeVersion: "24.14.0", userAgent: "npm/11.0.0" }),
    );
    assert.throws(() =>
      validateRuntime({ nodeVersion: "24.14.0", userAgent: "pnpm/9.15.0" }),
    );
  });
});
