import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("cross-project drilldown", () => {
  test("resource matrix cell opens day drawer", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "admin12345"
    });

    await page.goto("/projects/project-alpha/resources");
    const cell = page.locator("[data-testid^='resource-matrix-cell-']").first();
    await expect(cell).toBeVisible({ timeout: 15_000 });
    await cell.click();
    await expect(page.getByTestId("resource-day-drawer")).toBeVisible();
  });
});
