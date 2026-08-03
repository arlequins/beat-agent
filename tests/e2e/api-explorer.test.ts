import { expect, test } from "@playwright/test";

test("executes an API request from the hosted explorer", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "The full request console is qualified once on desktop Chromium.",
  );
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

  await page.goto(`${apiUrl}/docs#tag/examples`);
  await expect(page).toHaveTitle("Application API Explorer");
  await page.getByRole("button", { name: /Show More/ }).click();
  await page
    .getByRole("button", { name: /Test Request.*post \/api\/echo/ })
    .click();

  const dialog = page.getByRole("dialog");
  const send = dialog
    .locator("button")
    .filter({ hasText: "Send Request" })
    .last();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url() === `${apiUrl}/api/echo`,
  );
  await send.click();
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    message: "Hello from the API explorer",
  });
  await expect(dialog.getByText("200 OK")).toBeVisible();
  await expect(
    dialog
      .getByTestId("response-body-raw")
      .getByText("Hello from the API explorer"),
  ).toBeVisible();
});
