import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project detail task owner update persists after reload @project-detail-owner", async ({
  page
}, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const taskId = "task-beta-school-survey";
  const taskTitle = "Обмерить существующие классы";

  await page.goto("/projects/project-beta-school-renovation");
  await expect(page.getByRole("heading", { name: "Школа на 600 мест — реконструкция" })).toBeVisible();

  const taskRow = page.getByRole("row", { name: new RegExp(taskTitle) });
  await expect(taskRow).toBeVisible();

  const ownerSelect = taskRow.getByLabel(`Ответственный задачи ${taskTitle}`);
  const currentOwnerText = await ownerSelect.textContent();
  const targetOwnerName = currentOwnerText?.includes("Мария Главный архитектор")
    ? "Сергей Архитектор"
    : "Мария Главный архитектор";

  const ownerPatch = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "PATCH" &&
      response.ok() &&
      response.url().includes(`/api/workspace/tasks/${taskId}`)
    );
  });

  await ownerSelect.click();
  await page.getByRole("option", { name: targetOwnerName }).click();
  await ownerPatch;

  await expect(ownerSelect).toContainText(targetOwnerName);

  const changedScreenshotPath = testInfo.outputPath("runtime-project-detail-task-owner-changed.png");
  await page.screenshot({ fullPage: true, path: changedScreenshotPath });
  expect(statSync(changedScreenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  await expect(
    page.getByRole("row", { name: new RegExp(taskTitle) }).getByLabel(`Ответственный задачи ${taskTitle}`)
  ).toContainText(targetOwnerName);
});
