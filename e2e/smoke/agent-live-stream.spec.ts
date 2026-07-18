import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

/**
 * Живой SSE-путь агента БЕЗ единого route-мока: скриптованный провайдер на сервере
 * (двойной env-гейт KISS_PM_E2E_TEST_HOOKS + KISS_PM_AGENT_SCRIPTED, см.
 * playwright.config.ts) гонит реальный цикл /propose/stream — рассуждение, живой
 * analyze list_my_tasks по seed-данным, предложение comment_task, — а затем
 * /execute реально применяет комментарий через governed-роут комментариев.
 * Прежний спек agent-partial-apply мокает /propose/stream на границе HTTP —
 * этот спек закрывает непокрытую живую SSE-цепочку (P4-слайс живого стрима).
 */
test("Agent Workspace: живой SSE-стрим и реальное применение предложения без моков", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });
  await page.goto("/agent");

  // Честная деградация: scripted-канал configured, но не live — баннер обязателен.
  await expect(page.getByRole("status").getByText(/провайдер scripted-llm/)).toBeVisible();

  await page.getByRole("textbox", { name: "Сообщение Генри Гантту" }).fill("Зафиксируй статус по моей первой задаче");
  await page.getByRole("button", { name: "Отправить" }).click();

  // Рассуждение пришло настоящим SSE-кадром reasoning и осталось в треде (trace
  // и текстовый ответ агента — поэтому .first()).
  await expect(page.getByText("Скриптованный агент: смотрю ваши задачи.").first()).toBeVisible();
  // Предложение построено сервером по реальной задаче из seed: payload-backed
  // review-карточка comment_task с телом будущего комментария.
  await expect(page.getByText(/Скриптованный агент: статус по задаче/).first()).toBeVisible();

  // Применение — живой /execute через governed-роут комментариев (никаких моков).
  await page.getByRole("button", { name: "Применить выбранное" }).click();
  await expect(page.getByText("Результат: применено 1, отказано 0, конфликтов 0, ошибок 0.").last()).toBeVisible();
  await expect(page.getByRole("button", { name: "применено" })).toBeDisabled();
});
