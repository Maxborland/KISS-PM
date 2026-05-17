import { expect, test } from "@playwright/test";

import { getEvaluation, getSignalDetail, openKpiDeviationControl, phase7Seed, resetPhase7Fixtures } from "./helpers";

test("E2E-062 user opens KPI deviation and sees source, formula, threshold, and recommendation trace", async ({
  page,
  request
}) => {
  await resetPhase7Fixtures(request);
  await openKpiDeviationControl(page);

  const detail = page.getByTestId("kpi-deviation-detail");
  await expect(detail).toContainText(phase7Seed.tenantA.signal.id);
  await expect(detail).toContainText(phase7Seed.tenantA.signal.evaluationId);
  await expect(detail).toContainText(phase7Seed.tenantA.definition.formulaId);
  await expect(detail).toContainText(phase7Seed.tenantA.definition.thresholdRuleSetId);
  await expect(detail).toContainText("plannedWorkHours: 80");
  await expect(detail).toContainText("actualWorkHours: 100");
  await expect(detail).toContainText("result:-25");
  await expect(detail).toContainText("matched:schedule-variance-critical:critical");
  await expect(detail).toContainText("Создать корректирующее действие");
  await expect(detail).toContainText("Эскалировать");

  await page.getByTestId("kpi-deviation-primary-action").click();
  await expect(page.getByText("P8 получит сигнал")).toBeVisible();

  const apiDetail = await getSignalDetail(request);
  expect(apiDetail.signal.recommendedActionKeys).toEqual(
    expect.arrayContaining(phase7Seed.tenantA.signal.recommendedActionKeys)
  );
  expect(apiDetail.evaluation.sourceTrace).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ bindingKey: "plannedWorkHours", value: 80, sourceEntityId: "project-alpha-a" }),
      expect.objectContaining({ bindingKey: "actualWorkHours", value: 100, sourceEntityId: "project-alpha-a" })
    ])
  );
  expect(apiDetail.evaluation.formulaTrace).toContain("result:-25");
  expect(apiDetail.evaluation.thresholdTrace).toContain("matched:schedule-variance-critical:critical");

  await page.getByTestId("kpi-deviation-list").getByRole("button", { name: /project-warning-a/ }).click();
  await expect(page.getByTestId("kpi-deviation-detail")).toContainText(phase7Seed.tenantA.warningSignal.id);
  await expect(page.getByTestId("kpi-deviation-detail")).toContainText("matched:schedule-variance-warning:warning");
  await expect(page.getByTestId("kpi-deviation-detail")).toContainText("Запросить объяснение");

  const evaluationReadback = await getEvaluation(request);
  expect(evaluationReadback).toMatchObject({
    id: phase7Seed.tenantA.signal.evaluationId,
    thresholdRuleSetId: phase7Seed.tenantA.definition.thresholdRuleSetId,
    matchedThresholdRuleId: phase7Seed.tenantA.definition.criticalRuleId
  });

  await page.reload();
  await expect(page.getByTestId("kpi-deviation-detail")).toContainText("plannedWorkHours: 80");
  await expect(page.getByTestId("kpi-deviation-detail")).toContainText("matched:schedule-variance-critical:critical");

  await resetPhase7Fixtures(request);
  expect((await getSignalDetail(request)).evaluation.id).toBe(phase7Seed.tenantA.signal.evaluationId);
});
