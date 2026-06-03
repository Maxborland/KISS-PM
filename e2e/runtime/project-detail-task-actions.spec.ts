import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project detail task status update persists after reload", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation");
  await expect(page.getByRole("heading", { name: "Школа на 600 мест — реконструкция" })).toBeVisible();

  const taskRow = page.getByRole("row", { name: /Обмерить существующие классы/ });
  await expect(taskRow).toBeVisible();

  const currentText = await taskRow.textContent();
  const targetStatus = currentText?.includes("На контроле") ? "В работе" : "На контроле";
  await taskRow.getByLabel("Статус задачи Обмерить существующие классы").click();
  await page.getByRole("option", { name: targetStatus }).click();

  await expect(taskRow).toContainText(targetStatus);

  const changedScreenshotPath = testInfo.outputPath("runtime-project-detail-task-status-changed.png");
  await page.screenshot({ fullPage: true, path: changedScreenshotPath });
  expect(statSync(changedScreenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  await expect(page.getByRole("row", { name: /Обмерить существующие классы/ })).toContainText(targetStatus);
});
