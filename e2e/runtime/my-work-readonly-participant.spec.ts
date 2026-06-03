import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const architectCredentials = {
  email: "architect@kiss-pm.local",
  password: "architect12345"
};

test("my work participant sees read-only task fields but can add an activity comment", async ({
  page
}, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: architectCredentials
  });
  expect(login.status()).toBe(200);

  const taskId = "task-beta-school-survey";
  const taskTitle = "Обмерить существующие классы";
  const comment = `Комментарий архитектора без прав РП ${Date.now()}`;

  await page.goto("/my-work");

  const taskCard = page.getByLabel(new RegExp(`Открыть карточку ${taskId}: ${taskTitle}`));
  await expect(taskCard).toBeVisible();
  await taskCard.click();

  const taskDrawer = page.getByRole("dialog");
  await expect(taskDrawer.getByRole("heading", { level: 1, name: taskTitle })).toBeVisible();
  await expect(taskDrawer).toContainText("Ответственного и срок меняет руководитель проекта.");
  await expect(taskDrawer.getByLabel(`Статус задачи ${taskTitle}`)).toHaveCount(0);
  await expect(taskDrawer.getByLabel(`Ответственный задачи ${taskTitle}`)).toHaveCount(0);
  await expect(taskDrawer.getByLabel(`Срок задачи ${taskTitle}`)).toHaveCount(0);

  const screenshotPath = testInfo.outputPath("runtime-my-work-readonly-participant-comment.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

  const commentPost = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "POST" &&
      response.url().includes(`/api/workspace/tasks/${taskId}/comments`) &&
      response.ok()
    );
  });
  await taskDrawer.getByLabel("Комментарий к задаче").fill(comment);
  await taskDrawer.getByRole("button", { name: "Отправить" }).click();
  await commentPost;

  await page.reload();
  const reopenedCard = page.getByLabel(new RegExp(`Открыть карточку ${taskId}: ${taskTitle}`));
  await expect(reopenedCard).toBeVisible();
  await reopenedCard.click();
  await expect(page.getByRole("dialog").getByText(comment)).toBeVisible();
});
