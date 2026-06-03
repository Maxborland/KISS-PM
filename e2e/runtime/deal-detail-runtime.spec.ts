import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("deal detail persists next action and opens linked project handoff", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  const opportunityId = "opportunity-beta-school-renovation";
  const nextAction = `Подтвердить выпуск по реконструкции ${Date.now()}`;

  await page.goto(`/deals/${opportunityId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Сделка" })).toBeVisible();
  await expect(page.getByText("Школа на 600 мест — реконструкция", { exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("ГК Северный квартал");
  await expect(page.locator("body")).toContainText("Потребность в ролях");
  await expect(page.locator("body")).toContainText("Подтвердить риск по ресурсам и передать в проект");

  const saveResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "PATCH" &&
      response.url().includes(`/api/workspace/opportunities/${opportunityId}`) &&
      response.ok()
    );
  });
  const nextActionInput = page.getByLabel("Следующее действие по сделке");
  await nextActionInput.fill(nextAction);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await saveResponse;
  await expect(page.locator("body")).toContainText(nextAction);

  const screenshotPath = testInfo.outputPath("runtime-deal-detail.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);

  await page.reload();
  await expect(page.getByLabel("Следующее действие по сделке")).toHaveValue(nextAction);

  await page.getByRole("button", { name: "Передать в проект" }).click();
  await page.getByRole("button", { name: "Подтвердить передачу" }).click();
  await expect(page.getByRole("link", { name: "Открыть проект" })).toBeVisible();
  await page.getByRole("link", { name: "Открыть проект" }).click();
  await expect(page).toHaveURL(/\/projects\/project-beta-school-renovation$/);
  await expect(page.getByRole("heading", { level: 1, name: "Школа на 600 мест — реконструкция" })).toBeVisible();
});
