import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("CRM accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, { password: "local-admin-password" });
  });

  test("opportunities list has no critical axe violations", async ({ page }) => {
    await page.getByRole("button", { name: "Сделки" }).click();
    await page.waitForURL("**/opportunities");
    const results = await new AxeBuilder({ page }).include("main").analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });

  test("opportunity form dialog has no critical axe violations", async ({ page }) => {
    await page.getByRole("button", { name: "Сделки" }).click();
    await page.waitForURL("**/opportunities");
    await page.getByRole("button", { name: "Создать сделку" }).click();
    await page.getByRole("dialog").waitFor();
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });
});
