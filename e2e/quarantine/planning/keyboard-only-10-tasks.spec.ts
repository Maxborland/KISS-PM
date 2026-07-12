import { expect, test } from "@playwright/test";

import { loginAsAdmin, openFirstProjectSchedule } from "../../planning/planningHelpers";

test.describe("Planning keyboard-only task creation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openFirstProjectSchedule(page);
  });

  test("creates 10 tasks using keyboard only", async ({ page }) => {
    const grid = page.getByTestId("planning-wbs-grid");
    await grid.click();
    for (let index = 1; index <= 10; index += 1) {
      await page.keyboard.press("Insert");
      await page.keyboard.press("F2");
      await page.keyboard.type(`Задача ${index}`);
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowDown");
    }
    await expect(grid.locator("tbody tr")).toHaveCount(10, { timeout: 15_000 });
  });
});
