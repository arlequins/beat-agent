import { expect, test } from "@playwright/test";

const pages = [{ name: "dashboard", path: "/" }] as const;

for (const pageCase of pages) {
  test(`${pageCase.name} matches the responsive visual baseline`, async ({
    page,
  }) => {
    await page.goto(pageCase.path);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("main")).toBeVisible();
    await expect(page).toHaveScreenshot(`${pageCase.name}.png`, {
      animations: "disabled",
      fullPage: false,
    });
  });
}
