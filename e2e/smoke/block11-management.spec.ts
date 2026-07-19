import { expect, test, type Page } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

/* ============================================================
   Блок 11 «Управленческий контур и жизненный цикл проекта»: смоуки.
   1. Контур управления: /projects/:id/control — вкладка, KPI-панель,
      сигналы (или честный empty-state).
   2. База знаний: создание документа → появление в списке → деталь.
   3. Закрытие проекта: секция в настройках, preview → отмена
      (сам close на seed-проекте НЕ выполняется).
   4. Загрузка ресурсов: /capacity из сайдбара, матрица или честный
      empty-state.
   5. Админ-операции: отсутствия (создать + удалить), произв. календарь,
      фоновые задачи.
   6. Авто-солвер в Scenarios: «Рассчитать» даёт persisted run
      (карточка предложения или честный «нет предложений»).
   Анкеры — seed-данные scripts/seed-dev.ts (tenant-alpha).
   ============================================================ */

const PROJECT_ID = "project-demo-crm-intake";
const ADMIN_USER_ID = "user-alpha-admin";

async function login(page: Page) {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
}

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

test("control loop surface shows KPI panel and signals on the project tab", async ({ page }) => {
  await login(page);
  await page.goto(`/projects/${PROJECT_ID}/control`);

  // Вкладка «Контур» в шапке проекта — живая и активная.
  const tab = page.getByRole("link", { name: "Контур", exact: true });
  await expect(tab).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("heading", { name: "Контур управления" })).toBeVisible();
  await expect(page.getByTestId("control-kpi-panel")).toBeVisible();

  // Сигналы: карточки или честный empty-state — оба валидны для смоука.
  await expect(
    page.getByTestId("control-signal-card").first().or(page.getByText("Сигналов нет", { exact: true }))
  ).toBeVisible();
});

test("knowledge base creates a document and opens it in the detail panel", async ({ page }) => {
  await login(page);
  await page.goto(`/projects/${PROJECT_ID}/knowledge`);

  const tab = page.getByRole("link", { name: "Знания", exact: true });
  await expect(tab).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "База знаний проекта" })).toBeVisible();

  // Кнопка «Документ» есть и в шапке списка, и в empty-state — путь один.
  const title = `Смоук-документ ${Date.now().toString(36)}`;
  const body = `Содержимое смоук-документа ${title}`;
  await page.getByRole("button", { name: "Документ", exact: true }).first().click();

  const dialog = page.getByRole("dialog", { name: "Новый документ" });
  await dialog.getByLabel("Название").fill(title);
  await dialog.getByLabel("Содержимое").fill(body);
  await dialog.getByRole("button", { name: "Создать" }).click();

  // Документ появился в списке; открываем его.
  const row = page.getByTestId("knowledge-document-row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.click();

  const detail = page.getByTestId("knowledge-document-detail");
  await expect(detail.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByTestId("knowledge-version-body")).toContainText(body);
});

test("project settings show the closure section with preview and cancel", async ({ page }) => {
  await login(page);
  await page.goto(`/projects/${PROJECT_ID}/settings`);

  await expect(page.getByText("Закрытие проекта", { exact: true })).toBeVisible();
  const closure = page.getByTestId("closure-open");
  await expect(closure).toBeVisible();

  // Preview открывается; сам close на seed-проекте не выполняем — отмена.
  await closure.getByTestId("closure-prepare").click();
  const preview = closure.getByTestId("closure-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByText("Предпросмотр закрытия", { exact: true })).toBeVisible();

  await closure.getByRole("button", { name: "Отмена" }).click();
  await expect(preview).toHaveCount(0);
  await expect(closure.getByTestId("closure-prepare")).toBeVisible();
});

test("capacity surface opens from the sidebar and renders the resource matrix", async ({ page }) => {
  await login(page);
  await page.goto("/my-work");

  await page.getByRole("link", { name: "Загрузка", exact: true }).click();
  await expect(page).toHaveURL(/\/capacity$/);
  await expect(page.getByRole("heading", { name: "Загрузка ресурсов" })).toBeVisible();

  // Матрица ресурсов × дни или честный empty-state месяца без нагрузки.
  await expect(
    page.getByRole("table").or(page.getByText("Нет данных о загрузке", { exact: true })).first()
  ).toBeVisible();
});

test("admin operations pages open; absence is created and deleted", async ({ page }) => {
  await login(page);

  // «Отсутствия»: создание через FormDialog и удаление через подтверждение.
  await page.goto("/admin/absences");
  await expect(page.getByTestId("absences-page")).toBeVisible();

  const from = isoDay(40);
  const to = isoDay(42);
  await page.getByTestId("absence-create-open").click();
  const createDialog = page.getByTestId("absence-create-dialog");
  await expect(createDialog).toBeVisible();
  await createDialog.locator("select").first().selectOption(ADMIN_USER_ID);
  await createDialog.locator('input[type="date"]').nth(0).fill(from);
  await createDialog.locator('input[type="date"]').nth(1).fill(to);
  await page.getByRole("dialog").getByRole("button", { name: "Сохранить" }).click();

  const cell = page.getByTestId(`absence-cell-${ADMIN_USER_ID}-${from}`);
  await expect(cell.first()).toBeVisible();

  // Удаление — только через ConfirmDialog.
  await page.locator("tr").filter({ has: cell.first() }).getByRole("button").click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Удалить отсутствие" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByText("Отсутствие удалено").first()).toBeVisible();

  // «Произв. календарь»: базовый режим недели + грид исключений.
  await page.goto("/admin/production-calendar");
  await expect(page.getByTestId("production-calendar-page")).toBeVisible();
  await expect(page.getByTestId("production-calendar-grid")).toBeVisible();

  // «Фоновые задачи»: таблица прогонов или честный empty-state.
  await page.goto("/admin/background-jobs");
  await expect(page.getByTestId("background-jobs-page")).toBeVisible();
  await expect(
    page.getByTestId("background-jobs-table").or(page.getByText("Прогонов пока нет", { exact: true }))
  ).toBeVisible();
});

test("auto-solver in scenarios produces a persisted run with proposals", async ({ page }) => {
  await login(page);
  await page.goto(`/projects/${PROJECT_ID}/scenarios`);

  const section = page.getByTestId("solver-section");
  await expect(section).toBeVisible();

  await section.getByTestId("solver-run").click();

  // Расчёт — серверный persisted run; ждём результат щедро.
  await expect(
    page.locator('[data-testid^="solver-card-"]').first().or(page.getByTestId("solver-empty"))
  ).toBeVisible({ timeout: 60_000 });

  // Run сохранён на сервере: TTL-чип подтверждает persisted-предложение.
  await expect(section.getByTestId("solver-ttl")).toBeVisible();
});
