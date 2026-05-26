import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

test.describe("absences", () => {
  test("admin creates absence and sees it in the table", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "local-admin-password"
    });

    await page.goto("/settings/absences");
    await expect(page.getByTestId("absences-page")).toBeVisible();
    await page.getByTestId("absence-create-open").click();
    await expect(page.getByTestId("absence-create-dialog")).toBeVisible();

    const today = new Date();
    const from = formatIso(today);
    const to = formatIso(addDays(today, 2));

    await page.locator('input[type="date"]').nth(0).fill(from);
    await page.locator('input[type="date"]').nth(1).fill(to);
    await page.getByRole("button", { name: "Сохранить" }).click();

    await expect(page.getByTestId("absences-table")).toBeVisible();
    await expect(
      page.getByTestId(`absence-cell-user-alpha-admin-${from}`)
    ).toBeVisible();
  });
});

function formatIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
