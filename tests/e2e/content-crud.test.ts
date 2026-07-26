import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, login: string) {
  await page
    .getByRole("button", { name: "Beat 시작하기", exact: true })
    .click();
  await page.getByPlaceholder("Enter any login").fill(login);
  await page.getByPlaceholder("and password").fill("local-password");
  await page.getByRole("button", { name: "Sign-in" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
}

test("creates an agent workspace and starts a conversation without horizontal overflow", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const workspaceName = `Research ${suffix}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Beat" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await signIn(page, `workspace-${suffix}`);
  await page.getByLabel("워크스페이스 이름").fill(workspaceName);
  await page.getByRole("button", { name: "만들기" }).click();
  await expect(page.locator("select")).toContainText(workspaceName);
  await page.getByRole("button", { name: "새 대화" }).click();
  await expect(page.getByRole("button", { name: "새 대화" })).toBeVisible();
  await expect(page.getByLabel("질문")).toBeEnabled();
});
