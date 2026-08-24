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
const smokeAccessToken = process.env.BEAT_SSO_SMOKE_ACCESS_TOKEN?.trim();
const smokeAuthority = process.env.BEAT_SSO_SMOKE_AUTHORITY?.trim();

const googleAuthorizationPaths = new Set([
  "/o/oauth2/v2/auth",
  "/v3/signin/identifier",
]);

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
      googleAuthorizationPaths.has(url.pathname),
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
  if (smokeAccessToken) {
    if (!smokeAuthority)
      throw new Error(
        "BEAT_SSO_SMOKE_AUTHORITY is required with an access token",
      );
    const authority = new URL(smokeAuthority);
    if (authority.protocol !== "https:")
      throw new Error("BEAT_SSO_SMOKE_AUTHORITY must use HTTPS");
    const sessions = await fetch(
      `${authority.toString().replace(/\/$/u, "")}/sessions`,
      {
        headers: { Authorization: `Bearer ${smokeAccessToken}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!sessions.ok)
      throw new Error(
        `Authenticated session check failed (${sessions.status})`,
      );
    const payload = await sessions.json();
    if (!Array.isArray(payload.sessions))
      throw new Error("Authenticated session response is invalid");
  }
  console.log(
    JSON.stringify(
      {
        checks: [
          "agent.oidc",
          "beat.google-redirect",
          ...(smokeAccessToken ? ["beat.authenticated-sessions"] : []),
        ],
        google: google.origin,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
