import { expect, test } from "@playwright/test";

import { loginAsAdmin, openFirstProjectSchedule } from "../../planning/planningHelpers";

test.describe("Planning excel paste", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openFirstProjectSchedule(page);
  });

  test("pastes 10x6 TSV block", async ({ page }) => {
    const rows = Array.from({ length: 10 }, (_, rowIndex) =>
      Array.from({ length: 6 }, (_, colIndex) => `R${rowIndex + 1}C${colIndex + 1}`).join("\t")
    ).join("\n");
    await page.evaluate(async (tsv) => {
      await navigator.clipboard.writeText(tsv);
    }, rows);
    await page.getByTestId("planning-workspace").click();
    await page.keyboard.press("Control+v");
    await expect(page.getByTestId("planning-wbs-grid").locator("tbody tr")).toHaveCount(10, {
      timeout: 20_000
    });
  });
});
