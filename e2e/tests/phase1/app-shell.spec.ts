import { expect, test } from "@playwright/test";

test("E2E-004 test user can enter app shell and see navigation placeholders", async ({ page }) => {
  await page.goto("/?testUser=project-manager-a");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("primary-navigation")).toContainText("Портфель");
  await expect(page.getByTestId("primary-navigation")).toContainText("Контрольные поверхности");
  await expect(page.getByTestId("phase-scope-notice")).toContainText(
    "без продуктовых сценариев"
  );
});

