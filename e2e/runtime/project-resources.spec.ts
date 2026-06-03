import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const adminCredentials = {
  email: "admin@kiss-pm.local",
  password: "admin12345"
};

test("project resources shows live missing role demand without demo fallback", async ({ page }, testInfo) => {
  const login = await page.request.post("/api/auth/login", {
    data: adminCredentials
  });
  expect(login.status()).toBe(200);

  await page.goto("/projects/project-beta-school-renovation/resources");

  await expect(page.getByRole("heading", { name: /Ресурсная загрузка/ })).toBeVisible();
  await expect(page.getByRole("table", { name: /Дневная матрица ресурсов/ })).toBeVisible();
  await expect(page.locator('[data-row-id="role-missing-position-interior-designer"]')).toContainText(
    "Дизайнер интерьеров"
  );
  await expect(page.locator('[data-row-id="role-missing-position-interior-designer"]')).toContainText(
    "Не закрыта"
  );
  await expect(page.locator(".rmatrix__cell--load-high").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Изменить назначения" })).toBeDisabled();
  await expect(page.getByText("Изменение назначений пока недоступно")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("mock");

  const screenshotPath = testInfo.outputPath("runtime-project-resources-missing-role.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  expect(statSync(screenshotPath).size).toBeGreaterThan(8_000);
});
