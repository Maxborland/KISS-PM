import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { loginAsAdmin, openFirstProjectSchedule } from "./planningHelpers";

test.describe("Planning accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openFirstProjectSchedule(page);
  });

  test("schedule workspace has no critical axe violations", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('[data-testid="planning-workspace"]')
      .analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });
});
