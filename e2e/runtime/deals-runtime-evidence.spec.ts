import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("deals pipeline filters live deals and opens runtime detail sheet", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/deals");
  await expect(page.getByRole("heading", { level: 1, name: "Сделки" })).toBeVisible();
  await expect(page.locator('[data-item-id="opportunity-beta-school-renovation"]')).toBeVisible();
  await expect(page.locator('[data-item-id="opportunity-beta-office-fitout"]')).toBeVisible();

  await page.getByText("Список", { exact: true }).click();
  const search = page.getByPlaceholder("Сделки, клиенты…");
  await search.fill("надзор");

  await expect(page.getByText("Фонд Музей города — авторский надзор")).toBeVisible();
  await expect(page.getByText("Школа на 600 мест — реконструкция")).toHaveCount(0);

  const screenshotPath = testInfo.outputPath("runtime-deals-list-filtered.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

  await page.getByLabel("Открыть сделку opportunity-beta-office-fitout").click();
  await expect(page.getByRole("heading", { level: 2, name: "Фонд Музей города — авторский надзор" })).toBeVisible();
  await expect(page.locator("body")).toContainText("Елена Орлова");

  await page.getByText("Закрыть", { exact: true }).click();
  await search.fill("нет такой сделки");
  await expect(page.getByText("Ничего не найдено по текущему поиску.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Сделка");
});
