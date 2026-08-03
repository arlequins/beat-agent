import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const webSource = fileURLToPath(new URL("./apps/web/src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "~": webSource,
    },
  },
  test: {
    coverage: {
      enabled: true,
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.stories.tsx",
        "**/index.ts",
        "**/ports.ts",
        "**/types.ts",
      ],
      include: [
        "apps/api/src/adaptors/**/*.ts",
        "apps/api/src/app.ts",
        "apps/api/src/application-error.ts",
        "apps/api/src/openapi.ts",
        "apps/web/src/components/pwa-*.tsx",
        "apps/web/src/config/**/*.ts",
        "apps/web/src/lib/**/*.ts",
        "packages/agent-*/src/**/*.ts",
        "packages/auth/src/**/*.ts",
        "packages/logger/src/**/*.ts",
        "packages/s3-cache/src/**/*.ts",
        "packages/service/src/**/*.ts",
        "packages/trpc/src/application/**/*.ts",
        "packages/trpc/src/adaptors/agent-platform-s3.ts",
        "packages/trpc/src/adaptors/agent-retrieval-s3.ts",
        "packages/trpc/src/adaptors/bedrock-converse.ts",
        "packages/trpc/src/adaptors/oidc-identity.ts",
        "packages/trpc/src/adaptors/s3-json-store.ts",
        "packages/trpc/src/application-error.ts",
      ],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        branches: 75,
        functions: 75,
        lines: 75,
        statements: 75,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          exclude: [
            "**/node_modules/**",
            "apps/web/**/*.test.{ts,tsx}",
            "packages/ui/**/*.test.{ts,tsx}",
          ],
          include: ["apps/api/**/*.test.ts", "packages/**/src/**/*.test.ts"],
          name: "node",
        },
      },
      {
        extends: true,
        test: {
          environment: "jsdom",
          exclude: ["**/node_modules/**"],
          include: [
            "apps/web/**/*.test.{ts,tsx}",
            "packages/ui/**/*.test.{ts,tsx}",
          ],
          name: "browser-unit",
          setupFiles: ["./packages/ui/src/test/setup.ts"],
        },
      },
    ],
  },
});
