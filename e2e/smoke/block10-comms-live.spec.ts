import { expect, test, type Browser, type Page } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

/* ============================================================
   Блок 10 «Realtime-коммуникации» — функциональные смоуки (Д2).
   1. Чат: сообщение персистентно (переживает reload страницы).
   2. Realtime: сообщение второго пользователя прилетает по SSE
      (message.created) без reload/кликов у зрителя.
   3. Уведомления: mention от второго пользователя обновляет ленту
      и бейдж таба «Уведомления» push'ем (notification.created).
   4. План: чужой apply-command поднимает planVersion → у зрителя
      расписания появляется баннер «План обновлён…» с кнопкой
      «Обновить» (SSE planVersionChanged), reload снимает баннер.
   Анкеры — seed-данные scripts/seed-dev.ts (tenant-alpha):
   admin@kiss-pm.local и второй пользователь с communications-правами
   engineer@kiss-pm.local (админ-профиль, участник каналов/проектов).
   ============================================================ */

const ADMIN = { email: "admin@kiss-pm.local", password: "admin12345", id: "user-alpha-admin" };
const ENGINEER = { email: "engineer@kiss-pm.local", password: "engineer12345", id: "user-alpha-engineer" };

// Беседа проекта «Портал подрядчиков Вектор» из seed (обе стороны имеют доступ).
const CHAT_PROJECT_ID = "project-vektor-portal";
const CHAT_CONVERSATION_ID = "conversation-vektor-portal";
const CHAT_CONVERSATION_TITLE = "Обсуждение проекта «Портал Вектор»";
// Проект с seed-планом для сценария «план обновлён другим пользователем».
const PLAN_PROJECT_ID = "project-demo-crm-intake";

function mutationHeaders(page: Page) {
  return { Origin: new URL(page.url()).origin, "x-kiss-pm-action": "same-origin" };
}

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/");
  await loginToWorkspace(page, user);
}

// Чат проекта Вектор: единственная беседа сущности автоселектится — ждём шапку и композер.
async function openVektorChat(page: Page) {
  await page.goto(`/communications/chat?project=${CHAT_PROJECT_ID}`);
  await expect(page.getByRole("heading", { level: 2, name: CHAT_CONVERSATION_TITLE })).toBeVisible();
  await expect(page.getByPlaceholder(/Написать сообщение/)).toBeVisible();
}

// Второй пользователь в отдельном browser-контексте (своя сессия/cookies).
async function withSecondUser<T>(browser: Browser, fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page, ENGINEER);
    return await fn(page);
  } finally {
    await context.close();
  }
}

test("чат: отправленное сообщение переживает перезагрузку страницы", async ({ page }) => {
  await login(page, ADMIN);
  await openVektorChat(page);

  const text = `Смоук: персистентность сообщения ${Date.now()}`;
  await page.getByPlaceholder(/Написать сообщение/).fill(text);
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByText(text)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: CHAT_CONVERSATION_TITLE })).toBeVisible();
  await expect(page.getByText(text)).toBeVisible();
});

test("realtime: сообщение второго пользователя появляется в ленте без действий", async ({ page, browser }) => {
  await login(page, ADMIN);
  await openVektorChat(page);

  const text = `Смоук realtime от Игоря ${Date.now()}`;
  await withSecondUser(browser, async (second) => {
    const response = await second.request.post(
      `/api/workspace/conversations/${CHAT_CONVERSATION_ID}/messages`,
      { headers: mutationHeaders(second), data: { body: text } }
    );
    expect(response.status()).toBe(201);
  });

  // Никаких reload/кликов у зрителя: сообщение обязано прилететь push'ем (SSE message.created).
  await expect(page.getByText(text)).toBeVisible({ timeout: 10_000 });
});

test("уведомления: mention от второго пользователя обновляет ленту и бейдж без reload", async ({ page, browser }) => {
  await login(page, ADMIN);
  await page.goto("/communications/notifications");
  await expect(page.getByRole("button", { name: "Прочитать все" })).toBeVisible();

  const summaryResponse = await page.request.get("/api/workspace/unread-summary");
  expect(summaryResponse.status()).toBe(200);
  const initialUnread = ((await summaryResponse.json()) as { notifications: number }).notifications;

  const marker = `смоук-упоминание ${Date.now()}`;
  await withSecondUser(browser, async (second) => {
    const response = await second.request.post(
      `/api/workspace/conversations/${CHAT_CONVERSATION_ID}/messages`,
      { headers: mutationHeaders(second), data: { body: `@${ADMIN.id} ${marker}` } }
    );
    expect(response.status()).toBe(201);
  });

  // Лента перечитывается по SSE notification.created — новое «Вас упомянули» с телом сообщения.
  await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 });
  // Бейдж таба «Уведомления» (unread-summary) живёт на том же push'е.
  await expect(page.getByRole("link", { name: /^Уведомления/ })).toContainText(String(initialUnread + 1), {
    timeout: 10_000
  });
});

test("план: чужой apply поднимает баннер «План обновлён…», «Обновить» снимает его", async ({ page, browser }) => {
  await login(page, ADMIN);
  await page.goto(`/projects/${PLAN_PROJECT_ID}/schedule`);

  // Анкер загрузки read-model у зрителя: первая задача плана видна в расписании.
  const readModelResponse = await page.request.get(
    `/api/workspace/projects/${PLAN_PROJECT_ID}/planning/read-model`
  );
  expect(readModelResponse.status()).toBe(200);
  const readModel = (await readModelResponse.json()) as {
    planVersion: number;
    authored: { tasks: Array<{ id: string; title: string }> };
  };
  const task = readModel.authored.tasks[0];
  expect(task, "в seed-плане проекта должна быть хотя бы одна задача").toBeTruthy();
  await expect(page.getByText(task!.title).first()).toBeVisible();
  await expect(page.getByTestId("plan-updated-banner")).toHaveCount(0);

  await withSecondUser(browser, async (second) => {
    const current = await second.request.get(
      `/api/workspace/projects/${PLAN_PROJECT_ID}/planning/read-model`
    );
    expect(current.status()).toBe(200);
    const { planVersion } = (await current.json()) as { planVersion: number };
    const apply = await second.request.post(
      `/api/workspace/projects/${PLAN_PROJECT_ID}/planning/apply-command`,
      {
        headers: mutationHeaders(second),
        data: {
          clientPlanVersion: planVersion,
          command: {
            type: "task.update_identity",
            payload: { taskId: task!.id, title: `Смоук план-баннер ${Date.now()}` }
          }
        }
      }
    );
    expect(apply.status()).toBe(200);
  });

  // SSE planVersionChanged → неблокирующий баннер (автоперезагрузки нет).
  const banner = page.getByTestId("plan-updated-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await banner.getByRole("button", { name: "Обновить" }).click();
  // reload догоняет planVersion — баннер снимается.
  await expect(banner).toHaveCount(0, { timeout: 10_000 });

  // Компенсация: возвращаем seed-название задачи — спек повторяем и не ломает
  // другие смоуки, которые опираются на seed-якоря (block9: карточка задачи).
  await withSecondUser(browser, async (second) => {
    const current = await second.request.get(
      `/api/workspace/projects/${PLAN_PROJECT_ID}/planning/read-model`
    );
    const { planVersion } = (await current.json()) as { planVersion: number };
    const revert = await second.request.post(
      `/api/workspace/projects/${PLAN_PROJECT_ID}/planning/apply-command`,
      {
        headers: mutationHeaders(second),
        data: {
          clientPlanVersion: planVersion,
          command: { type: "task.update_identity", payload: { taskId: task!.id, title: task!.title } }
        }
      }
    );
    expect(revert.status()).toBe(200);
  });
});
