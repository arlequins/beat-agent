import { expect, test } from "@playwright/test";

test("publishes a mobile-installable PWA without caching private routes", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  await expect(manifestResponse.json()).resolves.toMatchObject({
    display: "standalone",
    lang: "ko",
    scope: "/",
    start_url: "/",
  });

  for (const icon of [
    "/icons/beat-192.png",
    "/icons/beat-512.png",
    "/icons/beat-maskable-512.png",
  ]) {
    const response = await request.get(icon);
    expect(response.status(), `${icon} should be available`).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }

  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.status()).toBe(200);
  const worker = await workerResponse.text();
  expect(worker).toContain('url.pathname.startsWith("/auth/")');
  expect(worker).toContain('url.pathname.startsWith("/admin/")');
  expect(worker).toContain('url.pathname.startsWith("/api/")');
  expect(worker).not.toContain("localStorage");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
