import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

/* Возврат из карантина (e2e/quarantine/admin/absences.spec.ts): страница живёт
   на /admin/absences (вкладка «Отсутствия» админки, Н3), а не /settings/absences.
   Живые якоря: absences-page, absence-create-open, absence-create-dialog
   (сотрудник теперь обязателен), absence-cell-{userId}-{dateFrom}.
   После проверки — удаление через ConfirmDialog, чтобы прогон был повторяемым. */

const ADMIN_USER_ID = "user-alpha-admin";

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

test.describe("absences", () => {
  test("admin creates absence, sees it in the table and removes it", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "admin12345"
    });

    await page.goto("/admin/absences");
    await expect(page.getByTestId("absences-page")).toBeVisible();
    await page.getByTestId("absence-create-open").click();
    const dialog = page.getByTestId("absence-create-dialog");
    await expect(dialog).toBeVisible();

    const from = isoDay(50);
    const to = isoDay(52);

    // Боевой контракт: сотрудник обязателен (select «Сотрудник» — первый в диалоге).
    await dialog.locator("select").first().selectOption(ADMIN_USER_ID);
    await dialog.locator('input[type="date"]').nth(0).fill(from);
    await dialog.locator('input[type="date"]').nth(1).fill(to);
    await page.getByRole("dialog").getByRole("button", { name: "Сохранить" }).click();

    await expect(page.getByTestId("absences-table")).toBeVisible();
    const cell = page.getByTestId(`absence-cell-${ADMIN_USER_ID}-${from}`);
    await expect(cell.first()).toBeVisible();

    // Чистим за собой: удаление живёт только за ConfirmDialog.
    await page.locator("tr").filter({ has: cell.first() }).getByRole("button").click();
    const confirm = page.getByRole("dialog").filter({ hasText: "Удалить отсутствие" });
    await confirm.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByText("Отсутствие удалено").first()).toBeVisible();
  });
});
