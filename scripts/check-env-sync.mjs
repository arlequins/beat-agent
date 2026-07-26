#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schemaFiles = [
  "packages/env/src/env-server.ts",
  "packages/env/src/env-client.ts",
  "apps/web/src/env.ts",
];

function keysFrom(source, pattern) {
  return new Set([...source.matchAll(pattern)].map((match) => match[1]));
}

const schemaKeys = new Set();
for (const path of schemaFiles) {
  const source = await readFile(resolve(root, path), "utf8");
  for (const key of keysFrom(source, /process\.env\.([A-Z][A-Z0-9_]*)/g)) {
    if (key !== "NODE_ENV") schemaKeys.add(key);
  }
}

const example = await readFile(resolve(root, ".env.example"), "utf8");
const exampleKeys = keysFrom(example, /^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/gm);
const missing = [...schemaKeys].filter((key) => !exampleKeys.has(key)).sort();

if (missing.length > 0) {
  throw new Error(`Missing from .env.example: ${missing.join(", ")}`);
}

console.log(`Environment schema is synchronized (${schemaKeys.size} keys).`);
