import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("my work task status change persists after reload @my-work-status-action", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const taskId = "task-beta-school-survey";
  const taskTitle = "Обмерить существующие классы";
  const targetStatus = "На контроле";

  await page.goto(`/my-work?taskId=${taskId}`);

  const taskDrawer = page.getByRole("dialog");
  await expect(taskDrawer.getByRole("heading", { level: 1, name: taskTitle })).toBeVisible();

  const statusSelect = taskDrawer.getByLabel(`Статус задачи ${taskTitle}`);
  await expect(statusSelect).toBeVisible();
  await expect(statusSelect).toContainText("В работе");

  const statusPatch = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "PATCH" &&
      response.url().includes(`/api/workspace/projects/project-beta-school-renovation/tasks/${taskId}/status`)
    );
  });

  await statusSelect.click();
  await page.getByRole("option", { name: targetStatus }).click();
  await expect((await statusPatch).status()).toBe(200);

  await expect(statusSelect).toContainText(targetStatus);

  const screenshotPath = testInfo.outputPath("runtime-my-work-task-status-changed.png");
  await taskDrawer.screenshot({ path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  await expect(page.getByRole("dialog").getByLabel(`Статус задачи ${taskTitle}`)).toContainText(targetStatus);
});
