import { expect, test } from "@playwright/test";

test("E2E-002 seeded demo tenant can be loaded without external services", async ({ page }) => {
  await page.goto("/?testUser=tenant-admin-a");

  await expect(page.getByTestId("tenant-indicator")).toHaveText("Демо-тенант: Студия A");
  await expect(page.getByTestId("fixture-summary")).toContainText("Тенант A");
  await expect(page.getByTestId("fixture-summary")).toContainText("Тенант B");
  await expect(page.getByTestId("external-services-note")).toHaveText(
    "Внешние сервисы не используются в smoke-режиме."
  );
});

test("E2E-002 tenant context follows the fixture user", async ({ page }) => {
  await page.goto("/?testUser=tenant-admin-b");

  await expect(page.getByTestId("tenant-indicator")).toHaveText("Демо-тенант: Студия B");
  await expect(page.getByText("Тестовый пользователь: Администратор B")).toBeVisible();
});
