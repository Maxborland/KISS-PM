import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project detail task comment persists in task activity after reload", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const comment = `QA комментарий по задаче ${Date.now()}`;

  await page.goto("/projects/project-beta-school-renovation");
  await expect(page.getByRole("heading", { name: "Школа на 600 мест — реконструкция" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Активность задачи" })).toBeVisible();

  await page.getByLabel("Комментарий к задаче").fill(comment);
  await page.getByRole("button", { name: "Добавить комментарий" }).click();

  await expect(page.getByText(comment)).toBeVisible();

  const screenshotPath = testInfo.outputPath("runtime-project-detail-task-comment-created.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  await expect(page.getByText(comment)).toBeVisible();
});
