import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project detail task due date update persists after reload", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation");
  await expect(page.getByRole("heading", { name: "Школа на 600 мест — реконструкция" })).toBeVisible();

  const taskRow = page.getByRole("row", { name: /Обмерить существующие классы/ });
  await expect(taskRow).toBeVisible();

  const dueInput = taskRow.getByLabel("Срок задачи Обмерить существующие классы");
  const currentDueDate = await dueInput.inputValue();
  const targetDueDate = currentDueDate === "2026-06-09" ? "2026-06-10" : "2026-06-09";

  await dueInput.fill(targetDueDate);
  await dueInput.blur();
  await expect(dueInput).toHaveValue(targetDueDate);

  const changedScreenshotPath = testInfo.outputPath("runtime-project-detail-task-due-changed.png");
  await page.screenshot({ fullPage: true, path: changedScreenshotPath });
  expect(statSync(changedScreenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  await expect(page.getByRole("row", { name: /Обмерить существующие классы/ }).getByLabel(
    "Срок задачи Обмерить существующие классы"
  )).toHaveValue(targetDueDate);
});
