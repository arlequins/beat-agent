#!/usr/bin/env node
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import {
  pathsToPrune,
  resolveFeatures,
  transformContent,
} from "./template-init.mjs";

export const RequiredFeatureNames = ["auth"];
export const FeatureNames = ["batch", "sst", "example-ui"];

// Orthogonal array OA(4, 3, 2): every pair of optional feature flags appears in all four states.
export const PairwiseFeatureMatrix = [
  [...RequiredFeatureNames],
  [...RequiredFeatureNames, "sst", "example-ui"],
  [...RequiredFeatureNames, "batch", "example-ui"],
  [...RequiredFeatureNames, "batch", "sst"],
];

export function assertPairwiseCoverage(matrix = PairwiseFeatureMatrix) {
  for (let left = 0; left < FeatureNames.length; left += 1) {
    for (let right = left + 1; right < FeatureNames.length; right += 1) {
      const observed = new Set(
        matrix.map(
          (features) =>
            `${Number(features.includes(FeatureNames[left]))}${Number(features.includes(FeatureNames[right]))}`,
        ),
      );
      assert.deepEqual([...observed].sort(), ["00", "01", "10", "11"]);
    }
  }
}

export function qualifyFeatureMatrix() {
  assertPairwiseCoverage();
  for (const [index, features] of PairwiseFeatureMatrix.entries()) {
    const options = {
      features: features.join(","),
      name: `matrix-${index}`,
      preset: "minimal",
      prune: true,
      scope: "@matrix",
    };
    assert.deepEqual([...resolveFeatures(options)], features);
    const pruned = pathsToPrune(options);
    assert.equal(pruned.includes("packages/auth"), false);
    assert.equal(pruned.includes("apps/batch"), !features.includes("batch"));
    assert.equal(
      pruned.includes("tooling/sst-bootstrap"),
      !features.includes("sst"),
    );
    assert.equal(
      pruned.includes("apps/web/src/components/blog"),
      !features.includes("example-ui"),
    );

    const manifest = JSON.parse(
      transformContent("template.features.json", "{}", options),
    );
    assert.deepEqual(manifest.features, features);
    const rootPackage = JSON.parse(
      transformContent(
        "package.json",
        JSON.stringify({
          name: "beat-agent",
          scripts: {
            "batch:run": "batch",
            "dev:sst": "sst",
            "example:remove": "remove",
            "example:regenerate": "regen",
            "sst:ws": "sst",
            test: "test",
            "test:e2e": "e2e",
            "test:e2e:headed": "e2e",
            "test:sst": "sst",
          },
          devDependencies: {
            "@axe-core/playwright": "1",
            "@playwright/test": "1",
          },
        }),
        options,
      ),
    );
    assert.equal(
      "batch:run" in rootPackage.scripts,
      features.includes("batch"),
    );
    assert.equal("dev:sst" in rootPackage.scripts, features.includes("sst"));
    assert.equal(
      "example:remove" in rootPackage.scripts,
      features.includes("example-ui"),
    );
    assert.equal("test:e2e" in rootPackage.scripts, features.includes("auth"));
  }
  return PairwiseFeatureMatrix.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const count = qualifyFeatureMatrix();
  console.log(`Qualified ${count} pairwise template feature combinations`);
}
