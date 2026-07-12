import { expect, test } from "@playwright/test";

import { loginAsAdmin, openFirstProjectSchedule } from "../../planning/planningHelpers";

test.describe("Planning compensating undo", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openFirstProjectSchedule(page);
  });

  test("undoes applied edit with Ctrl+Shift+Z", async ({ page }) => {
    const grid = page.getByTestId("planning-wbs-grid");
    await grid.click();
    await page.keyboard.press("F2");
    await page.keyboard.type("Undo marker");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Применить" }).click();
    await expect(page.getByText("Изменения сохранены")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Control+Shift+Z");
    await expect(grid).not.toContainText("Undo marker", { timeout: 15_000 });
  });
});
