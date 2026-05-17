import { expect, test } from "@playwright/test";

import { applyImport, getMappings, openIntegrationAdmin, previewImport, resetPhase11Fixtures, tenantA } from "./helpers";

test("E2E-101 repeated import is idempotent and does not duplicate mappings", async ({ page, request }) => {
  await resetPhase11Fixtures(request);
  const preview = await previewImport(request);

  const firstApply = await applyImport(request, preview.preview.id, tenantA.idempotencyBatchId, tenantA.idempotencyKey);
  expect(firstApply.result).toMatchObject({ status: "applied", idempotentReplay: false });
  expect(firstApply.readback.batches).toHaveLength(1);
  expect(firstApply.readback.mappings).toHaveLength(tenantA.expectedMappingEntityTypes.length);

  const replay = await applyImport(request, preview.preview.id, tenantA.idempotencyReplayBatchId, tenantA.idempotencyKey);
  expect(replay.result).toMatchObject({ status: "idempotent_replay", idempotentReplay: true });
  expect(replay.readback.batches).toEqual([expect.objectContaining({ id: tenantA.idempotencyBatchId })]);
  expect(replay.readback.mappings).toHaveLength(tenantA.expectedMappingEntityTypes.length);

  await openIntegrationAdmin(page);
  await expect(page.getByTestId("integration-mapping-table")).toContainText("synced");
  await expect(page.getByTestId("integration-audit-panel")).toContainText("import_apply");

  const mappingsAfterUiReadback = await getMappings(request);
  expect(mappingsAfterUiReadback).toHaveLength(tenantA.expectedMappingEntityTypes.length);

  await page.reload();
  await expect(page.getByTestId("integration-mapping-table")).toContainText("synced");

  await resetPhase11Fixtures(request);
  await expect.poll(async () => (await getMappings(request)).length).toBe(0);
});
