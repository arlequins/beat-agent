#!/usr/bin/env node

import { chromium } from "@playwright/test";

const [webInput] = process.argv.slice(2);
if (!webInput) {
  throw new Error(
    "Usage: node scripts/google-sso-production-smoke.mjs WEB_URL",
  );
}

const web = new URL(webInput);
if (web.protocol !== "https:") throw new Error("WEB_URL must use HTTPS");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(web.toString(), { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Beat 시작하기", exact: true })
    .click();
  await page.waitForURL(
    (url) =>
      url.origin === "https://accounts.google.com" &&
      url.pathname === "/o/oauth2/v2/auth",
    { timeout: 30_000 },
  );
  const google = new URL(page.url());
  for (const key of ["client_id", "redirect_uri", "state", "nonce"]) {
    if (!google.searchParams.get(key))
      throw new Error(`Google authorization URL is missing ${key}`);
  }
  if (
    !google.searchParams.get("redirect_uri")?.endsWith("/auth/google/callback")
  )
    throw new Error("Google redirect URI must end in /auth/google/callback");
  console.log(
    JSON.stringify(
      { checks: ["agent.oidc", "beat.google-redirect"], google: google.origin },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
