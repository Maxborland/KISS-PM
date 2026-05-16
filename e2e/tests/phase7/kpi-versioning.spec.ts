import { expect, test } from "@playwright/test";

import {
  getEvaluation,
  getKpiAudit,
  listDefinitions,
  openKpiDefinitionAdmin,
  phase7Seed,
  resetPhase7Fixtures,
  runKpiEvaluation,
  tenantADraftDefinitionId
} from "./helpers";

test("E2E-063 threshold change affects future evaluation without corrupting historical KPI trace", async ({
  page,
  request
}) => {
  await resetPhase7Fixtures(request);
  const historicalEvaluation = await getEvaluation(request);
  expect(historicalEvaluation).toMatchObject({
    id: phase7Seed.tenantA.signal.evaluationId,
    kpiDefinitionId: phase7Seed.tenantA.definition.id,
    thresholdRuleSetId: phase7Seed.tenantA.definition.thresholdRuleSetId,
    matchedThresholdRuleId: phase7Seed.tenantA.definition.criticalRuleId,
    severity: "critical"
  });

  await openKpiDefinitionAdmin(page);
  await page.getByLabel("Критический порог KPI").fill("-30");
  await page.getByRole("button", { name: "Проверить формулу" }).click();
  await expect(page.getByTestId("kpi-definition-preview")).toContainText("Норма");
  await expect(page.getByTestId("kpi-definition-preview")).toContainText("Состояние еще не изменено");

  await page.getByRole("button", { name: "Создать черновик" }).click();
  await expect(page.getByTestId(`kpi-definition-${tenantADraftDefinitionId}`)).toContainText("Черновик");
  await page.getByRole("button", { name: "Опубликовать версию" }).click();
  await expect(page.getByTestId(`kpi-definition-${tenantADraftDefinitionId}`)).toContainText("Опубликована");

  const futureRun = await runKpiEvaluation(request, tenantADraftDefinitionId);
  expect(futureRun.evaluation).toMatchObject({
    kpiDefinitionId: tenantADraftDefinitionId,
    thresholdRuleSetId: phase7Seed.tenantA.draftThresholdRuleSetId,
    value: -25,
    severity: "none",
    matchedThresholdRuleId: null
  });
  expect(futureRun.signal).toBeNull();

  const historicalReadback = await getEvaluation(request);
  expect(historicalReadback).toMatchObject({
    id: phase7Seed.tenantA.signal.evaluationId,
    thresholdRuleSetId: phase7Seed.tenantA.definition.thresholdRuleSetId,
    matchedThresholdRuleId: phase7Seed.tenantA.definition.criticalRuleId,
    severity: "critical"
  });
  expect(historicalReadback.thresholdTrace).toContain("matched:schedule-variance-critical:critical");

  const draftDefinition = (await listDefinitions(request)).find((definition) => definition.id === tenantADraftDefinitionId);
  expect(draftDefinition).toMatchObject({
    active: true,
    thresholdRuleSet: {
      rules: [expect.objectContaining({ condition: { operator: "lte", value: -30 } })]
    }
  });
  expect((await getKpiAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ commandType: "kpi.definition.publish" }),
      expect.objectContaining({ commandType: "kpi.evaluation.run" })
    ])
  );

  await page.reload();
  await expect(page.getByTestId(`kpi-definition-${tenantADraftDefinitionId}`)).toContainText("Опубликована");
  await expect(page.getByTestId("kpi-definition-audit")).toContainText("kpi.evaluation.run");

  await resetPhase7Fixtures(request);
  expect((await listDefinitions(request)).map((definition) => definition.id)).not.toContain(tenantADraftDefinitionId);
  expect((await getEvaluation(request)).thresholdRuleSetId).toBe(phase7Seed.tenantA.definition.thresholdRuleSetId);
  expect((await getKpiAudit(request)).actionExecutions).toEqual([]);
});
