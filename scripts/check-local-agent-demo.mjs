#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const DEFAULT_MODELS = ["qwen2.5:3b", "nomic-embed-text"];

export function parseOllamaModels(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

export function missingRequiredModels(models, required = DEFAULT_MODELS) {
  return required.filter((model) => !models.includes(model));
}

export function checkLocalAgentDemo({ execFile = execFileSync } = {}) {
  let output;
  try {
    output = execFile("ollama", ["list"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Ollama is unavailable. Install it, start `ollama serve`, then pull the required models.",
    );
  }
  const missing = missingRequiredModels(parseOllamaModels(output));
  if (missing.length > 0)
    throw new Error(
      `Missing Ollama models: ${missing.join(", ")}. Run: ollama pull ${missing.join(" && ollama pull ")}`,
    );
  return { models: DEFAULT_MODELS };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = checkLocalAgentDemo();
  console.log(
    `Local agent demo prerequisites passed: ${result.models.join(", ")}`,
  );
}
