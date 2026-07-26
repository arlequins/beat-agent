import { defineConfig, devices } from "@playwright/test";

const envCommand = "pnpm exec dotenv -e .env.e2e --";

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
      command: `${envCommand} pnpm --filter @arlequins/oidc-mock start`,
      url: "http://localhost:5557/.well-known/openid-configuration",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `${envCommand} pnpm --filter @arlequins/api start`,
      url: "http://localhost:5100/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `${envCommand} pnpm --filter @arlequins/web exec next dev --port 3100`,
      url: "http://localhost:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
