import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("projects list filters live runtime projects and opens project detail", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects");
  await expect(page.getByRole("heading", { level: 1, name: "Проекты" })).toBeVisible();
  await expect(page.getByText("Музей города — концепция экспозиции")).toBeVisible();

  const search = page.getByPlaceholder("Код или название");
  await search.fill("школа");
  await expect(page.getByText("Школа на 600 мест — реконструкция")).toBeVisible();
  await expect(page.getByText("Музей города — концепция экспозиции")).toHaveCount(0);

  const screenshotPath = testInfo.outputPath("runtime-projects-list-filtered.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

  await page.getByLabel("Открыть Школа на 600 мест — реконструкция").click();
  await expect(page).toHaveURL(/\/projects\/project-beta-school-renovation$/);
  await expect(page.getByRole("heading", { level: 1, name: "Школа на 600 мест — реконструкция" })).toBeVisible();

  await page.goto("/projects");
  await search.fill("нет такого проекта");
  await expect(page.getByText("Нет проектов по запросу")).toBeVisible();
  await expect(page.locator("body")).toContainText("Измените поиск, чтобы увидеть проекты из runtime API.");
  await expect(page.locator("body")).not.toContainText("Создать проект");
});
