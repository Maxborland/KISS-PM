import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

/**
 * Journey tracer bullet (§14 handoff): запрос → живое предложение → применение →
 * reload → история с фактическими исходами и адресуемой квитанцией. Всё на реальном
 * backend (scripted-провайдер, живой postgres): propose/execute персистят ходы,
 * гидрация при монтировании восстанавливает тред после перезагрузки.
 */
test("Agent Workspace: история переживает reload — запрос, предложение, исход и квитанция", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });
  await page.goto("/agent");

  // Уникальная реплика этого прогона: после reload докажем, что вернулась ИМЕННО она.
  const goal = `Зафиксируй статус (resume-${Date.now()})`;
  const composer = page.getByRole("textbox", { name: "Сообщение Генри Гантту" });
  await expect(composer).toBeEnabled(); // composer разблокирован после гидрации истории
  await composer.fill(goal);
  await page.getByRole("button", { name: "Отправить" }).click();

  await expect(page.getByText(/Скриптованный агент: статус по задаче/).first()).toBeVisible();
  await page.getByRole("button", { name: "Применить выбранное" }).click();
  await expect(page.getByText("Результат: применено 1, отказано 0, конфликтов 0, ошибок 0.").last()).toBeVisible();
  // Квитанция comment_task: audit-событие agent-action-* без href (в «Коммитах» его
  // честно нет) + correlationId батча.
  const receipt = page.getByTestId("agent-receipt").last();
  await expect(receipt.getByText(/agent-action-/)).toBeVisible();
  await expect(receipt.getByText(/agent-execute-/)).toBeVisible();

  await page.reload();

  // Гидрация восстановила: реплику пользователя, ответ агента и result-сообщение
  // с квитанцией — из персистентного треда, а не из локального стейта.
  await expect(page.getByText(goal)).toBeVisible();
  await expect(page.getByText(/Скриптованный агент/).first()).toBeVisible();
  await expect(page.getByText("Результат: применено 1, отказано 0, конфликтов 0, ошибок 0.").last()).toBeVisible();
  const restoredReceipt = page.getByTestId("agent-receipt").last();
  await expect(restoredReceipt.getByText(/agent-action-/)).toBeVisible();
  await expect(restoredReceipt.getByText(/agent-execute-/)).toBeVisible();
});
