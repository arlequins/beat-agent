import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import type { PlopTypes } from "@turbo/gen";

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

function packageScope() {
  const packageJson = JSON.parse(
    readFileSync("packages/ui/package.json", "utf8"),
  ) as { name: string };
  return packageJson.name.slice(0, packageJson.name.indexOf("/"));
}

function sanitizeName(value: string) {
  const scope = packageScope();
  const name = value.startsWith(`${scope}/`)
    ? value.slice(scope.length + 1)
    : value;
  if (!SLUG_PATTERN.test(name)) {
    throw new Error("Name must be a lowercase kebab-case slug");
  }
  return name;
}

function camelCase(value: string) {
  return value.replace(/-([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
}

function pascalCase(value: string) {
  const camel = camelCase(value);
  return camel[0]?.toUpperCase() + camel.slice(1);
}

function scaffoldActions(kind: "apps" | "packages") {
  const template = kind === "apps" ? "app" : "package";
  return [
    {
      type: "add",
      path: `${kind}/{{ name }}/package.json`,
      templateFile: `templates/${template}/package.json.hbs`,
    },
    {
      type: "add",
      path: `${kind}/{{ name }}/tsconfig.json`,
      templateFile: `templates/${template}/tsconfig.json.hbs`,
    },
    {
      type: "add",
      path: `${kind}/{{ name }}/src/index.ts`,
      templateFile: `templates/${template}/index.ts.hbs`,
    },
    () => {
      execFileSync("pnpm", ["install", "--no-frozen-lockfile"], {
        stdio: "inherit",
      });
      return `${kind === "apps" ? "Application" : "Package"} scaffolded`;
    },
  ];
}

function addDomainToContract(domain: string) {
  const path = "packages/trpc/src/contract.test.ts";
  const source = readFileSync(path, "utf8");
  const match =
    source.match(/expect\(names\)\.toEqual\((\[[\s\S]*?\])\)/) ??
    source.match(/expect\.arrayContaining\((\[[^\]]+\])\)/);
  if (!match?.[1]) throw new Error("Unable to update the tRPC contract test");
  const routers = [...match[1].matchAll(/"([^"]+)"/g)].flatMap((entry) =>
    entry[1] ? [entry[1]] : [],
  );
  const next = [...new Set([...routers, camelCase(domain)])].sort();
  writeFileSync(path, source.replace(match[1], JSON.stringify(next)), "utf8");
}

function exportFeatureFromService(name: string) {
  const path = "packages/service/src/index.ts";
  const pascalName = pascalCase(name);
  const additions = [
    `export type { ${pascalName}Input, ${pascalName}Result } from "./domain/${name}";`,
    `export type { ${pascalName}Port } from "./application/ports/${name}-port";`,
    `export type { ${pascalName}Service } from "./application/use-cases/${name}";`,
    `export { create${pascalName}Service } from "./application/use-cases/${name}";`,
  ];
  const source = readFileSync(path, "utf8");
  writeFileSync(path, `${source.trimEnd()}\n${additions.join("\n")}\n`, "utf8");
}

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setHelper("scope", packageScope);
  plop.setHelper("camelCase", camelCase);
  plop.setHelper("pascalCase", pascalCase);
  plop.setHelper("procedure", (kind: string) =>
    kind === "query" ? "query" : "mutation",
  );

  const namePrompt = {
    type: "input" as const,
    name: "name",
    message: "Name (lowercase kebab-case)",
    filter: sanitizeName,
  };

  plop.setGenerator("app", {
    description: "Generate a TypeScript application workspace",
    prompts: [namePrompt],
    actions: scaffoldActions("apps"),
  });

  plop.setGenerator("package", {
    description: "Generate a compiled TypeScript package workspace",
    prompts: [namePrompt],
    actions: scaffoldActions("packages"),
  });

  plop.setGenerator("domain", {
    description: "Generate a DIP-aligned tRPC domain module",
    prompts: [namePrompt],
    actions: [
      ...[
        ["types/{{ name }}.ts", "types.ts.hbs"],
        ["services/ports/{{ name }}-port.ts", "port.ts.hbs"],
        ["services/{{ name }}/index.ts", "service.ts.hbs"],
        ["adaptors/{{ name }}.ts", "adaptor.ts.hbs"],
        ["usecases/composition/{{ name }}-deps.ts", "composition.ts.hbs"],
        ["usecases/{{ name }}/index.ts", "usecase.ts.hbs"],
        ["router/{{ name }}.ts", "router.ts.hbs"],
      ].map(([path, template]) => ({
        type: "add",
        path: `packages/trpc/src/${path}`,
        templateFile: `templates/domain/${template}`,
      })),
      {
        type: "modify",
        path: "packages/trpc/src/root.ts",
        pattern: /import \{ createTRPCRouter \} from "\.\/trpc";/,
        template:
          'import { {{ camelCase name }}Router } from "./router/{{ name }}";\nimport { createTRPCRouter } from "./trpc";',
      },
      {
        type: "modify",
        path: "packages/trpc/src/root.ts",
        pattern: /export const AppRouter = createTRPCRouter\(\{\n/,
        template:
          "export const AppRouter = createTRPCRouter({\n  {{ camelCase name }}: {{ camelCase name }}Router,\n",
      },
      (answers) => {
        const name = sanitizeName(String(answers.name));
        addDomainToContract(name);
        execFileSync("pnpm", ["check:fix"], { stdio: "inherit" });
        return "Domain module scaffolded and registered";
      },
    ],
  });

  plop.setGenerator("feature", {
    description: "Generate a clean-architecture command or query slice",
    prompts: [
      namePrompt,
      {
        type: "list",
        name: "kind",
        message: "Operation kind",
        choices: ["command", "query"],
        default: "command",
      },
    ],
    actions: [
      ...[
        ["domain/{{ name }}.ts", "domain.ts.hbs"],
        ["application/ports/{{ name }}-port.ts", "port.ts.hbs"],
        ["application/use-cases/{{ name }}.ts", "usecase.ts.hbs"],
        ["{{ name }}.test.ts", "test.ts.hbs"],
      ].map(([path, template]) => ({
        type: "add",
        path: `packages/service/src/${path}`,
        templateFile: `templates/feature/${template}`,
      })),
      ...[
        ["adaptors/{{ name }}.ts", "adaptor.ts.hbs"],
        ["composition/{{ name }}.ts", "composition.ts.hbs"],
        ["router/{{ name }}.ts", "router.ts.hbs"],
      ].map(([path, template]) => ({
        type: "add",
        path: `packages/trpc/src/${path}`,
        templateFile: `templates/feature/${template}`,
      })),
      {
        type: "modify",
        path: "packages/trpc/src/root.ts",
        pattern: /import \{ createTRPCRouter \} from "\.\/trpc";/,
        template:
          'import { {{ camelCase name }}Router } from "./router/{{ name }}";\nimport { createTRPCRouter } from "./trpc";',
      },
      {
        type: "modify",
        path: "packages/trpc/src/root.ts",
        pattern: /export const AppRouter = createTRPCRouter\(\{\n/,
        template:
          "export const AppRouter = createTRPCRouter({\n  {{ camelCase name }}: {{ camelCase name }}Router,\n",
      },
      (answers) => {
        const name = sanitizeName(String(answers.name));
        exportFeatureFromService(name);
        addDomainToContract(name);
        execFileSync("pnpm", ["check:fix"], { stdio: "inherit" });
        execFileSync("pnpm", ["architecture:check"], { stdio: "inherit" });
        return "Feature slice scaffolded, registered, and checked";
      },
    ],
  });

  plop.setGenerator("slice", {
    description: "Generate a web Feature-Sliced Design layer",
    prompts: [
      namePrompt,
      {
        type: "list",
        name: "layer",
        message: "Web layer",
        choices: ["entities", "features", "widgets"],
        default: "features",
      },
    ],
    actions: [
      {
        type: "add",
        path: "apps/web/src/{{ layer }}/{{ name }}/index.ts",
        templateFile: "templates/slice/index.ts.hbs",
      },
      {
        type: "add",
        path: "apps/web/src/{{ layer }}/{{ name }}/README.md",
        templateFile: "templates/slice/README.md.hbs",
      },
      () => {
        execFileSync("pnpm", ["architecture:check"], { stdio: "inherit" });
        return "Web slice scaffolded and architecture checked";
      },
    ],
  });
}
