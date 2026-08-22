import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".mjs"]);

const workspaceScope = (() => {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(root, "packages/ui/package.json"), "utf8"),
    );
    return typeof packageJson.name === "string"
      ? packageJson.name.split("/")[0]
      : "@arlequins";
  } catch {
    return "@arlequins";
  }
})();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const workspacePackage = new RegExp(`^${escapeRegExp(workspaceScope)}/`);

const boundaries = [
  {
    directory: "packages/service/src",
    forbidden: [
      workspacePackage,
      /^@aws-sdk\//,
      /^@trpc\//,
      /^drizzle-orm(?:\/|$)/,
      /^hono(?:\/|$)/,
    ],
    reason: "application and domain layers cannot depend on infrastructure",
  },
  {
    directory: "packages/auth/src/domain",
    forbidden: [workspacePackage, /^jose(?:\/|$)/, /^zod(?:\/|$)/],
    reason: "the authentication domain must remain framework independent",
  },
  {
    directory: "packages/auth/src/application",
    forbidden: [workspacePackage, /^jose(?:\/|$)/, /^zod(?:\/|$)/],
    reason:
      "authentication use cases may only depend on domain types and ports",
  },
  {
    directory: "packages/trpc/src/router",
    forbidden: [
      new RegExp(`^${escapeRegExp(workspaceScope)}/db-`),
      new RegExp(`^${escapeRegExp(workspaceScope)}/env(?:/|$)`),
      new RegExp(`^${escapeRegExp(workspaceScope)}/s3-cache(?:/|$)`),
      /^@aws-sdk\//,
      /^drizzle-orm(?:\/|$)/,
    ],
    reason: "transport routers must call use cases instead of infrastructure",
  },
  {
    directory: "apps/batch/lib/usecases",
    forbidden: [
      new RegExp(`^${escapeRegExp(workspaceScope)}/db-`),
      /^@aws-sdk\//,
      /^drizzle-orm(?:\/|$)/,
    ],
    reason: "batch use cases receive infrastructure through ports",
  },
];

boundaries.push(
  {
    directory: "apps/api/src/features/*/domain",
    forbidden: [
      /^@aws-sdk\//,
      /^@hono\//,
      /^hono(?:\/|$)/,
      new RegExp(`^${escapeRegExp(workspaceScope)}/env(?:/|$)`),
      /(?:^|\/)infrastructure(?:\/|$)/,
    ],
    reason:
      "feature domain models must remain framework and provider independent",
  },
  {
    directory: "apps/api/src/features/*/application",
    forbidden: [
      /^@aws-sdk\//,
      /^@hono\//,
      /^hono(?:\/|$)/,
      new RegExp(`^${escapeRegExp(workspaceScope)}/env(?:/|$)`),
      /(?:^|\/)infrastructure(?:\/|$)/,
    ],
    reason:
      "feature application code must depend on ports and domain models, not adapters",
  },
);

for (const webRoot of ["apps/web/src", "apps/blog/src"]) {
  boundaries.push(
    {
      directory: `${webRoot}/shared`,
      forbidden: [/^~\/(?:entities|features|widgets)(?:\/|$)/],
      reason: "shared web code cannot depend on a higher feature slice",
    },
    {
      directory: `${webRoot}/entities`,
      forbidden: [/^~\/(?:features|widgets)(?:\/|$)/],
      reason: "web entities cannot depend on features or widgets",
    },
    {
      directory: `${webRoot}/features`,
      forbidden: [/^~\/widgets(?:\/|$)/],
      reason: "web features cannot depend on widgets",
    },
  );
}

const importPattern = /(?:from\s+|import\s*\()(["'])([^"']+)\1/g;

async function sourceFiles(directory) {
  if (directory.includes("*")) {
    const [parent, child] = directory.split("/*/");
    const parentPath = join(root, parent);
    let entries;
    try {
      entries = await readdir(parentPath, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT")
        return [];
      throw error;
    }
    const nested = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => sourceFiles(join(parent, entry.name, child))),
    );
    return nested.flat();
  }
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
