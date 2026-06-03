import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project detail shows blocker through task status model without fake mutation", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation");

  await expect(page.getByRole("heading", { level: 1, name: "Школа на 600 мест — реконструкция" })).toBeVisible();
  await expect(page.getByText("Блокер: используйте статус «Ожидает».").first()).toBeVisible();
  await expect(page.getByText("Блокер: задача уже во внимании.").first()).toBeVisible();

  const screenshotPath = testInfo.outputPath("runtime-project-detail-blocker-gap.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(statSync(screenshotPath).size).toBeGreaterThan(20_000);
});
