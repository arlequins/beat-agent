#!/usr/bin/env node

import { chromium } from "@playwright/test";

const [webInput, apiInput, authorityInput, mode] = process.argv.slice(2);

function smokeEnv(name) {
  return process.env[name];
}

const email = smokeEnv("PRODUCTION_AUTH_SMOKE_EMAIL");
const password = smokeEnv("PRODUCTION_AUTH_SMOKE_PASSWORD");
const workspaceId = smokeEnv("PRODUCTION_AUTH_SMOKE_WORKSPACE_ID");

if (
  !webInput ||
  !apiInput ||
  !authorityInput ||
  !email ||
  !password ||
  !workspaceId ||
  !["disabled", "enabled"].includes(mode)
) {
  throw new Error(
    "Usage: PRODUCTION_AUTH_SMOKE_EMAIL=... PRODUCTION_AUTH_SMOKE_PASSWORD=... PRODUCTION_AUTH_SMOKE_WORKSPACE_ID=... node scripts/authenticated-production-smoke.mjs WEB_URL API_URL OIDC_AUTHORITY disabled|enabled",
  );
}

function httpsUrl(value, label) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  return url;
}

const web = httpsUrl(webInput, "WEB_URL");
const api = httpsUrl(apiInput, "API_URL");
const authority = httpsUrl(authorityInput, "OIDC_AUTHORITY");
if (!authority.pathname.replace(/\/+$/, "").endsWith("/auth")) {
  throw new Error("OIDC_AUTHORITY must end in /auth");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(web.toString(), { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Beat 시작하기", exact: true })
    .click();

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.waitForURL(
    (url) =>
      url.origin === web.origin &&
      url.pathname.replace(/\/+$/, "") === web.pathname.replace(/\/+$/, ""),
    { timeout: 30_000 },
  );
  await page.getByTestId("api-session").getByText("연결됨").waitFor({
    state: "visible",
    timeout: 30_000,
  });

  const storageKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith("oidc.user:")),
  );
  if (storageKeys.length === 0) {
    throw new Error("OIDC user session was not persisted in browser storage");
  }

  const workspaceSelect = page.locator("select").first();
  await workspaceSelect.waitFor({ state: "visible", timeout: 30_000 });
  await workspaceSelect.selectOption(workspaceId);
  if ((await workspaceSelect.inputValue()) !== workspaceId) {
    throw new Error(
      "Configured smoke workspace was not available to the test user",
    );
  }

  await page.getByRole("button", { name: "새 대화", exact: true }).click();
  const question = page.getByLabel("질문", { exact: true });
  await question.waitFor({ state: "visible", timeout: 30_000 });
  const messagesBefore = await page.locator("article").count();
  await question.fill(
    "운영 인증 스모크 테스트입니다. 현재 모델 상태만 알려주세요.",
  );
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  if (mode === "disabled") {
    await page
      .getByRole("alert")
      .filter({ hasText: "Ollama에 연결하지 못했습니다." })
      .waitFor({ state: "visible", timeout: 30_000 });
  } else {
    await page.waitForFunction(
      (before) => {
        const messages = Array.from(document.querySelectorAll("article"));
        return (
          messages.length > before + 1 &&
          !(messages.at(-1)?.textContent ?? "").includes("생성 중…")
        );
      },
      messagesBefore,
      { timeout: 60_000 },
    );
  }

  console.log(
    JSON.stringify(
      {
        api: api.origin,
        checks: [
          "oidc.login",
          "oidc.local-storage-session",
          "workspace.selection",
          "conversation.send",
          `model.${mode}`,
        ],
        web: web.origin + web.pathname,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
