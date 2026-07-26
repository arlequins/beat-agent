import { constants } from "node:fs";
import { access, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve(".env.localhost.example");
const target = resolve(".env.localhost");

try {
  await access(target, constants.F_OK);
  console.log(".env.localhost already exists; no values were overwritten.");
} catch {
  await copyFile(source, target);
  console.log("Created .env.localhost from the local agent template.");
}

console.log(
  "Next: ollama pull qwen2.5:3b && ollama pull nomic-embed-text && pnpm dev:local",
);
