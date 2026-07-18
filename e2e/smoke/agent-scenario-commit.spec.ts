import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "./smokeHelpers";

/**
 * Сквозной PM-as-code цикл (фаза E плана): перегруз → живой preview сценариев →
 * предложение apply_resource_resolution от агента (payload-backed карточка D3) →
 * governed-применение → адресуемая квитанция → реальный коммит плана в «Коммитах» →
 * компенсирующий откат через превью-гейт. Всё на реальном backend без route-моков;
 * откат в конце возвращает план — спек повторяем.
 */
test("PM-as-code: перегруз → сценарий агентом → живой коммит → компенсирующий откат", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });
  await page.goto("/agent");

  const composer = page.getByRole("textbox", { name: "Сообщение Генри Гантту" });
  await expect(composer).toBeEnabled();
  await composer.fill("Разгрузи перегруженный ресурс");
  await page.getByRole("button", { name: "Отправить" }).click();

  // Карточка D3: серверный title из persisted scenario run, версия плана в preconditions.
  await expect(page.getByText(/Применить сценарий разрешения перегрузки/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Применить выбранное" }).click();
  await expect(page.getByText("Результат: применено 1, отказано 0, конфликтов 0, ошибок 0.").last()).toBeVisible();

  // Квитанция ведёт к РЕАЛЬНОМУ коммиту плана (planningAuditEventId + projectId).
  const receipt = page.getByTestId("agent-receipt").last();
  const commitLink = receipt.getByRole("link", { name: "Открыть в Коммитах" });
  await expect(commitLink).toBeVisible();
  const auditEventId = ((await receipt.textContent()) ?? "").match(/audit-[0-9a-f-]+/i)?.[0] ?? "";
  expect(auditEventId).not.toBe("");

  await commitLink.click();
  await expect(page).toHaveURL(/\/commits\?commit=/);
  const selectedRow = page.locator('[data-testid="commit-row"][aria-pressed="true"]');
  await expect(selectedRow).toHaveAttribute("data-audit-event-id", auditEventId);

  // Агентский коммит откатим как любой другой: компенсирующие команды через превью-гейт.
  await page.getByRole("button", { name: "Откатить последний", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Применить изменения", exact: true }).click();
  await expect(page.getByText(/Откат применён компенсирующим коммитом/)).toBeVisible();
});
