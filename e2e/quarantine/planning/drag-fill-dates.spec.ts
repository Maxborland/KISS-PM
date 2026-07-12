import { expect, test } from "@playwright/test";

import { loginAsAdmin, openFirstProjectSchedule } from "../../planning/planningHelpers";

test.describe("Planning drag-fill", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openFirstProjectSchedule(page);
  });

  test("fills finish dates downward", async ({ page }) => {
    const grid = page.getByTestId("planning-wbs-grid");
    await grid.click();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("F2");
    await page.keyboard.type("26.05");
    await page.keyboard.press("Enter");
    const handle = page.getByTestId("planning-drag-fill-handle").first();
    await handle.dispatchEvent("mousedown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await handle.dispatchEvent("mouseup");
    await expect(grid).toContainText("27.05");
    await expect(grid).toContainText("28.05");
  });
});
