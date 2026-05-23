import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("Settings accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, { password: "local-admin-password" });
  });

  test("workspace settings has no critical axe violations", async ({ page }) => {
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.waitForURL("**/settings**");
    const results = await new AxeBuilder({ page }).include("main").analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });

  test("profile help panel has no critical axe violations", async ({ page }) => {
    await page.getByRole("button", { name: "Профиль" }).click();
    await page.getByTestId("workspace-help-panel").waitFor();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="workspace-help-panel"]')
      .analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });
});
