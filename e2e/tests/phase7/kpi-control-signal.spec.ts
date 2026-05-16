import { expect, test } from "@playwright/test";

import {
  getKpiAudit,
  getSignalDetail,
  listSignals,
  openKpiDeviationControl,
  phase7Seed,
  resetPhase7Fixtures,
  runKpiEvaluation,
  tenantASignalId
} from "./helpers";

test("E2E-061 project state creates reproducible KPI control signal with UI and API readback", async ({
  page,
  request
}) => {
  await resetPhase7Fixtures(request);
  await openKpiDeviationControl(page);

  await expect(page.getByTestId("kpi-deviation-list")).toContainText("Критическая");
  await expect(page.getByTestId("kpi-deviation-list")).toContainText("Риск");
  await expect(page.getByTestId("kpi-deviation-list")).toContainText(phase7Seed.tenantA.definition.projectId);
  await expect(page.getByTestId("kpi-deviation-list")).toContainText(phase7Seed.tenantA.warningSignal.sourceEntityId);
  await expect(page.getByTestId("kpi-deviation-detail")).toContainText(tenantASignalId);

  const seededSignal = await getSignalDetail(request);
  expect(seededSignal.signal).toMatchObject({
    id: tenantASignalId,
    severity: phase7Seed.tenantA.definition.expectedSeverity,
    sourceEvaluationId: phase7Seed.tenantA.signal.evaluationId,
    recommendedActionKeys: expect.arrayContaining(phase7Seed.tenantA.signal.recommendedActionKeys)
  });
  expect(seededSignal.evaluation).toMatchObject({
    value: phase7Seed.tenantA.definition.expectedValue,
    severity: phase7Seed.tenantA.definition.expectedSeverity
  });

  await page.getByRole("button", { name: "Пересчитать KPI" }).click();
  await expect(page.getByTestId("kpi-deviation-result")).toContainText("kpi.evaluation.run");
  await expect(page.getByTestId("kpi-deviation-audit")).toContainText("kpi.evaluation.run");
  await expect(page.getByTestId("kpi-deviation-detail")).toContainText("result:-25");

  const signalsAfterUiRun = await listSignals(request);
  expect(signalsAfterUiRun.map((signal) => signal.id)).toContain(tenantASignalId);
  expect(signalsAfterUiRun).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: phase7Seed.tenantA.warningSignal.id,
        severity: phase7Seed.tenantA.warningSignal.expectedSeverity,
        sourceEvaluationId: phase7Seed.tenantA.warningSignal.evaluationId,
        recommendedActionKeys: expect.arrayContaining(phase7Seed.tenantA.warningSignal.recommendedActionKeys)
      })
    ])
  );
  expect((await getKpiAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ commandType: "kpi.evaluation.run", requiredPermission: "kpi.evaluate:execute" })
    ])
  );

  const apiRun = await runKpiEvaluation(request);
  expect(apiRun.evaluation).toMatchObject({ value: -25, severity: "critical" });
  expect(apiRun.signal).toMatchObject({ id: tenantASignalId, severity: "critical" });

  await page.reload();
  await expect(page.getByTestId("kpi-deviation-control")).toBeVisible();
  await expect(page.getByTestId("kpi-deviation-list")).toContainText("Критическая");
  await expect(page.getByTestId("kpi-deviation-audit")).toContainText("kpi.evaluation.run");

  await resetPhase7Fixtures(request);
  expect((await getKpiAudit(request)).actionExecutions).toEqual([]);
  expect((await listSignals(request)).map((signal) => signal.id).sort()).toEqual(
    [tenantASignalId, phase7Seed.tenantA.warningSignal.id].sort()
  );
});
