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
  await expect(
    page.getByRole("heading", { exact: true, name: "Beat" }),
  ).toBeVisible();
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

  await page.getByText("로컬 지식 추가", { exact: true }).click();
  await page.getByLabel("문서 이름").fill(`notes-${suffix}.txt`);
  await page
    .getByLabel("문서 내용")
    .fill("Beat는 Arlequin의 개인 비서이며 답변에 근거를 표시한다.");
  await page.getByRole("button", { name: "문서 등록" }).click();
  await expect(page.getByText(`notes-${suffix}.txt`)).toBeVisible();

  await page.getByText("기억 후보 추가", { exact: true }).click();
  await page
    .getByLabel("기억 내용")
    .fill("사용자는 기본적으로 한국어 답변을 선호한다.");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(
    page.getByText("사용자는 기본적으로 한국어 답변을 선호한다."),
  ).toBeVisible();
  await page.getByRole("button", { name: "승인" }).click();
  await expect(page.getByText(/approved · 중요도/)).toBeVisible();
});

test("sends a question, renders its citation, and records feedback", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  await page.goto("/");
  await signIn(page, `chat-${suffix}`);

  await page.getByLabel("워크스페이스 이름").fill(`Chat ${suffix}`);
  await page.getByRole("button", { name: "만들기" }).click();
  await expect(page.locator("select")).toContainText(`Chat ${suffix}`);
  await page.getByRole("button", { name: "새 대화" }).click();
  await expect(page.getByLabel("질문")).toBeEnabled();

  await page.getByText("로컬 지식 추가", { exact: true }).click();
  await page.getByLabel("문서 이름").fill(`chat-notes-${suffix}.txt`);
  await page
    .getByLabel("문서 내용")
    .fill("Beat는 Arlequin의 개인 비서이며 답변에 근거를 표시한다.");
  await page.getByRole("button", { name: "문서 등록" }).click();
  await expect(page.getByText(`chat-notes-${suffix}.txt`)).toBeVisible();

  const question = page.getByLabel("질문");
  await question.fill("Beat는 누구의 개인 비서인가요?");
  await question.press("Control+Enter");

  const answer = page.locator("article").filter({ hasText: "테스트 응답:" });
  await expect(answer).toContainText("Beat는 누구의 개인 비서인가요?");
  await expect(answer.getByText("인용 1개")).toBeVisible();
  await answer.getByRole("button", { name: "도움됨" }).click();
  await expect(page.getByRole("status")).toContainText(
    "도움됨 피드백을 기록했습니다.",
  );

  await page.reload();
  await expect(
    page.locator("article").filter({ hasText: "테스트 응답:" }),
  ).toContainText("Beat는 누구의 개인 비서인가요?");
});
