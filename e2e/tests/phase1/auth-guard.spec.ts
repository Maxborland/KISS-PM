import { expect, test } from "@playwright/test";

test("E2E-003 unauthenticated user is blocked according to test auth design", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("auth-guard")).toBeVisible();
  await expect(page.getByText("Войдите в тестовый режим")).toBeVisible();
  await expect(page.getByTestId("app-shell")).toBeHidden();
});

test("E2E-003 unknown test user is blocked by deterministic fixture auth", async ({ page }) => {
  await page.goto("/?testUser=unknown-user");

  await expect(page.getByTestId("auth-guard")).toBeVisible();
  await expect(page.getByTestId("app-shell")).toBeHidden();
});
