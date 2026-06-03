import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project timeline task due date update persists after reload", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation/timeline");
  await expect(page.getByRole("heading", { name: "Гант · Школа на 600 мест — реконструкция" })).toBeVisible();

  await page.getByLabel("Задача для изменения срока").click();
  await page.getByRole("option", { name: "Обмерить существующие классы" }).click();

  const dueDateInput = page.getByLabel("Новый финиш задачи");
  await expect(dueDateInput).toHaveValue(/2026-05-0[8-9]|2026-05-10/);
  await expect(dueDateInput).toBeVisible();

  const currentDueDate = await dueDateInput.inputValue();
  const targetDueDate = currentDueDate === "2026-05-10" ? "2026-05-09" : "2026-05-10";
  await dueDateInput.fill(targetDueDate);
  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      /\/api\/workspace\/tasks\/task-beta-school-survey$/.test(response.url())
  );
  await page.getByRole("button", { name: "Обновить срок" }).click();
  expect((await updateResponse).status()).toBe(200);

  await page.getByLabel("Задача для изменения срока").click();
  await page.getByRole("option", { name: "Обмерить существующие классы" }).click();
  await expect(dueDateInput).toHaveValue(targetDueDate);

  const changedScreenshotPath = testInfo.outputPath("runtime-project-timeline-date-changed.png");
  await page.screenshot({ fullPage: true, path: changedScreenshotPath });
  expect(statSync(changedScreenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  await page.getByLabel("Задача для изменения срока").click();
  await page.getByRole("option", { name: "Обмерить существующие классы" }).click();
  await expect(page.getByLabel("Новый финиш задачи")).toHaveValue(targetDueDate);

  await page.goto("/projects/project-beta-school-renovation");
  await expect(page.getByLabel("Срок задачи Обмерить существующие классы")).toHaveValue(targetDueDate);
});
