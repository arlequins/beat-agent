import { execFileSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE_NAME = "beat-agent";
const TEMPLATE_SCOPE = "@arlequins";
const TEMPLATE_DISPLAY_NAME = "Beat Agent";
const REQUIRED_FEATURES = ["auth"];
const OPTIONAL_FEATURES = ["auth", "batch", "sst", "example-ui"];
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

function sortDependencyKeys(source) {
  const packageJson = JSON.parse(source);
  for (const field of DEPENDENCY_FIELDS) {
    if (!packageJson[field]) continue;
    packageJson[field] = Object.fromEntries(
      Object.entries(packageJson[field]).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  }
  return `${JSON.stringify(packageJson, undefined, 2)}\n`;
}

export function resolveFeatures(options) {
  const requested = options.features
    ? options.features
        .split(",")
        .map((feature) => feature.trim())
        .filter(Boolean)
    : options.preset === "minimal"
      ? REQUIRED_FEATURES
      : OPTIONAL_FEATURES;
  const unknown = requested.filter(
    (feature) => !OPTIONAL_FEATURES.includes(feature),
  );
  if (unknown.length > 0)
    throw new Error(`Unknown features: ${unknown.join(", ")}`);
  return new Set([...REQUIRED_FEATURES, ...requested]);
}

export function resolveDisplayName(options) {
  if (options["display-name"]?.trim()) return options["display-name"].trim();
  return (options.name ?? "")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function displayInitials(displayName) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function parseArgs(args) {
  const options = { dryRun: false, force: false, prune: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--force") options.force = true;
    else if (argument === "--prune") options.prune = true;
    else if (argument?.startsWith("--")) {
      const key = argument.slice(2);
      const value = args[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`Missing value for ${argument}`);
      options[key] = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

export function pathsToPrune(options) {
  if (!options.prune) return [];
  const features = resolveFeatures(options);
  const paths = ["pnpm-lock.yaml"];

  if (!features.has("auth")) {
    paths.push(
      "apps/web/src/app/auth",
      "apps/web/src/auth/provider.tsx",
      "apps/web/src/auth/status.tsx",
      "apps/web/src/lib/client-auth.ts",
      "packages/auth",
      "packages/db-backbone/drizzle/0001_auth-users.sql",
      "packages/db-backbone/drizzle/meta/0001_snapshot.json",
      "packages/db-backbone/src/schemas/auth.ts",
      "packages/trpc/src/adaptors/auth-user.ts",
      "packages/trpc/src/router/auth.ts",
      "playwright.config.ts",
      "tests/e2e/accessibility.test.ts",
      "tests/e2e/auth.test.ts",
      "tests/e2e/content-crud.test.ts",
      "tooling/oidc-mock",
    );
  }
  if (!features.has("batch")) paths.push("apps/batch");
  if (!features.has("sst")) {
    paths.push(
      "apps/api/sst-env.d.ts",
      "apps/api/sst-globals.d.ts",
      "apps/api/sst.config.ts",
      "apps/web/sst-env.d.ts",
      "apps/web/sst-globals.d.ts",
      "apps/web/sst.config.ts",
      "scripts/sst-workspace.mjs",
      "scripts/test-sst.mjs",
      "tooling/sst-bootstrap",
    );
  }
  if (!features.has("example-ui")) {
    paths.push(
      "apps/web/public/blog",
      "apps/web/src/app/admin",
      "apps/web/src/app/editor",
      "apps/web/src/app/posts",
      "apps/web/src/app/users",
      "apps/web/src/components/blog",
      "apps/web/src/components/content",
      "apps/web/src/components/authorization",
      "apps/web/src/lib/blog-data.ts",
      "scripts/example-crud.mjs",
    );
  }

  return paths.sort();
}

function removeDependencies(packageJson, dependencies) {
  for (const field of DEPENDENCY_FIELDS) {
    for (const dependency of dependencies)
      delete packageJson[field]?.[dependency];
  }
}

function removeScripts(packageJson, scripts) {
  for (const script of scripts) delete packageJson.scripts?.[script];
}

function prunePackageJson(relativePath, source, options) {
  const features = resolveFeatures(options);
  const packageJson = JSON.parse(source);

  if (!features.has("auth")) {
    if (relativePath === "package.json") {
      removeDependencies(packageJson, [
        "@axe-core/playwright",
        "@playwright/test",
      ]);
      removeScripts(packageJson, ["test:e2e", "test:e2e:headed"]);
    }
    if (relativePath === "apps/api/package.json") {
      removeDependencies(packageJson, [`${options.scope}/auth`]);
    }
    if (relativePath === "apps/web/package.json") {
      removeDependencies(packageJson, [
        `${options.scope}/auth`,
        "oidc-client-ts",
      ]);
    }
    if (relativePath === "packages/trpc/package.json") {
      removeDependencies(packageJson, [`${options.scope}/auth`, "drizzle-orm"]);
    }
  }

  if (!features.has("sst") && relativePath.startsWith("apps/")) {
    removeDependencies(packageJson, ["sst"]);
    removeScripts(packageJson, [
      "sst:deploy",
      "sst:dev",
      "sst:install",
      "sst:remove",
    ]);
  }

  if (!features.has("example-ui") && relativePath === "apps/web/package.json") {
    removeDependencies(packageJson, [
      `${options.scope}/validators`,
      "@tanstack/react-form",
      "lucide-react",
    ]);
  }
  if (!features.has("example-ui") && relativePath === "package.json") {
    removeScripts(packageJson, ["example:remove", "example:regenerate"]);
  }

  return `${JSON.stringify(packageJson, undefined, 2)}\n`;
}

function removeOidcClientEnvironment(source) {
  return source
    .replace(
      / {4}NEXT_PUBLIC_OIDC_AUTHORITY: z\.url\(\),[\s\S]*? {8}message: "OIDC scope must include openid",\n {6}\}\),\n/,
      "",
    )
    .split("\n")
    .filter((line) => !line.includes("NEXT_PUBLIC_OIDC_"))
    .join("\n");
}

export function validateOptions(options) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(options.name ?? "")) {
    throw new Error("--name must be a lowercase npm-safe slug");
  }
  if (!/^@[a-z0-9][a-z0-9._-]*$/.test(options.scope ?? "")) {
    throw new Error("--scope must be an npm scope such as @company");
  }
  if (options.domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(options.domain)) {
    throw new Error("--domain must be a hostname such as example.org");
  }
  const displayName = resolveDisplayName(options);
  if (displayName.length < 1 || displayName.length > 80) {
    throw new Error("--display-name must contain between 1 and 80 characters");
  }
  if (
    options.preset &&
    options.preset !== "full" &&
    options.preset !== "minimal"
  ) {
    throw new Error("--preset must be full or minimal");
  }
  resolveFeatures(options);
}

export function transformContent(relativePath, source, options) {
  const features = resolveFeatures(options);
  let output = source
    .replaceAll("\r\n", "\n")
    .split(TEMPLATE_SCOPE)
    .join(options.scope)
    .split(TEMPLATE_NAME)
    .join(options.name);
  output = output
    .split(TEMPLATE_DISPLAY_NAME)
    .join(resolveDisplayName(options));
  if (options.domain)
    output = output.split("beat.localhost").join(options.domain);

  const appName = new Map([
    ["apps/web/sst.config.ts", "web"],
    ["apps/api/sst.config.ts", "api"],
    ["apps/batch/sst.config.ts", "batch"],
    ["tooling/sst-bootstrap/sst.config.ts", "bootstrap"],
  ]).get(relativePath);
  if (appName) {
    output = output.replace(
      `name: "${appName}"`,
      `name: "${options.name}-${appName}"`,
    );
  }

  if (relativePath === "package.json") {
    const packageJson = JSON.parse(output);
    packageJson.name = options.name;
    if (options.description) packageJson.description = options.description;
    if (!features.has("batch")) delete packageJson.scripts["batch:run"];
    if (!features.has("sst")) {
      delete packageJson.scripts["dev:sst"];
      delete packageJson.scripts["env:pull"];
      delete packageJson.scripts["env:push"];
      delete packageJson.scripts["sst:ws"];
      delete packageJson.scripts["test:sst"];
    }
    output = `${JSON.stringify(packageJson, undefined, 2)}\n`;
  }

  if (!features.has("auth")) {
    if (relativePath === "packages/trpc/src/trpc.ts") {
      output = output
        .replace(/import type \{ Permission \} from "[^"]+\/auth";\n/, "")
        .replace(/import \{ hasPermission \} from "[^"]+\/auth";\n/, "")
        .replace(
          /import \{ createDatabaseUserProvisioning \} from "\.\/adaptors\/auth-user";\n/,
          "",
        )
        .replace(
          /export const protectedProcedure = t\.procedure[\s\S]*$/,
          "export const protectedProcedure = publicProcedure;\n",
        );
    }
    if (relativePath === "packages/trpc/src/context.ts") {
      output = output
        .replace(
          /import type \{ AuthSession, TRPCAuth \} from "[^"]+\/auth";\n/,
          "",
        )
        .replace("  authApi: TRPCAuth;\n", "")
        .replace("  session: AuthSession | null;\n", "");
    }
    if (relativePath === "packages/trpc/src/composition/create-context.ts") {
      output = output
        .replace(
          /import \{ authApi, provisionSessionUser \} from "[^"]+\/auth";\n/,
          "",
        )
        .replace(
          /import \{ createDatabaseUserProvisioning \} from "\.\.\/adaptors\/auth-user";\n/,
          "",
        )
        .replace(
          /function bootstrapAdministratorIdentities\(\) \{[\s\S]*?\n\}\n\n/,
          "",
        )
        .replace(
          / {2}const tokenSession = await authApi\.getSession[\s\S]*?\n {2}if \(session\)[\s\S]*?\n {4}\}\);\n\n/,
          "",
        )
        .replace("    authApi,\n", "")
        .replace("    session,\n", "");
    }
    if (relativePath === "packages/trpc/src/root.ts") {
      output = output
        .replace('import { authRouter } from "./router/auth";\n', "")
        .replace("  auth: authRouter,\n", "");
    }
    if (relativePath === "packages/trpc/src/contract.test.ts") {
      output = output
        .replace('["auth", "file", "post"]', '["file", "post"]')
        .replace(
          '    expect(procedureNames(AppRouter._def.record.auth)).toEqual(["me"]);\n',
          "",
        );
    }
    if (relativePath === "packages/trpc/src/router/post.ts") {
      output = output
        .replace(/import \{ Permission \} from "[^"]+\/auth";\n/, "")
        .replace(
          'import { permissionProcedure, publicProcedure } from "../trpc";',
          'import { publicProcedure } from "../trpc";',
        )
        .replace(
          'import { protectedProcedure, publicProcedure } from "../trpc";',
          'import { publicProcedure } from "../trpc";',
        )
        .replaceAll(
          "permissionProcedure(Permission.POST_WRITE)",
          "publicProcedure",
        )
        .replaceAll("protectedProcedure", "publicProcedure");
    }
    if (relativePath === "packages/trpc/src/router/file.ts") {
      output = output
        .replace(/import \{ Permission \} from "[^"]+\/auth";\n/, "")
        .replace(
          'import { permissionProcedure } from "../trpc";',
          'import { publicProcedure } from "../trpc";',
        )
        .replace(
          "permissionProcedure(Permission.POST_WRITE)",
          "publicProcedure",
        );
    }
    if (relativePath === "packages/trpc/src/router/auth.ts") {
      output =
        'import type { TRPCRouterRecord } from "@trpc/server";\n\nimport { publicProcedure } from "../trpc";\n\nexport const authRouter = {\n  me: publicProcedure.query(() => null),\n} satisfies TRPCRouterRecord;\n';
    }
    if (relativePath === "apps/web/src/app/layout.tsx") {
      output = output
        .replace('import { OidcAuthProvider } from "~/auth/provider";\n', "")
        .replace("          <OidcAuthProvider>\n", "")
        .replace("          </OidcAuthProvider>\n", "");
    }
    if (relativePath === "apps/web/src/app/page.tsx") {
      output = output
        .replace('import { AuthStatus } from "~/auth/status";\n', "")
        .replace("        <AuthStatus />\n", "");
    }
    if (relativePath === "apps/web/src/components/blog/app-shell.tsx") {
      output = output
        .replace('import { AuthStatus } from "~/auth/status";\n', "")
        .replace("            <AuthStatus compact />\n", "");
    }
    if (relativePath === "apps/web/src/auth/status.tsx") {
      output = "export function AuthStatus() {\n  return null;\n}\n";
    }
    if (
      relativePath ===
      "apps/web/src/components/authorization/permission-gate.tsx"
    ) {
      output = `export const Permission = { POST_WRITE: "post:write" } as const;\n\nexport function PermissionGate(props: { children: React.ReactNode; fallback?: React.ReactNode; permission?: unknown }) {\n  return props.children;\n}\n`;
    }
    if (relativePath === "apps/web/src/trpc/react.tsx") {
      output = output
        .replace('import { useAuth } from "~/auth/provider";\n', "")
        .replace(/ {2}const \{ user \} = useAuth\(\);\n\n?/, "")
        .replace(
          / {12}headers\(\) \{\n {14}const headers = new Headers\(\);\n {14}if \(user\?\.access_token && !user\.expired\) \{\n {16}headers\.set\("Authorization", `Bearer \$\{user\.access_token\}`\);\n {14}\}\n {14}return headers;\n {12}\},/,
          "            headers: () => new Headers(),",
        )
        .replace("    [user],", "    [],");
    }
    if (
      options.prune &&
      (relativePath === "apps/web/src/env.ts" ||
        relativePath === "packages/env/src/env-client.ts")
    ) {
      output = removeOidcClientEnvironment(output);
    }
    if (options.prune && relativePath === "packages/env/src/index.ts") {
      output = output
        .replace(
          / {2}OIDC_ISSUER_URL:[\s\S]*? {2}OIDC_ALLOWED_ALGORITHMS: serverEnv\.OIDC_ALLOWED_ALGORITHMS \?\? "RS256",\n/,
          "",
        )
        .replace(
          / {2}NEXT_PUBLIC_OIDC_AUTHORITY:[\s\S]*? {2}NEXT_PUBLIC_OIDC_SCOPE: clientEnv\.NEXT_PUBLIC_OIDC_SCOPE,\n/,
          "",
        );
    }
    if (
      options.prune &&
      relativePath === "packages/db-backbone/src/schema.ts"
    ) {
      output = output.replace('export * from "./schemas/auth";\n', "");
    }
    if (
      options.prune &&
      relativePath === "packages/db-backbone/drizzle/meta/_journal.json"
    ) {
      const journal = JSON.parse(output);
      journal.entries = journal.entries.filter(
        (entry) => entry.tag !== "0001_auth-users",
      );
      output = `${JSON.stringify(journal, undefined, 2)}\n`;
    }
  }

  if (
    !features.has("example-ui") &&
    relativePath === "apps/web/src/app/page.tsx"
  ) {
    const authImport = features.has("auth")
      ? 'import { AuthStatus } from "~/auth/status";\n'
      : "";
    const authStatus = features.has("auth") ? "      <AuthStatus />\n" : "";
    output = `"use client";\n\n${authImport}import { env } from "~/env";\n\nexport default function HomePage() {\n  return (\n    <main className="container py-16">\n${authStatus}      <h1 className="text-4xl font-bold">${resolveDisplayName(options)}</h1>\n      <p className="text-muted-foreground mt-4">\n        API: {env.NEXT_PUBLIC_API_URL}\n      </p>\n    </main>\n  );\n}\n`;
  }

  if (
    !features.has("example-ui") &&
    relativePath === "apps/web/src/app/layout.tsx"
  ) {
    output = output
      .replace('import { AppShell } from "~/components/blog/app-shell";\n', "")
      .replace("<AppShell>{props.children}</AppShell>", "{props.children}");
  }

  if (relativePath === "apps/web/src/config/site.ts") {
    output = output.replace(
      /shortName: "[A-Z0-9]{1,4}"/,
      `shortName: ${JSON.stringify(displayInitials(resolveDisplayName(options)))}`,
    );
  }

  if (relativePath === "template.features.json") {
    output = `${JSON.stringify(
      {
        name: options.name,
        displayName: resolveDisplayName(options),
        scope: options.scope,
        domain: options.domain ?? null,
        preset: options.preset ?? "full",
        features: [...features],
      },
      undefined,
      2,
    )}\n`;
  }
  if (/(^|\/)package\.json(?:\.hbs)?$/.test(relativePath)) {
    if (options.prune) output = prunePackageJson(relativePath, output, options);
    output = sortDependencyKeys(output);
  }
  if (
    options.prune &&
    !features.has("sst") &&
    (relativePath === "apps/web/tsconfig.json" ||
      relativePath === "apps/api/tsconfig.json")
  ) {
    const tsconfig = JSON.parse(output);
    if (Array.isArray(tsconfig.include)) {
      tsconfig.include = tsconfig.include.filter(
        (path) => !path.startsWith("sst") && !path.includes("/sst"),
      );
    }
    output = `${JSON.stringify(tsconfig, undefined, 2)}\n`;
  }
  return output;
}

function trackedFiles(root) {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

function assertClean(root) {
  const status = execFileSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  });
  if (status.trim())
    throw new Error(
      "Working tree is not clean. Commit changes or pass --force.",
    );
}

export async function initializeTemplate(options, runtime = {}) {
  validateOptions(options);
  const root = resolve(runtime.root ?? process.cwd());
  if (!options.dryRun && !options.force && !runtime.files) assertClean(root);
  const files = runtime.files ?? trackedFiles(root);
  const changed = [];

  for (const relativePath of files) {
    const path = resolve(root, relativePath);
    const buffer = await readFile(path);
    if (buffer.includes(0)) continue;
    const source = buffer.toString("utf8");
    const output = transformContent(relativePath, source, options);
    if (source === output) continue;
    changed.push(relativePath);
    if (!options.dryRun) await writeFile(path, output, "utf8");
  }
  for (const relativePath of pathsToPrune(options)) {
    changed.push(`delete:${relativePath}`);
    if (!options.dryRun) {
      await rm(resolve(root, relativePath), { recursive: true, force: true });
    }
  }
  return changed;
}

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isCli) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const changed = await initializeTemplate(options);
    console.log(
      `${options.dryRun ? "Would update" : "Updated"} ${changed.length} files:`,
    );
    for (const file of changed) console.log(`- ${file}`);
    if (!options.dryRun)
      console.log(
        "Run pnpm install, pnpm check:fix, pnpm test, and pnpm typecheck next.",
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "pnpm template:init -- --name my-app --scope @company [--display-name 'My App'] [--preset full|minimal] [--features auth,batch,sst,example-ui] [--prune] [--description text] [--domain example.org] [--dry-run] [--force]",
    );
    process.exitCode = 1;
  }
}
