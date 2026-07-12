import { expect, test, type Page } from "@playwright/test";

import {
  deactivateStaleSmokeOpportunityFields,
  getRequiredOpportunityCustomFieldValues,
  loginToWorkspace
} from "./smokeHelpers";

// Dashboard grammar (PR9): summary-first сводка на реальных сигналах.
// Сверху — «Требует внимания» (просроченные задачи/сделки), каждый сигнал —
// drill-down к причине (/my-work?task=, /crm/deals?deal=); декоративные блоки
// (плейсхолдер «Встречи и сигналы», плитка «Сделки выиграны») удалены и не рендерятся.

const attentionSection = (page: Page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: "Требует внимания" }) });

// Просроченная задача через реальный контракт POST /api/workspace/tasks (inbox-задача).
// Даты фиксированно в прошлом (2024) → сигнал «Задача просрочена» первый в группе
// (сортировка по plannedFinish asc). Уборка — статус done (сигнал гаснет).
async function createOverdueTask(page: Page) {
  const suffix = Date.now().toString(36);
  const title = `Просроченная задача e2e ${suffix}`;
  const response = await page.request.post("/api/workspace/tasks", {
    data: {
      id: `dash-overdue-task-e2e-${suffix}`,
      title,
      description: "E2E проверка сигналов дашборда",
      plannedStart: "2024-01-08",
      plannedFinish: "2024-01-12",
      durationWorkingDays: 5,
      plannedWork: 10,
      participants: [{ userId: "user-alpha-admin", role: "executor" }]
    },
    headers: { "x-kiss-pm-action": "same-origin" }
  });
  expect(response.status()).toBe(201);
  const payload = (await response.json()) as { task: { id: string }; project: { id: string } };
  return { id: payload.task.id, projectId: payload.project.id, title };
}

// Просроченная открытая сделка (plannedFinish в прошлом) — паттерн crm-deal-peek.
async function createOverdueDeal(page: Page) {
  const suffix = Date.now().toString(36);
  const id = `dash-overdue-deal-e2e-${suffix}`;
  const title = `Просроченная сделка e2e ${suffix}`;
  await deactivateStaleSmokeOpportunityFields(page);
  const customFieldValues = await getRequiredOpportunityCustomFieldValues(page);
  const response = await page.request.post("/api/workspace/opportunities", {
    data: {
      id,
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-new",
      title,
      description: "E2E проверка сигналов дашборда",
      plannedStart: "2024-02-01",
      plannedFinish: "2024-02-15",
      contractValue: 240000,
      plannedHourlyRate: 4000,
      probability: 20,
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 30 }],
      customFieldValues
    },
    headers: { "x-kiss-pm-action": "same-origin" }
  });
  expect(response.status()).toBe(201);
  return { id, title };
}

test("dashboard is summary-first: real signals drill down to task and deal, no decorative blocks", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  const task = await createOverdueTask(page);
  const deal = await createOverdueDeal(page);

  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");
    const main = page.getByRole("main");
    const attention = attentionSection(page);

    // Summary-first: блок сигналов виден и стоит на реальных данных.
    await expect(page.getByRole("heading", { name: "Требует внимания" })).toBeVisible();
    const taskSignal = attention.getByRole("link", {
      name: `Открыть задачу «${task.title}» в Моих задачах`,
      exact: true
    });
    await expect(taskSignal).toBeVisible();
    await expect(attention.getByText("Задача просрочена").first()).toBeVisible();

    // Ноль fake-элементов: удалённые декоративные блоки не рендерятся.
    await expect(main.getByText("Сводка встреч и сигналов дня появится")).toHaveCount(0);
    await expect(main.getByText("Сделки выиграны")).toHaveCount(0);
    await expect(main.getByText("появится в одном из следующих обновлений")).toHaveCount(0);

    // Drill-down сигнала задачи: /my-work?task=<id> + открытый peek с этой задачей.
    await taskSignal.click();
    await expect(page).toHaveURL(new RegExp(`/my-work\\?task=${task.id}$`));
    await expect(page.getByRole("dialog").getByRole("heading", { name: task.title })).toBeVisible();

    // Drill-down сигнала сделки: /crm/deals?deal=<id> + открытый peek сделки.
    await page.goto("/dashboard");
    const dealSignal = attention.getByRole("link", {
      name: `Открыть сделку «${deal.title}» в CRM`,
      exact: true
    });
    await expect(dealSignal).toBeVisible();
    await expect(attention.getByText("Сделка просрочена").first()).toBeVisible();
    await dealSignal.click();
    await expect(page).toHaveURL(new RegExp(`/crm/deals\\?deal=${deal.id}$`));
    await expect(page.getByRole("dialog").getByRole("heading", { name: deal.title })).toBeVisible();

    // KPI-плитка — ссылка к источнику, работает с клавиатуры (видимый фокус + Enter).
    await page.goto("/dashboard");
    const tasksTile = main.getByRole("link", { name: /Мои задачи/ });
    await expect(tasksTile).toBeVisible();
    await expect(tasksTile.getByText(/просрочено/)).toBeVisible();
    await tasksTile.focus();
    await expect(tasksTile).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/my-work$/);

    // Остальные плитки тоже ведут к источникам.
    await page.goto("/dashboard");
    await expect(main.getByRole("link", { name: /Открытые сделки/ })).toHaveAttribute("href", "/crm/deals");
    await expect(main.getByRole("link", { name: /Активные проекты/ })).toHaveAttribute("href", "/projects");
    await expect(main.getByRole("link", { name: "Все задачи", exact: true })).toHaveAttribute("href", "/my-work");
    await expect(main.getByRole("link", { name: "Все сделки", exact: true })).toHaveAttribute("href", "/crm/deals");

    // Мобильная ширина 390px: сводка видима, без горизонтального скролла.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Требует внимания" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(0);
  } finally {
    // Failure-safe уборка: сигнал задачи гасим статусом done, сделку закрываем как
    // проигранную; повторный финал уже закрытой сделки отдаёт 409/422 — допустимо.
    const taskCleanup = await page.request.patch(
      `/api/workspace/projects/${task.projectId}/tasks/${task.id}/status`,
      {
        data: { statusId: "task-status-done" },
        headers: { "x-kiss-pm-action": "same-origin" }
      }
    );
    expect([200, 404, 409]).toContain(taskCleanup.status());
    const dealCleanup = await page.request.patch(`/api/workspace/opportunities/${deal.id}/finalize`, {
      data: { status: "lost_rejected", reason: "E2E cleanup" },
      headers: { "x-kiss-pm-action": "same-origin" }
    });
    expect([200, 409, 422]).toContain(dealCleanup.status());
  }
});

test("reader without CRM sees honest partial dashboard and can drill down to a task", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await loginToWorkspace(page, {
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345"
  });

  await page.goto("/dashboard");
  const main = page.getByRole("main");
  const attention = attentionSection(page);

  // Сводка живёт на доступных источниках; недоступный CRM — честные пометки, не ошибки.
  await expect(page.getByRole("heading", { name: "Требует внимания" })).toBeVisible();
  await expect(
    main.getByText("Сигналы по сделкам не рассчитываются: раздел недоступен вашей роли.")
  ).toBeVisible();
  await expect(main.getByText("Сделки недоступны вашей роли.")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  // CRM-плитка честно без ссылки («—» / нет доступа), задачи и проекты — ссылки.
  await expect(main.getByRole("link", { name: /Открытые сделки/ })).toHaveCount(0);
  await expect(main.getByText("Открытые сделки")).toBeVisible();
  await expect(main.getByRole("link", { name: /Мои задачи/ })).toHaveAttribute("href", "/my-work");
  await expect(main.getByRole("link", { name: /Активные проекты/ })).toHaveAttribute("href", "/projects");

  // Сид: задача «Тестирование портала» этого пользователя просрочена (финиш 2026-07-08) —
  // реальный сигнал с drill-down в /my-work?task= и открытым peek.
  const seededSignal = attention.getByRole("link", {
    name: "Открыть задачу «Тестирование портала» в Моих задачах",
    exact: true
  });
  await expect(seededSignal).toBeVisible();
  await seededSignal.click();
  await expect(page).toHaveURL(/\/my-work\?task=task-vektor-testing$/);
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Тестирование портала" })).toBeVisible();

  // Декоративных блоков нет и под reader-ролью; консоль без непойманных исключений.
  await page.goto("/dashboard");
  await expect(main.getByText("Сводка встреч и сигналов дня появится")).toHaveCount(0);
  await expect(main.getByText("Сделки выиграны")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
