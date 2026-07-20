import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

/* ============================================================
   Блок 12 «База знаний проекта» — финальные смоуки close-out.
   Доказываем новые потоки Блока 12 против seed (tenant-alpha,
   admin@kiss-pm.local):

   1. Глобальный поиск: палитра находит документ базы знаний в
      группе «Документы», клик ведёт на карточку /…/knowledge/… .
   2. Восстановление версии документа: возврат прошлой версии
      делает её текущей и переживает reload.
   3. Удаление решения / пункта действий: запись исчезает из
      списка и не возвращается после reload.

   Честность о путях (см. отчёт лейна): смоук САМ сеет свои
   knowledge-фикстуры через боевые ручки создания (POST документ/
   версия/решение/поручение — есть в knowledgeRoutes), не завися
   от конкретных seed-id/заголовков, которых на момент написания
   спеки ещё нет. UI-жест проходит поиск (реальная палитра) и
   проверка РЕЗУЛЬТАТА восстановления/удаления через reload UI.
   Само восстановление версии и удаление решения/поручения идут
   через page.request (в knowledge-surface на момент написания нет
   кнопок restore/delete — «Deferred: UI нет» в knowledge-surface),
   поэтому это API-путь по мостику ручек Блока 12.

   Компенсация мутаций (как block10 spec): созданные для теста
   документы архивируются в finally боевой DELETE-ручкой; решения
   и поручения самоудаляются самим проверяемым потоком.
   ============================================================ */

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345", id: "user-alpha-admin" };

// Проект из seed (tenant-alpha), где у admin есть tenant.projects.manage.
const PROJECT_ID = "project-demo-crm-intake";
const BASE = `/api/workspace/projects/${PROJECT_ID}/knowledge`;

type DocumentView = { id: string; title: string };
type VersionView = { id: string; versionNumber: number; title: string; body: string };
type DecisionView = { id: string; title: string };
type ActionItemView = { id: string; title: string };

function mutationHeaders(page: Page) {
  return { Origin: new URL(page.url()).origin, "x-kiss-pm-action": "same-origin" };
}

async function login(page: Page) {
  await page.goto("/");
  await loginToWorkspace(page, ADMIN);
}

async function expectStatus(response: APIResponse, expected: number, label: string) {
  expect(response.status(), `${label} → ${response.status()}: ${await response.text()}`).toBe(expected);
}

// --- Боевые ручки создания (verified: knowledgeRoutes POST …/documents|versions|decisions|action-items) ---

async function createDocument(
  page: Page,
  input: { title: string; body: string; summary?: string }
): Promise<{ document: DocumentView; version: VersionView }> {
  const response = await page.request.post(`${BASE}/documents`, {
    headers: mutationHeaders(page),
    data: input
  });
  await expectStatus(response, 201, "POST document");
  return (await response.json()) as { document: DocumentView; version: VersionView };
}

async function createVersion(
  page: Page,
  documentId: string,
  input: { title: string; body: string; changeReason?: string }
): Promise<VersionView> {
  const response = await page.request.post(`${BASE}/documents/${documentId}/versions`, {
    headers: mutationHeaders(page),
    data: input
  });
  await expectStatus(response, 201, "POST version");
  return ((await response.json()) as { version: VersionView }).version;
}

async function getDocument(
  page: Page,
  documentId: string
): Promise<{ document: DocumentView; versions: VersionView[] }> {
  const response = await page.request.get(`${BASE}/documents/${documentId}`);
  await expectStatus(response, 200, "GET document");
  return (await response.json()) as { document: DocumentView; versions: VersionView[] };
}

// Компенсация: архивируем созданный документ боевой DELETE-ручкой (verified).
async function archiveDocument(page: Page, documentId: string) {
  await page.request.delete(`${BASE}/documents/${documentId}`, { headers: mutationHeaders(page) });
}

async function createDecision(page: Page, input: { title: string; decision: string }): Promise<DecisionView> {
  const response = await page.request.post(`${BASE}/decisions`, {
    headers: mutationHeaders(page),
    data: input
  });
  await expectStatus(response, 201, "POST decision");
  return ((await response.json()) as { decision: DecisionView }).decision;
}

async function listDecisions(page: Page): Promise<DecisionView[]> {
  const response = await page.request.get(`${BASE}/decisions`);
  await expectStatus(response, 200, "GET decisions");
  return ((await response.json()) as { decisions: DecisionView[] }).decisions;
}

async function createActionItem(page: Page, input: { title: string; ownerUserId: string }): Promise<ActionItemView> {
  const response = await page.request.post(`${BASE}/action-items`, {
    headers: mutationHeaders(page),
    data: input
  });
  await expectStatus(response, 201, "POST action-item");
  return ((await response.json()) as { actionItem: ActionItemView }).actionItem;
}

async function listActionItems(page: Page): Promise<ActionItemView[]> {
  const response = await page.request.get(`${BASE}/action-items`);
  await expectStatus(response, 200, "GET action-items");
  return ((await response.json()) as { actionItems: ActionItemView[] }).actionItems;
}

function latestVersion(versions: VersionView[]): VersionView {
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const latest = sorted[0];
  expect(latest, "у документа должна быть хотя бы одна версия").toBeTruthy();
  return latest!;
}

// Открыть палитру глобального поиска (топбар shell) и ввести запрос.
async function openSearchPalette(page: Page, query: string) {
  await page.getByRole("button", { name: /Поиск и команды/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // CommandInput (cmdk) — надёжнее находить по placeholder, чем по role/name.
  const input = dialog.getByPlaceholder(/Команда, проект/);
  await expect(input).toBeVisible();
  await input.fill(query);
}

// Открыть страницу базы знаний и выбрать секцию.
async function openKnowledge(page: Page, section: "documents" | "decisions" | "actions") {
  await page.goto(`/projects/${PROJECT_ID}/knowledge`);
  await page.getByTestId(`knowledge-section-${section}`).click();
}

test("глобальный поиск: документ базы знаний находится в палитре и ведёт на карточку /knowledge/…", async ({ page }) => {
  await login(page);
  const marker = `смоук-знание-${Date.now()}`;
  const title = `Документ базы знаний ${marker}`;
  const { document } = await createDocument(page, {
    title,
    body: "Демо-содержимое документа для смоук-поиска Блока 12.",
    summary: "Смоук-документ close-out"
  });

  try {
    // Реальный UI-жест: палитра + серверный поиск knowledge (searchKnowledge).
    await page.goto("/");
    await openSearchPalette(page, marker);

    const dialog = page.getByRole("dialog");
    // Результат в группе «Документы».
    await expect(dialog.getByText("Документы", { exact: true })).toBeVisible({ timeout: 10_000 });
    const result = dialog.getByText(title);
    await expect(result).toBeVisible({ timeout: 10_000 });

    await result.click();
    // Клик по результату knowledge ведёт на боевую вкладку знаний проекта с deep-link
    // ?document=<id> (result.route сервера); surface открывает секцию «Документы» и
    // выделяет документ. Раньше маршрут вёл на несуществующий /knowledge/documents/:id (404).
    await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}/knowledge\\?document=${document.id}`));
    await expect(page.getByTestId("knowledge-document-detail")).toBeVisible({ timeout: 10_000 });
  } finally {
    await archiveDocument(page, document.id);
  }
});

test("восстановление версии документа: возврат прошлой версии становится текущей и переживает reload", async ({ page }) => {
  await login(page);
  const stamp = Date.now();
  const v1Body = `Версия один ${stamp} — исходное содержимое документа.`;
  const { document } = await createDocument(page, {
    title: `Версионируемый документ ${stamp}`,
    body: v1Body
  });

  try {
    // Правка = новая версия (v2) → текущая версия теперь v2.
    const v2Body = `Версия два ${stamp} — обновлённое содержимое документа.`;
    await createVersion(page, document.id, { title: `Версионируемый документ ${stamp}`, body: v2Body });
    expect(latestVersion((await getDocument(page, document.id)).versions).body).toBe(v2Body);

    // «Восстановление» прошлой версии = новая версия, несущая содержимое v1.
    // Это продуктовая семантика knowledge (редактирование — всегда новая версия);
    // на момент написания в UI кнопки restore нет — API-путь по ручке версий.
    await createVersion(page, document.id, {
      title: `Версионируемый документ ${stamp}`,
      body: v1Body,
      changeReason: "Восстановление версии v1"
    });

    // Persist через reload: страница знаний, тело текущей версии выбранного документа = v1.
    await openKnowledge(page, "documents");
    await page
      .locator(`[data-testid="knowledge-document-row"][data-document-id="${document.id}"]`)
      .click();
    await expect(page.getByTestId("knowledge-version-body")).toContainText(v1Body);
  } finally {
    await archiveDocument(page, document.id);
  }
});

test("удаление решения: запись исчезает из списка и не возвращается после reload", async ({ page }) => {
  await login(page);
  const title = `Удаляемое решение ${Date.now()}`;
  const decision = await createDecision(page, { title, decision: "Решение под удаление (смоук close-out)." });

  expect((await listDecisions(page)).some((entry) => entry.id === decision.id)).toBe(true);

  // Удаление решения: DELETE-ручка Блока 12. В UI knowledge-surface кнопки удаления
  // нет — API-путь. Мутация самоудаляется проверяемым потоком (компенсация не нужна).
  const response = await page.request.delete(`${BASE}/decisions/${decision.id}`, {
    headers: mutationHeaders(page)
  });
  await expectStatus(response, 200, "DELETE decision");

  // Persist через перечитывание списка ручкой…
  expect((await listDecisions(page)).some((entry) => entry.id === decision.id)).toBe(false);
  // …и через reload UI: строки с этим заголовком в журнале решений нет.
  await openKnowledge(page, "decisions");
  await expect(page.getByTestId("knowledge-decisions")).toBeVisible();
  await expect(page.getByTestId("knowledge-decisions").getByText(title)).toHaveCount(0);
});

test("удаление пункта действий: запись исчезает из списка и не возвращается после reload", async ({ page }) => {
  await login(page);
  const title = `Удаляемое поручение ${Date.now()}`;
  const actionItem = await createActionItem(page, { title, ownerUserId: ADMIN.id });

  expect((await listActionItems(page)).some((entry) => entry.id === actionItem.id)).toBe(true);

  // Удаление поручения: DELETE-ручка Блока 12 (в UI кнопки нет — API-путь).
  const response = await page.request.delete(`${BASE}/action-items/${actionItem.id}`, {
    headers: mutationHeaders(page)
  });
  await expectStatus(response, 200, "DELETE action-item");

  expect((await listActionItems(page)).some((entry) => entry.id === actionItem.id)).toBe(false);
  // Reload UI: строки поручения (data-action-item-id) в списке больше нет.
  await openKnowledge(page, "actions");
  await expect(page.getByTestId("knowledge-actions")).toBeVisible();
  await expect(
    page.locator(`[data-testid="knowledge-action-row"][data-action-item-id="${actionItem.id}"]`)
  ).toHaveCount(0);
});
