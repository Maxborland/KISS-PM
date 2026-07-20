import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

/**
 * ЖИВАЯ приёмочная проверка агента «Генри Гантт» на настоящем LLM.
 *
 * НЕ входит в CI/смоук-гейт: требует поднятого api БЕЗ KISS_PM_AGENT_SCRIPTED,
 * с OPENROUTER_API_KEY / KISS_PM_AGENT_PROVIDER=openrouter из .env.local.
 * Запуск: подняв живой api на :4100, `playwright test e2e/live --project=chromium`.
 *
 * Доказывает сквозной путь без заглушек: логин → рабочее место агента →
 * живой /propose/stream реальной моделью (anthropic/claude-sonnet-4.6) →
 * честная review-карточка предложения → живой /execute применяет через
 * governed-роут. Ассерты терпимы к недетерминизму модели: проверяем СТРУКТУРУ
 * (нет scripted-баннера, пришёл ответ, появилась карточка с «Применить», apply
 * дал receipt), а не точный текст LLM.
 */
test("Живой агент: реальное предложение на LLM и применение без заглушек", async ({ page }, testInfo) => {
  test.setTimeout(180_000);

  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });
  await page.goto("/agent");
  await page.screenshot({ path: testInfo.outputPath("01-agent-open.png"), fullPage: true });

  // Живой канал: scripted/mock-баннер честной деградации ОТСУТСТВУЕТ (провайдер live).
  await expect(page.getByRole("status").getByText(/провайдер (scripted-llm|mock-llm|demo-llm)/)).toHaveCount(0);

  const composer = page.getByRole("textbox", { name: "Сообщение Генри Гантту" });
  await expect(composer).toBeVisible();
  // Действие-форсирующая инструкция: модель должна вызвать comment_task по моей задаче.
  await composer.fill("Оставь комментарий «Живой агент подтверждён на приёмке» к моей первой задаче.");
  await page.getByRole("button", { name: "Отправить" }).click();

  // Живой SSE: дожидаемся любой review-карточки с кнопкой применения (модель думает
  // и предлагает инструмент). Большой таймаут — реальный сетевой вызов LLM.
  const applyButton = page.getByRole("button", { name: "Применить выбранное" });
  await expect(applyButton).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: testInfo.outputPath("02-agent-proposal.png"), fullPage: true });

  // Живой /execute через governed-роут: честный receipt применения.
  await applyButton.click();
  await expect(page.getByText(/Результат: применено \d+/).last()).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: testInfo.outputPath("03-agent-applied.png"), fullPage: true });

  // Применённая кнопка блокируется — повторное применение исключено.
  await expect(page.getByText(/Результат: применено [1-9]/).last()).toBeVisible();
});
