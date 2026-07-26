import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".mjs"]);

const boundaries = [
  {
    directory: "packages/service/src",
    forbidden: [
      /^@arlequins\//,
      /^@aws-sdk\//,
      /^@trpc\//,
      /^drizzle-orm(?:\/|$)/,
      /^hono(?:\/|$)/,
    ],
    reason: "application and domain layers cannot depend on infrastructure",
  },
  {
    directory: "packages/auth/src/domain",
    forbidden: [/^@arlequins\//, /^jose(?:\/|$)/, /^zod(?:\/|$)/],
    reason: "the authentication domain must remain framework independent",
  },
  {
    directory: "packages/auth/src/application",
    forbidden: [/^@arlequins\//, /^jose(?:\/|$)/, /^zod(?:\/|$)/],
    reason:
      "authentication use cases may only depend on domain types and ports",
  },
  {
    directory: "packages/trpc/src/router",
    forbidden: [
      /^@arlequins\/db-/,
      /^@arlequins\/env(?:\/|$)/,
      /^@arlequins\/s3-cache(?:\/|$)/,
      /^@aws-sdk\//,
      /^drizzle-orm(?:\/|$)/,
    ],
    reason: "transport routers must call use cases instead of infrastructure",
  },
  {
    directory: "apps/batch/lib/usecases",
    forbidden: [/^@arlequins\/db-/, /^@aws-sdk\//, /^drizzle-orm(?:\/|$)/],
    reason: "batch use cases receive infrastructure through ports",
  },
];

const importPattern = /(?:from\s+|import\s*\()(["'])([^"']+)\1/g;

async function sourceFiles(directory) {
  const absolute = join(root, directory);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT")
      return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(absolute, entry.name);
      if (entry.isDirectory()) return sourceFiles(relative(root, path));
      return sourceExtensions.has(extname(entry.name)) ? [path] : [];
    }),
  );
  return nested.flat();
}

const violations = [];
for (const boundary of boundaries) {
  for (const file of await sourceFiles(boundary.directory)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[2];
      if (boundary.forbidden.some((pattern) => pattern.test(specifier))) {
        violations.push(
          `${relative(root, file)} imports ${specifier}: ${boundary.reason}`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    ["Architecture boundary violations:", ...violations].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log("Architecture boundaries are valid.");
}
