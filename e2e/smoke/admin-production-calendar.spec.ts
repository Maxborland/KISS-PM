import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

/* Возврат из карантина (e2e/quarantine/admin/production-calendar.spec.ts):
   страница живёт на /admin/production-calendar (вкладка «Произв. календарь», Н3),
   а не /settings/production-calendar. Кнопки «Применить пресет» в живом UI нет —
   контракт другой: базовый режим недели + исключения (GET ?year, POST /bulk).
   Живые якоря: production-calendar-page, production-calendar-grid,
   production-calendar-add-exception, production-calendar-exception-dialog.
   Исключение НЕ сохраняем: ручки удаления в API нет — мутация не была бы
   повторяемой; проверяем открытие формы и отмену. */

test.describe("production calendar", () => {
  test("admin opens tenant production calendar, switches year and opens the exception form", async ({ page }) => {
    await page.goto("/");
    await loginToWorkspace(page, {
      email: "admin@kiss-pm.local",
      password: "admin12345"
    });

    await page.goto("/admin/production-calendar");
    await expect(page.getByTestId("production-calendar-page")).toBeVisible();
    await expect(page.getByTestId("production-calendar-grid")).toBeVisible();

    // Селектор года — живой: смена года перезагружает календарь.
    const nextYear = String(new Date().getUTCFullYear() + 1);
    await page.getByTestId("production-calendar-page").locator("select").selectOption(nextYear);
    await expect(page.getByTestId("production-calendar-grid")).toBeVisible();

    // Форма исключения открывается (мутацию не выполняем — см. шапку файла).
    await page.getByTestId("production-calendar-add-exception").click();
    const dialog = page.getByTestId("production-calendar-exception-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[type="date"]')).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Отмена" }).click();
    await expect(dialog).toHaveCount(0);
  });
});
