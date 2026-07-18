import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { loginToWorkspace, revertLastPlanCommit, runAgentOverloadResolutionJourney } from "../smoke/smokeHelpers";

const EVIDENCE_DIR = path.join(".superloopy", "evidence", "agent-first-2026-07-19");

/**
 * Journey-evidence Блока 7 (agent-first / PM-as-code): живой прогон полного цикла
 * с фиксацией артефактов в .superloopy/evidence/agent-first-2026-07-19/ —
 * скриншоты стадий + сырой ответ /agent/execute (квитанция) + journey-iab.json.
 * Ничего не мокается; в конце — компенсирующий откат, прогон повторяем.
 * Шаги журнея — в smokeHelpers (общие с agent-scenario-commit.spec.ts).
 * Запуск: pnpm exec playwright test e2e/runtime/agent-first-evidence.spec.ts --project=chromium
 */
test("agent-first journey: цикл с фиксацией evidence-артефактов", async ({ page }) => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: path.join(EVIDENCE_DIR, name), fullPage: true });

  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });

  const journey = await runAgentOverloadResolutionJourney(page, {
    onStage: async (stage) => {
      if (stage === "thread") await shot("01-agent-thread.png");
      if (stage === "proposal") await shot("02-proposal-card.png");
      if (stage === "receipt") await shot("03-receipt.png");
    }
  });

  expect(journey.executeResponse.status()).toBe(200);
  const receiptBody = (await journey.executeResponse.json()) as {
    correlationId?: string;
    results?: Array<{ status?: string; auditEventId?: string; planningAuditEventId?: string; planVersion?: number; projectId?: string }>;
  };
  // Квитанция адресуема: correlationId + audit-события реального применения.
  expect(typeof receiptBody.correlationId).toBe("string");
  const applied = (receiptBody.results ?? []).find((item) => item.status === "applied");
  // Хойстим id и ассертим строго — без фолбэка `?? ""`, который превращал бы
  // отсутствующий id в вакуумную проверку attribute === "".
  const planningAuditEventId = applied?.planningAuditEventId;
  expect(applied?.auditEventId).toBeTruthy();
  expect(planningAuditEventId).toBeTruthy();
  fs.writeFileSync(path.join(EVIDENCE_DIR, "execute-receipt.json"), JSON.stringify(receiptBody, null, 2));

  // Квитанция ведёт к реальному коммиту плана.
  await expect(journey.selectedCommitRow).toHaveAttribute("data-audit-event-id", planningAuditEventId!);
  await shot("04-commit-selected.png");

  // Компенсирующий откат через превью-гейт — план возвращён, спек повторяем.
  await revertLastPlanCommit(page);
  await shot("05-revert-applied.png");

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "journey-iab.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        browser: "Playwright chromium (live backend, no route mocks)",
        role: "admin",
        checks: {
          proposalCardVisible: true,
          executeStatus: journey.executeResponse.status(),
          correlationId: receiptBody.correlationId ?? null,
          appliedAuditEventId: applied?.auditEventId ?? null,
          appliedPlanningAuditEventId: planningAuditEventId ?? null,
          appliedPlanVersion: applied?.planVersion ?? null,
          projectId: applied?.projectId ?? null,
          commitRowMatchesReceipt: true,
          compensatingRevertApplied: true
        },
        status: "pass"
      },
      null,
      2
    )
  );
});
