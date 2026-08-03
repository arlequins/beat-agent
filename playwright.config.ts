import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const e2eEnv = Object.fromEntries(
  readFileSync(".env.e2e", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator <= 0) throw new Error(`Invalid .env.e2e line: ${line}`);
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

Object.assign(process.env, e2eEnv);
const webServerEnv = { ...process.env, ...e2eEnv };

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.12,
    },
  },
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @arlequins/oidc-mock start",
      env: webServerEnv,
      url: "http://localhost:5557/.well-known/openid-configuration",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @arlequins/api start",
      env: webServerEnv,
      url: "http://localhost:5100/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @arlequins/web exec next dev --port 3100",
      env: webServerEnv,
      url: "http://localhost:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
