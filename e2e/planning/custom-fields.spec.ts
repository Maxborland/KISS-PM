import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("custom wbs fields", () => {
  test("project settings shows custom field definitions", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "local-admin-password"
    });

    await page.goto("/projects/project-alpha/settings");
    await expect(
      page.getByTestId("custom-field-definitions").or(page.getByTestId("custom-fields-empty"))
    ).toBeVisible();
  });
});
