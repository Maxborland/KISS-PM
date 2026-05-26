import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectAdminDashboardReady, loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("Workspace shell accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, { password: "local-admin-password" });
    await expectAdminDashboardReady(page);
  });

  test("dashboard has no critical axe violations", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('[data-testid="role-dashboard-panel"]')
      .analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });

  test("projects portfolio strip has no critical axe violations", async ({ page }) => {
    await page.getByRole("button", { name: "Проекты" }).click();
    await page.getByTestId("portfolio-timeline").waitFor();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="portfolio-timeline"]')
      .analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });
});
