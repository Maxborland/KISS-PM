import { expect, test } from "@playwright/test";

import { getIntegrationAudit, getMappings, openIntegrationAdmin, resetPhase11Fixtures, tenantA } from "./helpers";

test("E2E-100 resource import preview applies canonical mappings through UI and API readback", async ({ page, request }) => {
  await resetPhase11Fixtures(request);
  await expect.poll(async () => (await getMappings(request)).length).toBe(0);

  await openIntegrationAdmin(page);
  await expect(page.getByTestId("integration-mapping-table")).toContainText("Пока нет mappings");

  await page.getByRole("button", { name: "Предпросмотреть импорт" }).click();
  await expect(page.getByTestId("integration-import-preview")).toContainText("Состояние еще не изменено");
  await expect(page.getByTestId("integration-import-preview")).toContainText("mutatesState=false");
  await expect.poll(async () => (await getMappings(request)).length).toBe(0);

  await page.getByRole("button", { name: "Применить preview" }).click();
  await expect(page.getByTestId("integration-import-result")).toContainText("import_apply");
  await expect(page.getByTestId("integration-mapping-table")).toContainText("synced");
  await expect(page.getByTestId("integration-audit-panel")).toContainText("import_apply");

  const mappings = await getMappings(request);
  expect(mappings.map((mapping) => mapping.canonicalEntityType).sort()).toEqual(
    tenantA.expectedMappingEntityTypes.slice().sort()
  );
  expect(mappings.every((mapping) => mapping.tenantId === tenantA.tenantId)).toBe(true);
  expect(mappings.every((mapping) => mapping.lastSyncStatus === "synced")).toBe(true);
  const audit = await getIntegrationAudit(request);
  expect(audit.audit).toEqual(expect.arrayContaining([expect.objectContaining({ command: "import_apply", result: "success" })]));

  await page.reload();
  await expect(page.getByTestId("integration-admin-surface")).toBeVisible();
  await expect(page.getByTestId("integration-mapping-table")).toContainText("synced");
  await expect(page.getByTestId("integration-audit-panel")).toContainText("import_apply");

  await resetPhase11Fixtures(request);
  await expect.poll(async () => (await getMappings(request)).length).toBe(0);
});
