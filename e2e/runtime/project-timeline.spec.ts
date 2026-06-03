import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project timeline renders live project tasks without demo fallback", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation/timeline");

  await expect(page.getByRole("heading", { name: /Гант · Школа на 600 мест/ })).toBeVisible();
  await expect(page.getByRole("grid", { name: /Диаграмма Ганта/ })).toBeVisible();
  await expect(page.getByText("Обмерить существующие классы")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Разработать концепцию");
  await expect(page.locator("body")).not.toContainText("mock");

  const screenshotPath = testInfo.outputPath("runtime-project-timeline.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);
});
