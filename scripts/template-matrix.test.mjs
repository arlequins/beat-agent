import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPairwiseCoverage,
  PairwiseFeatureMatrix,
  qualifyFeatureMatrix,
} from "./template-matrix.mjs";

describe("template feature matrix", () => {
  it("covers every pair of feature states", () => {
    assert.doesNotThrow(() => assertPairwiseCoverage());
  });

  it("rejects an incomplete matrix", () => {
    assert.throws(() =>
      assertPairwiseCoverage([[], ["auth", "batch", "sst", "example-ui"]]),
    );
  });

  it("qualifies every generated feature contract", () => {
    assert.equal(qualifyFeatureMatrix(), PairwiseFeatureMatrix.length);
  });
});
