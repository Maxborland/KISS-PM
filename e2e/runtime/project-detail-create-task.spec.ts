import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project detail task create persists after reload", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const taskTitle = `QA задача из проекта ${Date.now()}`;

  await page.goto("/projects/project-beta-school-renovation");
  await expect(page.getByRole("heading", { name: "Школа на 600 мест — реконструкция" })).toBeVisible();

  await page.getByLabel("Название").fill(taskTitle);
  await page.getByLabel("Срок").fill("2026-06-07");
  await page.getByRole("button", { name: "Создать задачу" }).click();

  await expect(page.getByRole("row", { name: new RegExp(taskTitle) })).toBeVisible();

  const createdScreenshotPath = testInfo.outputPath("runtime-project-detail-task-created.png");
  await page.screenshot({ fullPage: true, path: createdScreenshotPath });
  expect(statSync(createdScreenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  await expect(page.getByRole("row", { name: new RegExp(taskTitle) })).toBeVisible();
});
