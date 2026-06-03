import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("my work task owner and due date persist after reload", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const taskId = "task-beta-school-survey";
  const taskTitle = "Обмерить существующие классы";

  await page.goto(`/my-work?taskId=${taskId}`);

  const taskDrawer = page.getByRole("dialog");
  await expect(taskDrawer.getByRole("heading", { level: 1, name: taskTitle })).toBeVisible();

  const dueInput = taskDrawer.getByLabel(`Срок задачи ${taskTitle}`);
  const currentDueDate = await dueInput.inputValue();
  const targetDueDate = currentDueDate === "2026-06-09" ? "2026-06-10" : "2026-06-09";

  const duePatch = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/workspace/tasks/${taskId}`) &&
      response.request().method() === "PATCH" &&
      response.ok()
  );
  await dueInput.fill(targetDueDate);
  await dueInput.blur();
  await duePatch;
  await expect(dueInput).toHaveValue(targetDueDate);

  const ownerSelect = taskDrawer.getByLabel(`Ответственный задачи ${taskTitle}`);
  const currentOwnerText = await ownerSelect.textContent();
  const targetOwnerName = currentOwnerText?.includes("Мария Главный архитектор")
    ? "Сергей Архитектор"
    : "Мария Главный архитектор";

  const ownerPatch = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/workspace/tasks/${taskId}`) &&
      response.request().method() === "PATCH" &&
      response.ok()
  );
  await ownerSelect.click();
  await page.getByRole("option", { name: targetOwnerName }).click();
  await ownerPatch;
  await expect(ownerSelect).toContainText(targetOwnerName);

  const screenshotPath = testInfo.outputPath("runtime-my-work-task-fields-updated.png");
  await taskDrawer.screenshot({ path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  const reloadedDrawer = page.getByRole("dialog");
  await expect(reloadedDrawer.getByLabel(`Срок задачи ${taskTitle}`)).toHaveValue(targetDueDate);
  await expect(reloadedDrawer.getByLabel(`Ответственный задачи ${taskTitle}`)).toContainText(targetOwnerName);
});
