#!/usr/bin/env node

const [webInput, apiInput, authorityInput] = process.argv.slice(2);

if (!webInput || !apiInput || !authorityInput) {
  throw new Error(
    "Usage: node scripts/smoke-production.mjs WEB_URL API_URL OIDC_AUTHORITY",
  );
}

const timeoutMs = 10_000;

function httpsUrl(value, label) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  return url;
}

function appendPath(base, path) {
  const url = new URL(base);
  const basePath = url.pathname.replace(/\/+$/, "");
  const suffix = path.replace(/^\/+/, "");
  url.pathname = suffix ? `${basePath}/${suffix}` : `${basePath}/`;
  url.search = "";
  url.hash = "";
  return url;
}

async function get(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { body: await response.text(), response };
}

async function expectOk(url, label, init = {}) {
  const result = await get(url, init);
  if (!result.response.ok) {
    throw new Error(`${label} returned HTTP ${result.response.status}`);
  }
  return result;
}

function parseJson(body, label) {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
}

function requireHttpsEndpoint(metadata, key) {
  if (typeof metadata[key] !== "string") {
    throw new Error(`OIDC discovery is missing ${key}`);
  }
  httpsUrl(metadata[key], `OIDC ${key}`);
}

const web = httpsUrl(webInput, "WEB_URL");
const api = httpsUrl(apiInput, "API_URL");
const authority = httpsUrl(authorityInput, "OIDC_AUTHORITY");
const checks = [];

const homepage = await expectOk(appendPath(web, ""), "GitHub Pages home");
if (!homepage.response.headers.get("content-type")?.includes("text/html")) {
  throw new Error("GitHub Pages home did not return HTML");
}
checks.push("pages.home");

const manifest = await expectOk(
  appendPath(web, "manifest.webmanifest"),
  "PWA manifest",
);
const manifestJson = parseJson(manifest.body, "PWA manifest");
const projectPath = appendPath(web, "").pathname;
if (manifestJson.display !== "standalone") {
  throw new Error("PWA manifest must use standalone display mode");
}
if (
  manifestJson.scope !== projectPath ||
  manifestJson.start_url !== projectPath
) {
  throw new Error("PWA manifest paths do not match the Pages project path");
}
checks.push("pages.manifest");

await expectOk(appendPath(web, "sw.js"), "PWA service worker");
checks.push("pages.service-worker");

for (const path of ["auth/callback/", "auth/logout-callback/"]) {
  await expectOk(appendPath(web, path), `Pages ${path}`);
  checks.push(`pages.${path.replaceAll("/", "")}`);
}

const webOrigin = web.origin;
const live = await expectOk(appendPath(api, "health/live"), "API liveness", {
  headers: { Origin: webOrigin },
});
if (parseJson(live.body, "API liveness").status !== "ok") {
  throw new Error("API liveness did not report ok");
}
if (live.response.headers.get("access-control-allow-origin") !== webOrigin) {
  throw new Error("API CORS does not allow the GitHub Pages origin");
}
checks.push("api.live-and-cors");

const ready = await expectOk(appendPath(api, "health/ready"), "API readiness");
if (parseJson(ready.body, "API readiness").status !== "ok") {
  throw new Error("API readiness did not report ok");
}
checks.push("api.ready");

const discovery = await expectOk(
  appendPath(authority, ".well-known/openid-configuration"),
  "OIDC discovery",
  { headers: { Accept: "application/json" } },
);
const metadata = parseJson(discovery.body, "OIDC discovery");
const normalizedIssuer = authority.toString().replace(/\/$/, "");
if (metadata.issuer !== normalizedIssuer) {
  throw new Error(
    "OIDC discovery issuer does not match the configured authority",
  );
}
for (const key of [
  "authorization_endpoint",
  "token_endpoint",
  "jwks_uri",
  "end_session_endpoint",
]) {
  requireHttpsEndpoint(metadata, key);
}
checks.push("oidc.discovery");

console.log(
  JSON.stringify(
    {
      api: api.origin,
      authority: authority.origin,
      checks,
      web: web.origin + web.pathname,
    },
    null,
    2,
  ),
);
