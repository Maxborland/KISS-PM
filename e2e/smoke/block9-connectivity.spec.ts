import { expect, test, type Page } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

/* ============================================================
   Блок 9 «UX-связность»: смоуки сквозных цепочек навигации.
   1. Корень «/» — auth-aware redirect (аноним → /login, сессия → /my-work).
   2. Сделка → проект («Проекты из сделки» на карточке сделки).
   3. Глобальный поиск → клиент (/crm/clients?entity= с подсветкой строки).
   4. Звонки → живая комната /calls/{roomId} (лобби рендерится, WebRTC не требуется).
   5. Карточка задачи → проект (ссылка «Проект: …»).
   Анкеры — seed-данные scripts/seed-dev.ts (tenant-alpha).
   ============================================================ */

const CLIENT = { id: "client-romashka", name: "ООО Ромашка" };
const DEAL = { id: "opportunity-demo-crm-intake", title: "CRM intake" };
const PROJECT = { id: "project-demo-crm-intake", title: "CRM intake" };
const TASK = { id: "task-demo-resource-estimate", title: "Подготовить ресурсную оценку по сделке" };

async function login(page: Page) {
  await page.goto("/");
  await loginToWorkspace(page, { password: "admin12345" });
}

// Карточка проекта: h1 — заголовок поверхности, название проекта — h2.
async function expectProjectCardOpen(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Карточка проекта" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: PROJECT.title, exact: true })).toBeVisible();
}

test("root redirects anonymous visitors to /login and authenticated users to /my-work", async ({ page }) => {
  // Аноним: «/» не тупик со заглушкой, а редирект на вход.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await loginToWorkspace(page, { password: "admin12345" });

  // С сессией: «/» ведёт на домашний экран рабочей области.
  await page.goto("/");
  await expect(page).toHaveURL(/\/my-work$/);
});

test("deal card links to the project activated from it", async ({ page }) => {
  await login(page);
  await page.goto(`/crm/deals/${DEAL.id}`);

  await expect(page.getByText("Проекты из сделки", { exact: true })).toBeVisible();
  const projectLink = page.getByTitle(`Открыть проект «${PROJECT.title}»`);
  await expect(projectLink).toHaveAttribute("href", `/projects/${PROJECT.id}`);

  await projectLink.click();
  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT.id}(/.*)?$`));
  await expectProjectCardOpen(page);
});

test("global search routes a client result to the highlighted list row", async ({ page }) => {
  await login(page);
  await page.goto("/my-work");

  await page.getByRole("button", { name: "Поиск и команды…" }).click();
  const dialog = page.getByRole("dialog", { name: "Поиск и команды" });
  await dialog.getByRole("combobox", { name: "Поиск и команды" }).fill("Ромашка");

  // Серверные результаты сгруппированы; клиент ведёт на список с ?entity=.
  await expect(dialog.getByText("Клиенты", { exact: true })).toBeVisible();
  // Имя клиента встречается и в сделках/проекте — целимся в option типа client по data-value.
  await dialog.locator(`[cmdk-item][data-value="client:${CLIENT.id}"]`).click();

  await expect(page).toHaveURL(new RegExp(`/crm/clients\\?entity=${CLIENT.id}$`));
  const highlighted = page.locator("tr[data-selected]");
  await expect(highlighted).toHaveCount(1);
  await expect(highlighted).toContainText(CLIENT.name);
});

test("calls surface opens the live call room with a pre-join lobby", async ({ page }) => {
  await login(page);
  await page.goto("/communications/calls");

  // Комнаты в seed нет — создаём свою (кнопка есть и в шапке, и в empty-state).
  const roomTitle = `Смоук-комната ${Date.now().toString(36)}`;
  await page.getByRole("button", { name: "Комната" }).first().click();
  const createDialog = page.getByRole("dialog", { name: "Новая комната звонка" });
  await createDialog.getByLabel("Название").fill(roomTitle);
  // В диалоге два select («Тип медиа» и «Провайдер») — целимся по опции «Ручной».
  await createDialog.locator("select").filter({ hasText: "Ручной" }).selectOption("manual");
  await createDialog.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("heading", { name: roomTitle })).toBeVisible();

  await page.getByRole("button", { name: "Начать сессию" }).click();

  // Активная сессия открывает живой путь: внутренний роут /calls/{roomId} без токена в URL.
  const openRoom = page.getByRole("link", { name: "Открыть комнату" });
  await expect(openRoom).toBeVisible();
  await expect(openRoom).toHaveAttribute("href", /^\/calls\/.+/);
  await openRoom.click();

  await expect(page).toHaveURL(/\/calls\/.+/);
  // Рантайм комнаты: проверка доступа → лобби устройств (сам WebRTC-join не требуется).
  await expect(page.getByText("Перед входом", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Присоединиться", exact: true })).toBeVisible();
});

test("task card links back to its project", async ({ page }) => {
  await login(page);
  await page.goto("/my-work");

  // Из списка «Мои задачи» — peek, из него «Открыть полностью» — каноническая карточка.
  const trigger = page.getByRole("button", { name: `Открыть задачу «${TASK.title}»`, exact: true }).first();
  await trigger.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: TASK.title })).toBeVisible();
  await page.getByRole("link", { name: "Открыть полностью", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${TASK.id}$`));

  // Карточка задачи называет проект и ведёт на него живой ссылкой.
  await expect(page.getByText("Проект:", { exact: false }).first()).toBeVisible();
  const projectLink = page.getByRole("link", { name: PROJECT.title, exact: true });
  await expect(projectLink).toHaveAttribute("href", `/projects/${PROJECT.id}`);
  await projectLink.click();
  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT.id}(/.*)?$`));
  await expectProjectCardOpen(page);
});
