import { expect, test } from "@playwright/test";

import { getIntegrationAudit, getMappings, jsonRequest, openIntegrationAdmin, phase11ApiBaseUrl, resetPhase11Fixtures, tenantA } from "./helpers";

test("E2E-102 adapter failure is visible, safe, backend-guarded, and recoverable", async ({ page, request }) => {
  await resetPhase11Fixtures(request);
  await openIntegrationAdmin(page);

  await page.getByRole("button", { name: "Включить rate-limit" }).click();
  await expect(page.getByTestId("integration-diagnostics-panel")).toContainText("adapter_rate_limited");

  await page.getByRole("button", { name: "Предпросмотреть импорт" }).click();
  await expect(page.getByTestId("integration-command-error")).toContainText("Адаптер временно ограничил запросы");
  await expect(page.getByTestId("integration-mapping-table")).toContainText("Пока нет mappings");
  await expect.poll(async () => (await getMappings(request)).length).toBe(0);

  const audit = await getIntegrationAudit(request);
  expect(audit.audit).toEqual(expect.arrayContaining([expect.objectContaining({ command: "import_preview", result: "failed" })]));

  const readOnlyFailure = await request.post(
    `${phase11ApiBaseUrl()}/api/integrations/connections/${encodeURIComponent(tenantA.connectionId)}/failure-mode?testUser=${encodeURIComponent(
      tenantA.readOnlyUserId
    )}`,
    jsonRequest({ code: "adapter_rate_limited", message: "read-only should not mutate" })
  );
  expect(readOnlyFailure.status()).toBe(403);
  await expect(readOnlyFailure.text()).resolves.not.toContain(tenantA.importedProjectTitle);

  await page.getByRole("button", { name: "Снять сбой" }).click();
  await expect(page.getByTestId("integration-diagnostics-panel")).toContainText("healthy");
  await page.getByRole("button", { name: "Предпросмотреть импорт" }).click();
  await expect(page.getByTestId("integration-import-preview")).toContainText("Состояние еще не изменено");

  await resetPhase11Fixtures(request);
  await expect.poll(async () => (await getMappings(request)).length).toBe(0);
});
