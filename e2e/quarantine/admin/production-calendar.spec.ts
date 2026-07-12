import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../../smoke/smokeHelpers";

test.describe("production calendar", () => {
  test("admin opens tenant production calendar and loads RF preset", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "admin12345"
    });

    await page.goto("/settings/production-calendar");
    await expect(page.getByTestId("production-calendar-page")).toBeVisible();
    await page.getByRole("button", { name: "Применить пресет" }).click();
    await expect(page.getByTestId("production-calendar-grid")).toBeVisible();
  });
});
