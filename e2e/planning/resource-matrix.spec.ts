import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("resource matrix", () => {
  test("planning resources tab shows monthly matrix", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "local-admin-password"
    });

    await page.goto("/projects/project-alpha/resources");
    await expect(page.getByTestId("planning-resource-matrix")).toBeVisible();
    await expect(page.getByTestId("planning-resource-matrix-nav")).toBeVisible();
  });
});
