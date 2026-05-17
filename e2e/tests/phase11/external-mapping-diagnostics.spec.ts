import { expect, test } from "@playwright/test";

import {
  applyImport,
  getMappings,
  jsonRequest,
  openIntegrationAdmin,
  phase11ApiBaseUrl,
  previewImport,
  resetPhase11Fixtures,
  tenantA,
  tenantB
} from "./helpers";

test("E2E-104 external mapping diagnostics are tenant-scoped and reset-clean", async ({ page, request }) => {
  await resetPhase11Fixtures(request);
  const preview = await previewImport(request);
  const apply = await applyImport(request, preview.preview.id, tenantA.diagnosticsBatchId, `${tenantA.idempotencyKey}-104`);

  await openIntegrationAdmin(page);
  await expect(page.getByTestId("integration-mapping-table")).toContainText("mock-crm");
  await expect(page.getByTestId("integration-mapping-table")).toContainText("synced");
  await expect(page.getByTestId("integration-audit-panel")).toContainText("import_apply");

  const tenantAMappings = await getMappings(request);
  expect(tenantAMappings).toHaveLength(tenantA.expectedMappingEntityTypes.length);
  expect(tenantAMappings.map((mapping) => mapping.canonicalEntityType).sort()).toEqual(
    tenantA.expectedMappingEntityTypes.slice().sort()
  );

  await openIntegrationAdmin(page, tenantB.adminUserId);
  await expect(page.getByTestId("integration-mapping-table")).toContainText("Пока нет mappings");
  await expect(page.getByTestId("integration-mapping-table")).not.toContainText(apply.readback.mappings[0]!.canonicalEntityId);
  expect(await getMappings(request, tenantB.adminUserId)).toEqual([]);

  const tenantBReport = await request.get(
    `${phase11ApiBaseUrl()}/api/integrations/import/previews/${encodeURIComponent(preview.preview.id)}/report?testUser=${encodeURIComponent(
      tenantB.adminUserId
    )}`
  );
  expect(tenantBReport.status()).toBe(403);
  await expect(tenantBReport.text()).resolves.not.toContain(tenantA.connectionId);

  const tenantBApply = await request.post(
    `${phase11ApiBaseUrl()}/api/integrations/import/apply?testUser=${encodeURIComponent(tenantB.adminUserId)}`,
    jsonRequest({
      previewId: preview.preview.id,
      batchId: "batch-tenant-b-cross-e2e-104",
      idempotencyKey: "idem-tenant-b-cross-e2e-104",
      confirmed: true
    })
  );
  expect(tenantBApply.status()).toBe(403);
  await expect(tenantBApply.text()).resolves.not.toContain(tenantA.importedProjectTitle);

  await resetPhase11Fixtures(request);
  expect(await getMappings(request)).toEqual([]);
  expect(await getMappings(request, tenantB.adminUserId)).toEqual([]);
});
