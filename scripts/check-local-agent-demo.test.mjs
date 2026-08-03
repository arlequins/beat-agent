import assert from "node:assert/strict";
import test from "node:test";

import {
  checkLocalAgentDemo,
  missingRequiredModels,
  parseOllamaModels,
} from "./check-local-agent-demo.mjs";

test("parses Ollama model names", () => {
  assert.deepEqual(
    parseOllamaModels(
      "NAME ID SIZE MODIFIED\nqwen2.5:3b abc 2 GB now\nnomic-embed-text def 274 MB now\n",
    ),
    ["qwen2.5:3b", "nomic-embed-text"],
  );
});

test("identifies a missing embedding model", () => {
  assert.deepEqual(missingRequiredModels(["qwen2.5:3b"]), ["nomic-embed-text"]);
});

test("checks all required local models", () => {
  assert.deepEqual(
    checkLocalAgentDemo({
      execFile: () =>
        "NAME ID SIZE MODIFIED\nqwen2.5:3b abc 2 GB now\nnomic-embed-text def 274 MB now\n",
    }),
    { models: ["qwen2.5:3b", "nomic-embed-text"] },
  );
});
