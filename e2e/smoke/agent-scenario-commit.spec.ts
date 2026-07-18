import { expect, test } from "@playwright/test";

import { loginToWorkspace, revertLastPlanCommit, runAgentOverloadResolutionJourney } from "./smokeHelpers";

/**
 * Сквозной PM-as-code цикл (фаза E плана): перегруз → живой preview сценариев →
 * предложение apply_resource_resolution от агента (payload-backed карточка D3) →
 * governed-применение → адресуемая квитанция → реальный коммит плана в «Коммитах» →
 * компенсирующий откат через превью-гейт. Всё на реальном backend без route-моков;
 * откат в конце возвращает план — спек повторяем. Шаги журнея — в smokeHelpers
 * (общие с evidence-спеком, чтобы селекторы не дрейфовали).
 */
test("PM-as-code: перегруз → сценарий агентом → живой коммит → компенсирующий откат", async ({ page }) => {
  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });

  const journey = await runAgentOverloadResolutionJourney(page);

  // Квитанция ведёт к РЕАЛЬНОМУ коммиту плана (planningAuditEventId + projectId).
  const auditEventId = journey.receiptText.match(/audit-[0-9a-f-]+/i)?.[0] ?? "";
  expect(auditEventId).not.toBe("");
  await expect(journey.selectedCommitRow).toHaveAttribute("data-audit-event-id", auditEventId);

  // Агентский коммит откатим как любой другой: компенсирующие команды через превью-гейт.
  await revertLastPlanCommit(page);
});
