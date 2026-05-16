import { expect, test } from "@playwright/test";

import {
  getKpiAudit,
  listDefinitions,
  listSignals,
  openKpiDefinitionAdmin,
  phase7ApiBaseUrl,
  phase7DraftPayload,
  phase7Seed,
  resetPhase7Fixtures,
  tenantADefinitionId,
  tenantADraftDefinitionId
} from "./helpers";

function jsonRequest(body: unknown) {
  return {
    headers: { "content-type": "application/json" },
    data: body
  };
}

test("E2E-064 unauthorized user cannot edit KPI definitions and backend denies direct mutation or tenant leakage", async ({
  page,
  request
}) => {
  await resetPhase7Fixtures(request);
  await openKpiDefinitionAdmin(page, phase7Seed.tenantA.readOnlyUserId);

  await expect(page.getByTestId("kpi-definition-readonly")).toContainText("нет права kpi.config:write");
  await expect(page.getByRole("button", { name: "Проверить формулу" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Создать черновик" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Опубликовать версию" })).toHaveCount(0);
  await expect(page.getByTestId(`kpi-definition-${tenantADefinitionId}`)).toContainText("Опубликована");

  const readOnlyCreate = await request.post(
    `${phase7ApiBaseUrl()}/api/kpi/definitions?testUser=${encodeURIComponent(phase7Seed.tenantA.readOnlyUserId)}`,
    jsonRequest(phase7DraftPayload())
  );
  expect(readOnlyCreate.status()).toBe(403);
  await expect(readOnlyCreate.json()).resolves.toMatchObject({ code: "permission_denied" });

  const tenantBReadTenantA = await request.get(
    `${phase7ApiBaseUrl()}/api/kpi/definitions/${encodeURIComponent(tenantADefinitionId)}?testUser=${encodeURIComponent(
      phase7Seed.tenantB.adminUserId
    )}`
  );
  expect(tenantBReadTenantA.status()).toBe(404);
  const tenantBReadTenantABody = await tenantBReadTenantA.text();
  expect(tenantBReadTenantABody).not.toContain(tenantADefinitionId);
  expect(tenantBReadTenantABody).not.toContain(phase7Seed.tenantA.definition.projectId);

  const tenantBPublishTenantA = await request.post(
    `${phase7ApiBaseUrl()}/api/kpi/definitions/${encodeURIComponent(tenantADefinitionId)}/publish?testUser=${encodeURIComponent(
      phase7Seed.tenantB.adminUserId
    )}`,
    jsonRequest({ expectedVersion: 1 })
  );
  expect(tenantBPublishTenantA.status()).toBe(404);
  expect(await tenantBPublishTenantA.text()).not.toContain(phase7Seed.tenantA.definition.projectId);

  await expect(page.getByTestId("kpi-definition-audit")).toContainText("Аудит пока пуст");
  expect((await getKpiAudit(request)).actionExecutions).toEqual([]);

  const tenantBDefinitions = await listDefinitions(request, phase7Seed.tenantB.adminUserId);
  expect(tenantBDefinitions.map((definition) => definition.id)).toEqual([phase7Seed.tenantB.definition.id]);
  expect(JSON.stringify(tenantBDefinitions)).not.toContain(tenantADefinitionId);
  expect(JSON.stringify(tenantBDefinitions)).not.toContain(phase7Seed.tenantA.definition.projectId);

  const tenantBSignals = await listSignals(request, phase7Seed.tenantB.adminUserId);
  expect(tenantBSignals.map((signal) => signal.id).sort()).toEqual(
    [phase7Seed.tenantB.signal.id, phase7Seed.tenantB.warningSignal.id].sort()
  );
  expect(JSON.stringify(tenantBSignals)).not.toContain(phase7Seed.tenantA.signal.id);
  expect(JSON.stringify(tenantBSignals)).not.toContain(phase7Seed.tenantA.warningSignal.sourceEntityId);

  await page.reload();
  await expect(page.getByTestId("kpi-definition-readonly")).toContainText("нет права kpi.config:write");
  await expect(page.getByRole("button", { name: "Создать черновик" })).toHaveCount(0);

  await resetPhase7Fixtures(request);
  const adminDefinitions = await request.get(
    `${phase7ApiBaseUrl()}/api/kpi/definitions?testUser=${encodeURIComponent(phase7Seed.tenantA.adminUserId)}`
  );
  await expect(adminDefinitions).toBeOK();
  expect(await adminDefinitions.json()).toMatchObject({
    definitions: expect.not.arrayContaining([expect.objectContaining({ id: tenantADraftDefinitionId })])
  });
});
