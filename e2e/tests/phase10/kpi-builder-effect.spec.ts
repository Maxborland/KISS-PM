import { expect, test } from "@playwright/test";

import {
  getConfigurationAudit,
  getKpiThresholds,
  jsonRequest,
  openKpiThresholds,
  phase10ApiBaseUrl,
  resetPhase10Fixtures,
  runFutureKpiEvaluation,
  tenantA
} from "./helpers";

test("E2E-092 admin edits KPI threshold and future evaluation changes while history remains traceable", async ({
  page,
  request
}) => {
  await resetPhase10Fixtures(request);
  await openKpiThresholds(page);

  await expect(page.getByTestId("kpi-threshold-readback")).toContainText("v1");
  await page.getByTestId("kpi-threshold-builder-surface").getByRole("button", { name: "Предпросмотр влияния" }).click();
  await expect(page.getByTestId("kpi-threshold-preview")).toContainText("Состояние еще не изменено");
  expect((await getKpiThresholds(request)).thresholds[0]!.thresholdRuleSet.version).toBe(1);

  const readOnlyPreview = await request.post(
    `${phase10ApiBaseUrl()}/api/tenant/kpi-thresholds/preview?testUser=${encodeURIComponent(tenantA.readOnlyUserId)}`,
    jsonRequest({
      definitionId: tenantA.kpiThreshold.definitionId,
      expectedVersion: 1,
      rules: tenantA.kpiThreshold.rules,
      sampleValue: tenantA.kpiThreshold.sampleValue,
      affectedRuntimeSurfaces: ["kpi.deviation.control"]
    })
  );
  expect(readOnlyPreview.status()).toBe(403);

  await page.getByTestId("kpi-threshold-builder-surface").getByRole("button", { name: "Опубликовать пороги" }).click();
  await expect(page.getByTestId("kpi-threshold-readback")).toContainText("v2");
  await expect(page.getByTestId("kpi-threshold-result")).toContainText("kpi_threshold.publish");
  await expect(page.getByTestId("kpi-threshold-audit")).toContainText("kpi_threshold.publish");

  const future = await runFutureKpiEvaluation(request);
  expect(future.evaluation).toMatchObject({
    severity: "warning",
    thresholdRuleSetVersion: 2,
    matchedThresholdRuleId: "schedule-variance-warning"
  });
  const historical = await request.get(
    `${phase10ApiBaseUrl()}/api/kpi/evaluations/eval-kpi-schedule-variance-a-1?testUser=${encodeURIComponent(tenantA.adminUserId)}`
  );
  await expect(historical).toBeOK();
  await expect(historical.json()).resolves.toMatchObject({
    evaluation: { severity: "critical", thresholdRuleSetVersion: 1 }
  });
  expect((await getConfigurationAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "kpi_threshold.publish" })])
  );

  await page.reload();
  await expect(page.getByTestId("kpi-threshold-readback")).toContainText("v2");

  await resetPhase10Fixtures(request);
  expect((await getKpiThresholds(request)).thresholds[0]!.thresholdRuleSet.version).toBe(1);
});
