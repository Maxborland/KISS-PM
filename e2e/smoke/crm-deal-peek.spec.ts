import { expect, test, type Page } from "@playwright/test";

import {
  deactivateStaleSmokeOpportunityFields,
  getRequiredOpportunityCustomFieldValues,
  loginToWorkspace
} from "./smokeHelpers";

// Peek-сводка сделки (?deal=<id> на /crm/deals) — URL-грамматика TaskPeek.
// Канонические ссылки «Открыть сделку «…»» НЕ трогаем (контракт crm-deal-activation);
// peek открывается кликом по ТЕЛУ карточки/строки или триггером «Просмотр сделки «…»».

const READER_DEAL = {
  id: "opportunity-reader-e2e",
  title: "Проверка прав CRM E2E"
};

const peekTriggerName = (title: string) => `Просмотр сделки «${title}»`;

async function createPeekDeal(page: Page) {
  const suffix = Date.now().toString(36);
  const id = `deal-peek-e2e-${suffix}`;
  const title = `Peek сделка ${suffix}`;
  await deactivateStaleSmokeOpportunityFields(page);
  const customFieldValues = await getRequiredOpportunityCustomFieldValues(page);
  const createResponse = await page.request.post("/api/workspace/opportunities", {
    data: {
      id,
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-new",
      title,
      description: "E2E проверка peek-сводки сделки",
      plannedStart: "2032-03-01",
      plannedFinish: "2032-03-31",
      contractValue: 480000,
      plannedHourlyRate: 4000,
      probability: 35,
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 60 }],
      customFieldValues
    },
    headers: { "x-kiss-pm-action": "same-origin" }
  });
  expect(createResponse.status()).toBe(201);
  return { id, title };
}

test("deal peek opens from kanban and list, is URL-driven and closes with focus return", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
  const deal = await createPeekDeal(page);
  const peekUrl = new RegExp(`/crm/deals\\?deal=${deal.id}$`);
  const dialog = page.getByRole("dialog");

  await page.goto("/crm/deals");
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Канбан: клик по телу карточки (не по title-ссылке и не по триггеру) открывает peek.
  const card = page.locator(`article[data-deal-id="${deal.id}"]`);
  await expect(card).toBeVisible();
  await card.getByText("ООО Ромашка", { exact: true }).click();
  await expect(dialog.getByRole("heading", { name: deal.title })).toBeVisible();
  await expect(page).toHaveURL(peekUrl);
  // Read-only сводка: факты + последние события, никаких мутационных контролов.
  await expect(dialog.getByText("Клиент", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Не проверялась", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Последние события" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Сохранить" })).toHaveCount(0);
  await expect(dialog.getByRole("textbox")).toHaveCount(0);

  // Регрессия: клик по неинтерактивному контенту ВНУТРИ открытого peek не закрывает
  // панель (события портала всплывают по React-дереву до onClick карточки).
  await dialog.getByText("E2E проверка peek-сводки сделки", { exact: true }).click();
  await expect(dialog.getByRole("heading", { name: deal.title })).toBeVisible();
  await expect(page).toHaveURL(peekUrl);

  // Title-ссылка внутри карточки осталась канонической (href не перехвачен peek'ом).
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/crm\/deals$/);
  await expect(
    page.getByRole("link", { name: `Открыть сделку «${deal.title}»`, exact: true })
  ).toHaveAttribute("href", `/crm/deals/${deal.id}`);

  // Escape вернул фокус на триггер peek этой карточки.
  const kanbanTrigger = card.getByRole("button", { name: peekTriggerName(deal.title), exact: true });
  await expect(kanbanTrigger).toBeFocused();

  // Клавиатура: Enter на видимом триггере открывает peek.
  await kanbanTrigger.press("Enter");
  await expect(dialog.getByRole("heading", { name: deal.title })).toBeVisible();
  await expect(page).toHaveURL(peekUrl);

  // Reload с открытым peek: URL — источник истины, панель открыта после перезагрузки.
  await page.reload();
  await expect(page.getByRole("dialog").getByRole("heading", { name: deal.title })).toBeVisible();
  await expect(page).toHaveURL(peekUrl);

  // «Открыть полностью» ведёт на каноническую страницу сделки.
  await page.getByRole("link", { name: "Открыть полностью", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/crm/deals/${deal.id}$`));
  await expect(page.getByRole("heading", { name: deal.title, exact: true })).toBeVisible();

  // Список: клик по телу строки открывает peek; select стадии и ссылка не перехвачены.
  await page.goto("/crm/deals");
  const listMode = page.getByRole("radio", { name: "Список", exact: true });
  await listMode.focus();
  await page.keyboard.press("Space");
  const row = page.getByRole("row").filter({ hasText: deal.title });
  await row.getByRole("cell", { name: "ООО Ромашка", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: deal.title })).toBeVisible();
  await expect(page).toHaveURL(peekUrl);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/crm\/deals$/);

  // Клавиатурный триггер есть и в строке списка.
  const listTrigger = row.getByRole("button", { name: peekTriggerName(deal.title), exact: true });
  await expect(listTrigger).toBeFocused();
  await listTrigger.press("Enter");
  await expect(dialog.getByRole("heading", { name: deal.title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Уборка: сделку закрываем как проигранную, чтобы не копить активные сделки в общем сиде.
  const finalizeResponse = await page.request.patch(`/api/workspace/opportunities/${deal.id}/finalize`, {
    data: { status: "lost_rejected", reason: "E2E cleanup" },
    headers: { "x-kiss-pm-action": "same-origin" }
  });
  expect(finalizeResponse.status()).toBe(200);
});

test("CRM reader sees deal peek read-only without mutation requests", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, {
    email: "crm-reader@kiss-pm.local",
    password: "crmreader12345"
  });

  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      (request.url().includes("/api/workspace/opportunities") ||
        request.url().includes("/api/workspace/crm/"))
    ) {
      mutationRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await page.goto("/crm/deals");
  const trigger = page.getByRole("button", { name: peekTriggerName(READER_DEAL.title), exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: READER_DEAL.title })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/crm/deals\\?deal=${READER_DEAL.id}$`));
  await expect(dialog.getByText("Клиент", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Последние события" })).toBeVisible();
  // Peek строго read-only: никаких форм и мутационных кнопок.
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Сохранить" })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Открыть полностью", exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/crm\/deals$/);
  expect(mutationRequests).toEqual([]);
});
