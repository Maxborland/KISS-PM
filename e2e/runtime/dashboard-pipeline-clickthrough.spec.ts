import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("dashboard pipeline pressure links to the live deal detail route", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/dashboard");

  const pipelineLink = page.getByRole("link", {
    name: "Открыть сделку: Школа на 600 мест — реконструкция"
  });
  await expect(pipelineLink).toHaveAttribute("href", "/deals/opportunity-beta-school-renovation");

  const screenshotPath = testInfo.outputPath("runtime-dashboard-pipeline-clickthrough.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(20_000);

  await pipelineLink.click();
  await expect(page).toHaveURL(/\/deals\/opportunity-beta-school-renovation$/);
  await expect(page.getByText("Школа на 600 мест — реконструкция", { exact: true })).toBeVisible();
});
