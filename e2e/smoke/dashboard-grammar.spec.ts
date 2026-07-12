import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  deactivateStaleSmokeOpportunityFields,
  getRequiredOpportunityCustomFieldValues,
  loginToWorkspace
} from "./smokeHelpers";

// Dashboard grammar (PR9): summary-first сводка на реальных сигналах.
// Сверху — «Требует внимания» (просроченные задачи/сделки, дедлайны ≤ 7 дн.),
// каждый сигнал — drill-down к причине (/my-work?task=, /crm/deals?deal=);
// декоративные блоки (плейсхолдер «Встречи и сигналы», плитка «Сделки
// выиграны») удалены и не рендерятся.

const SAME_ORIGIN = { "x-kiss-pm-action": "same-origin" } as const;

// Префиксы e2e-сущностей: по ним прибираются хвосты прошлых прогонов.
const OVERDUE_TASK_PREFIX = "Просроченная задача e2e";
const DUE_SOON_TASK_PREFIX = "Дедлайн-задача e2e";
const READER_TASK_PREFIX = "Просроченная reader-задача e2e";
const DEAL_PREFIX = "Просроченная сделка e2e";
const TASK_PREFIXES = [OVERDUE_TASK_PREFIX, DUE_SOON_TASK_PREFIX, READER_TASK_PREFIX];

const attentionSection = (page: Page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: "Требует внимания" }) });

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// aria-label сигнала включает причину и срок («Открыть задачу «X»: задача просрочена, финиш 12.01.2024») —
// матчим по префиксу с заголовком, не прибиваясь к дате.
const taskSignalName = (title: string) => new RegExp(`^Открыть задачу «${escapeRegExp(title)}»: `);
const dealSignalName = (title: string) => new RegExp(`^Открыть сделку «${escapeRegExp(title)}»: `);

// Локальный день в ISO (YYYY-MM-DD) со сдвигом — тест и приложение на одной машине.
const localIsoDay = (deltaDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Задача через реальный контракт POST /api/workspace/tasks (inbox-задача).
// executorUserId позволяет создать задачу ДЛЯ другого пользователя (reader) под админ-сессией.
async function createTask(
  api: APIRequestContext,
  input: { titlePrefix: string; plannedStart: string; plannedFinish: string; executorUserId?: string }
) {
  const suffix = Date.now().toString(36);
  const title = `${input.titlePrefix} ${suffix}`;
  const response = await api.post("/api/workspace/tasks", {
    data: {
      id: `dash-e2e-task-${suffix}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      title,
      description: "E2E проверка сигналов дашборда",
      plannedStart: input.plannedStart,
      plannedFinish: input.plannedFinish,
      durationWorkingDays: 3,
      plannedWork: 6,
      participants: [{ userId: input.executorUserId ?? "user-alpha-admin", role: "executor" }]
    },
    headers: SAME_ORIGIN
  });
  expect(response.status()).toBe(201);
  const payload = (await response.json()) as { task: { id: string } };
  return { id: payload.task.id, title };
}

// Просроченная открытая сделка (plannedFinish в прошлом) — паттерн crm-deal-peek.
async function createOverdueDeal(page: Page) {
  const suffix = Date.now().toString(36);
  const id = `dash-overdue-deal-e2e-${suffix}`;
  const title = `${DEAL_PREFIX} ${suffix}`;
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
    headers: SAME_ORIGIN
  });
  expect(response.status()).toBe(201);
  return { id, title };
}

// Уборка без жёстких expect: провал DELETE/finalize не должен маскировать
// исходную ошибку теста — логируем и едем дальше.
async function archiveTaskQuietly(api: APIRequestContext, taskId: string) {
  try {
    await api.delete(`/api/workspace/tasks/${taskId}`, { headers: SAME_ORIGIN });
  } catch (error) {
    console.warn(`dashboard-grammar cleanup: DELETE task ${taskId} failed`, error);
  }
}

async function finalizeDealQuietly(api: APIRequestContext, dealId: string) {
  try {
    await api.patch(`/api/workspace/opportunities/${dealId}/finalize`, {
      data: { status: "lost_rejected", reason: "E2E cleanup" },
      headers: SAME_ORIGIN
    });
  } catch (error) {
    console.warn(`dashboard-grammar cleanup: finalize deal ${dealId} failed`, error);
  }
}

// Хвосты прошлых прогонов: задачи текущего пользователя по префиксам имени
// (архивируются api-контекстом с правами на DELETE) и открытые e2e-сделки.
async function cleanupLeftovers(
  readApi: APIRequestContext,
  deleteApi: APIRequestContext,
  options: { deals: boolean }
) {
  const myWork = await readApi.get("/api/workspace/my-work");
  if (myWork.ok()) {
    const { tasks } = (await myWork.json()) as { tasks: { id: string; title: string }[] };
    for (const t of tasks.filter((t) => TASK_PREFIXES.some((p) => t.title.startsWith(p)))) {
      await archiveTaskQuietly(deleteApi, t.id);
    }
  }
  if (!options.deals) return;
  const opps = await readApi.get("/api/workspace/opportunities");
  if (opps.ok()) {
    const { opportunities } = (await opps.json()) as {
      opportunities: { id: string; title: string; status: string }[];
    };
    const open = opportunities.filter(
      (o) => o.title.startsWith(DEAL_PREFIX) && ["new", "feasibility", "ready_to_activate"].includes(o.status)
    );
    for (const o of open) await finalizeDealQuietly(deleteApi, o.id);
  }
}

// Реальный Tab до цели (не locator.focus(): видимость фокуса из CSS
// :focus-visible достижима только с клавиатуры). Возвращает true, если дошли.
async function tabUntil(page: Page, isTarget: () => Promise<boolean>, maxPresses = 120) {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press("Tab");
    if (await isTarget()) return true;
  }
  return false;
}

test("dashboard is summary-first: real signals drill down to task and deal, no decorative blocks", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  await cleanupLeftovers(page.request, page.request, { deals: true });

  // Создание — внутри try, уборка каждой сущности в finally независима:
  // упавший шаг теста не оставляет хвостов и не маскируется ошибкой уборки.
  let task: { id: string; title: string } | null = null;
  let dueSoonTask: { id: string; title: string } | null = null;
  let deal: { id: string; title: string } | null = null;
  try {
    // Даты фиксированно в прошлом (2024) → «Задача просрочена» первая в группе
    // (сортировка по plannedFinish asc). Дедлайн-задача: финиш через 3 дня → чип «Дедлайн ≤ 7 дн.».
    task = await createTask(page.request, {
      titlePrefix: OVERDUE_TASK_PREFIX,
      plannedStart: "2024-01-08",
      plannedFinish: "2024-01-12"
    });
    dueSoonTask = await createTask(page.request, {
      titlePrefix: DUE_SOON_TASK_PREFIX,
      plannedStart: localIsoDay(0),
      plannedFinish: localIsoDay(3)
    });
    deal = await createOverdueDeal(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");
    const main = page.getByRole("main");
    const attention = attentionSection(page);

    // Summary-first: блок сигналов виден и стоит на реальных данных.
    await expect(page.getByRole("heading", { name: "Требует внимания" })).toBeVisible();
    const taskSignal = attention.getByRole("link", { name: taskSignalName(task.title) });
    await expect(taskSignal).toBeVisible();
    await expect(attention.getByText("Задача просрочена").first()).toBeVisible();

    // Приближающийся дедлайн — warning-чип с порогом.
    await expect(attention.getByRole("link", { name: taskSignalName(dueSoonTask.title) })).toBeVisible();
    await expect(attention.getByText("Дедлайн ≤ 7 дн.").first()).toBeVisible();

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
    const dealSignal = attention.getByRole("link", { name: dealSignalName(deal.title) });
    await expect(dealSignal).toBeVisible();
    await expect(attention.getByText("Сделка просрочена").first()).toBeVisible();
    await dealSignal.click();
    await expect(page).toHaveURL(new RegExp(`/crm/deals\\?deal=${deal.id}$`));
    await expect(page.getByRole("dialog").getByRole("heading", { name: deal.title })).toBeVisible();

    // KPI-плитка — ссылка к источнику, достижима РЕАЛЬНЫМ Tab и фокус ВИДИМ:
    // computed box-shadow при фокусе отличается от базового и не 'none'.
    await page.goto("/dashboard");
    // ^-якорь: футер «И ещё N» содержит ссылку «Мои задачи» в кавычках-ёлочках.
    const tasksTile = main.getByRole("link", { name: /^Мои задачи/ });
    await expect(tasksTile).toBeVisible();
    await expect(tasksTile.getByText(/просрочено/)).toBeVisible();
    const tileBaseShadow = await tasksTile.evaluate((el) => getComputedStyle(el).boxShadow);
    const reachedTile = await tabUntil(page, () => tasksTile.evaluate((el) => el === document.activeElement));
    expect(reachedTile).toBe(true);
    const tileFocusShadow = await tasksTile.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(tileFocusShadow).not.toBe("none");
    expect(tileFocusShadow).not.toBe(tileBaseShadow);
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
    // Failure-safe уборка: каждая сущность независимо, без жёстких expect —
    // провал одного DELETE не обрывает уборку остальных и не маскирует ошибку теста.
    if (task) await archiveTaskQuietly(page.request, task.id);
    if (dueSoonTask) await archiveTaskQuietly(page.request, dueSoonTask.id);
    if (deal) await finalizeDealQuietly(page.request, deal.id);
  }
});

test("reader without CRM sees honest partial dashboard and can drill down to a task", async ({ page, request }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Админ-сессия в отдельном API-контексте: просроченную задачу ДЛЯ reader'а
  // создаёт и убирает админ (у reader'а нет прав на POST/DELETE задач) —
  // тест не прибит к мутабельному состоянию сидовой task-vektor-testing.
  const adminLogin = await request.post("/api/auth/login", {
    data: { email: "admin@kiss-pm.local", password: "admin12345" }
  });
  expect(adminLogin.status()).toBe(200);

  await page.goto("/");
  await loginToWorkspace(page, {
    email: "plan-reader-no-resources@kiss-pm.local",
    password: "reader12345"
  });
  // Хвосты прошлых прогонов: читаем my-work reader'а, архивируем админом.
  await cleanupLeftovers(page.request, request, { deals: false });

  let task: { id: string; title: string } | null = null;
  try {
    task = await createTask(request, {
      titlePrefix: READER_TASK_PREFIX,
      plannedStart: "2024-03-04",
      plannedFinish: "2024-03-07",
      executorUserId: "user-alpha-plan-reader-no-resources"
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
    // 403 — вопрос прав, а не сбой: копии ошибки загрузки быть не должно.
    await expect(main.getByText(/Не удалось загрузить/)).toHaveCount(0);
    // Скоуп на main: вне его живёт пустой live-region тостера (role=alert от sonner).
    await expect(main.getByRole("alert")).toHaveCount(0);

    // CRM-плитка честно без ссылки («—» / нет доступа), задачи и проекты — ссылки.
    await expect(main.getByRole("link", { name: /Открытые сделки/ })).toHaveCount(0);
    await expect(main.getByText("Открытые сделки")).toBeVisible();
    await expect(main.getByRole("link", { name: /^Мои задачи/ })).toHaveAttribute("href", "/my-work");
    await expect(main.getByRole("link", { name: /Активные проекты/ })).toHaveAttribute("href", "/projects");

    // Реальный сигнал по своей просроченной задаче: drill-down в /my-work?task= и открытый peek.
    const overdueSignal = attention.getByRole("link", { name: taskSignalName(task.title) });
    await expect(overdueSignal).toBeVisible();
    await overdueSignal.click();
    await expect(page).toHaveURL(new RegExp(`/my-work\\?task=${task.id}$`));
    await expect(page.getByRole("dialog").getByRole("heading", { name: task.title })).toBeVisible();

    // Декоративных блоков нет и под reader-ролью; консоль без непойманных исключений.
    await page.goto("/dashboard");
    await expect(main.getByText("Сводка встреч и сигналов дня появится")).toHaveCount(0);
    await expect(main.getByText("Сделки выиграны")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  } finally {
    if (task) await archiveTaskQuietly(request, task.id);
  }
});

test("settings segmented control is reachable by Tab with visible focus ring", async ({ page }) => {
  // Фикс bem.css (.segmented__btn:has(input:focus-visible)) — radio внутри
  // сегмента скрыт (sr-only), кольцо рисуется на label. Доказываем реальным Tab.
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  await page.goto("/settings");
  const segmented = page.getByRole("radiogroup");
  await expect(segmented).toBeVisible();

  const activeSegment = page.locator(".segmented__btn.is-active");
  const baseShadow = await activeSegment.evaluate((el) => getComputedStyle(el).boxShadow);
  const reached = await tabUntil(page, () =>
    page.evaluate(() => Boolean(document.activeElement?.closest(".segmented__btn")))
  );
  expect(reached).toBe(true);
  const focusShadow = await page.evaluate(
    () => getComputedStyle(document.activeElement!.closest(".segmented__btn")!).boxShadow
  );
  expect(focusShadow).not.toBe("none");
  expect(focusShadow).not.toBe(baseShadow);
});
