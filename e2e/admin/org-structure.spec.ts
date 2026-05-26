import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("org structure", () => {
  test("admin configures structure, placement and saves", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "local-admin-password"
    });

    await page.goto("/settings/org-structure");
    await expect(page.getByTestId("org-structure-page")).toBeVisible();

    await page.getByRole("button", { name: "Добавить направление" }).click();
    await page.getByRole("button", { name: "+ Отдел" }).first().click();

    const placementRow = page.locator(".org-structure-placement-row").first();
    await placementRow.locator("select").nth(0).selectOption({ index: 1 });
    await placementRow.locator("select").nth(1).selectOption({ index: 1 });

    await page.getByTestId("org-structure-save").click();
    await expect(page.getByText("Сохранено")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("org-structure-track-functional")).toBeVisible();
    await expect(page.getByTestId("org-structure-track-functional")).toContainText("Новое направление");
  });
});
