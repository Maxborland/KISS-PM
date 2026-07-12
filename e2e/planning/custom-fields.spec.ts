import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("custom wbs fields", () => {
  test("project settings shows custom field definitions", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "admin12345"
    });

    // project-vektor-portal сидируется в scripts/seed-dev.ts (project-alpha — нет).
    await page.goto("/projects/project-vektor-portal/settings");
    await expect(
      page.getByTestId("custom-field-definitions").or(page.getByTestId("custom-fields-empty"))
    ).toBeVisible();
  });
});
