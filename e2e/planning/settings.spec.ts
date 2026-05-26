import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("project planning settings", () => {
  test("pm previews calendar change", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "local-admin-password"
    });

    await page.goto("/projects/project-alpha/settings");
    await expect(page.getByTestId("planning-settings-pane")).toBeVisible();
    await page.getByLabel("Календарь проекта").click();
    await page.getByRole("option", { name: /tenant-default|производственный/i }).first().click();
    await expect(page.getByTestId("calendar-preview-summary")).toBeVisible();
  });
});
