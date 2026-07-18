import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { loginToWorkspace } from "../smoke/smokeHelpers";

const EVIDENCE_DIR = path.join(".superloopy", "evidence", "agent-first-2026-07-19");

/**
 * Journey-evidence Блока 7 (agent-first / PM-as-code): живой прогон полного цикла
 * с фиксацией артефактов в .superloopy/evidence/agent-first-2026-07-19/ —
 * скриншоты стадий + сырой ответ /agent/execute (квитанция) + journey-iab.json.
 * Ничего не мокается; в конце — компенсирующий откат, прогон повторяем.
 * Запуск: pnpm exec playwright test e2e/runtime/agent-first-evidence.spec.ts --project=chromium
 */
test("agent-first journey: цикл с фиксацией evidence-артефактов", async ({ page }) => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: path.join(EVIDENCE_DIR, name), fullPage: true });

  await page.goto("/");
  await loginToWorkspace(page, { email: "admin@kiss-pm.local", password: "admin12345" });
  await page.goto("/agent");

  const composer = page.getByRole("textbox", { name: "Сообщение Генри Гантту" });
  await expect(composer).toBeEnabled();
  await shot("01-agent-thread.png");

  await composer.fill("Разгрузи перегруженный ресурс");
  await page.getByRole("button", { name: "Отправить" }).click();

  // Payload-backed карточка предложения с версией плана в preconditions.
  await expect(page.getByText(/Применить сценарий разрешения перегрузки/).first()).toBeVisible({ timeout: 15_000 });
  await shot("02-proposal-card.png");

  const executeResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/workspace/agent/execute") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Применить выбранное" }).click();
  const executeResponse = await executeResponsePromise;
  expect(executeResponse.status()).toBe(200);
  const receiptBody = (await executeResponse.json()) as {
    correlationId?: string;
    results?: Array<{ status?: string; auditEventId?: string; planningAuditEventId?: string; planVersion?: number; projectId?: string }>;
  };
  // Квитанция адресуема: correlationId + audit-события реального применения.
  expect(typeof receiptBody.correlationId).toBe("string");
  const applied = (receiptBody.results ?? []).find((item) => item.status === "applied");
  expect(applied?.auditEventId).toBeTruthy();
  expect(applied?.planningAuditEventId).toBeTruthy();
  fs.writeFileSync(path.join(EVIDENCE_DIR, "execute-receipt.json"), JSON.stringify(receiptBody, null, 2));

  await expect(page.getByText("Результат: применено 1, отказано 0, конфликтов 0, ошибок 0.").last()).toBeVisible();
  await shot("03-receipt.png");

  // Квитанция ведёт к реальному коммиту плана.
  const receipt = page.getByTestId("agent-receipt").last();
  const commitLink = receipt.getByRole("link", { name: "Открыть в Коммитах" });
  await expect(commitLink).toBeVisible();
  await commitLink.click();
  await expect(page).toHaveURL(/\/commits\?commit=/);
  const selectedRow = page.locator('[data-testid="commit-row"][aria-pressed="true"]');
  await expect(selectedRow).toHaveAttribute("data-audit-event-id", applied?.planningAuditEventId ?? "");
  await shot("04-commit-selected.png");

  // Компенсирующий откат через превью-гейт — план возвращён, спек повторяем.
  await page.getByRole("button", { name: "Откатить последний", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Предпросмотр изменений" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Применить изменения", exact: true }).click();
  await expect(page.getByText(/Откат применён компенсирующим коммитом/)).toBeVisible();
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
          executeStatus: executeResponse.status(),
          correlationId: receiptBody.correlationId ?? null,
          appliedAuditEventId: applied?.auditEventId ?? null,
          appliedPlanningAuditEventId: applied?.planningAuditEventId ?? null,
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
