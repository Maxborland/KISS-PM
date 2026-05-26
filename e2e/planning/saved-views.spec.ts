import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("saved views", () => {
  test("wbs grid exposes saved views dropdown", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "local-admin-password"
    });

    await page.goto("/projects/project-alpha/schedule");
    await expect(page.getByTestId("saved-views-dropdown")).toBeVisible();
  });
});
