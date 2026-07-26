import { describe, expect, it } from "vitest";

import { assertSampleSeedAllowed, isSampleSeedAllowed } from "./seed-safety";

describe("sample seed safety", () => {
  it.each(["offline", "test", " OFFLINE "])(
    "allows sample data in %s",
    (stage) => {
      expect(isSampleSeedAllowed(stage)).toBe(true);
    },
  );

  it.each(["develop", "production", "preview", undefined])(
    "blocks sample data in %s without explicit opt-in",
    (stage) => {
      expect(isSampleSeedAllowed(stage)).toBe(false);
      expect(() => assertSampleSeedAllowed(stage)).toThrow(
        "SEED_SAMPLE_DATA=true",
      );
    },
  );

  it("allows sample data in any stage with explicit opt-in", () => {
    expect(isSampleSeedAllowed("production", true)).toBe(true);
    expect(() => assertSampleSeedAllowed("production", true)).not.toThrow();
  });
});
