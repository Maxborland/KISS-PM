import { expect, test } from "@playwright/test";

import {
  getKpiAudit,
  listDefinitions,
  openKpiDefinitionAdmin,
  resetPhase7Fixtures,
  tenantADraftDefinitionId
} from "./helpers";

test("E2E-060 admin defines KPI threshold with UI, API readback, audit, reload, and cleanup", async ({
  page,
  request
}) => {
  await resetPhase7Fixtures(request);
  await openKpiDefinitionAdmin(page);

  await expect(page.getByTestId("kpi-definition-list")).toContainText("kpi-schedule-variance-a");
  expect((await listDefinitions(request)).map((definition) => definition.id)).not.toContain(tenantADraftDefinitionId);

  await page.getByRole("button", { name: "Проверить формулу" }).click();
  await expect(page.getByTestId("kpi-definition-preview")).toContainText("Состояние еще не изменено");
  await expect(page.getByTestId("kpi-definition-preview")).toContainText("Критическая");
  expect((await listDefinitions(request)).map((definition) => definition.id)).not.toContain(tenantADraftDefinitionId);
  expect((await getKpiAudit(request)).actionExecutions).toEqual([]);

  await page.getByRole("button", { name: "Создать черновик" }).click();
  await expect(page.getByTestId(`kpi-definition-${tenantADraftDefinitionId}`)).toContainText("Черновик");
  await page.getByRole("button", { name: "Опубликовать версию" }).click();

  await expect(page.getByTestId("kpi-definition-result")).toContainText("kpi.definition.publish");
  await expect(page.getByTestId("kpi-definition-result")).toContainText("kpi.config:write");
  await expect(page.getByTestId("kpi-definition-audit")).toContainText("kpi.definition.publish");
  await expect(page.getByTestId(`kpi-definition-${tenantADraftDefinitionId}`)).toContainText("Опубликована");

  const definitionsAfterPublish = await listDefinitions(request);
  expect(definitionsAfterPublish).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: tenantADraftDefinitionId,
        active: true,
        thresholdRuleSet: expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({ id: "api-draft-critical", condition: { operator: "lte", value: -25 } })
          ])
        })
      })
    ])
  );
  expect((await getKpiAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ commandType: "kpi.definition.publish", requiredPermission: "kpi.config:write" })
    ])
  );

  await page.reload();
  await expect(page.getByTestId("kpi-definition-admin")).toBeVisible();
  await expect(page.getByTestId(`kpi-definition-${tenantADraftDefinitionId}`)).toContainText("Опубликована");
  await expect(page.getByTestId("kpi-definition-audit")).toContainText("kpi.definition.publish");

  await resetPhase7Fixtures(request);
  expect((await listDefinitions(request)).map((definition) => definition.id)).not.toContain(tenantADraftDefinitionId);
  expect((await getKpiAudit(request)).actionExecutions).toEqual([]);
});
