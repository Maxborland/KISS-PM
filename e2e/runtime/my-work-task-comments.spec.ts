import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("my work task comment persists in task activity after reload", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const taskId = "task-beta-school-survey";
  const comment = `QA комментарий из Моей работы ${Date.now()}`;

  await page.goto(`/my-work?taskId=${taskId}`);

  const taskDrawer = page.getByRole("dialog");
  await expect(taskDrawer.getByRole("heading", { level: 1, name: "Обмерить существующие классы" })).toBeVisible();
  await expect(taskDrawer.getByText("Согласовать ТЗ")).toHaveCount(0);
  await expect(taskDrawer.getByText("DataHub KPI")).toHaveCount(0);

  await taskDrawer.getByLabel("Комментарий к задаче").fill(comment);
  await taskDrawer.getByRole("button", { name: "Отправить" }).click();

  const createdComment = taskDrawer.getByText(comment);
  await expect(createdComment).toBeVisible();
  await createdComment.scrollIntoViewIfNeeded();

  const screenshotPath = testInfo.outputPath("runtime-my-work-task-comment-created.png");
  await taskDrawer.screenshot({ path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  await expect(page.getByRole("dialog").getByText(comment)).toBeVisible();
});
