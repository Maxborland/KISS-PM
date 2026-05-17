import { expect, test } from "@playwright/test";

import {
  createManagedProject,
  getControlAudit,
  getPortfolioView,
  kpiTarget,
  listProjectTasks,
  openPortfolioControl,
  portfolioActionPanel,
  previewAction,
  executeAction,
  resetPhase8Fixtures,
  tenantA
} from "../phase8/helpers";
import { getEvaluation, getSignalDetail, resetPhase7Fixtures, tenantASignalId } from "../phase7/helpers";

test("E2E-R2-001 Portfolio Control: signal to governed action to audit/readback", async ({ page, request }) => {
  await resetPhase8Fixtures(request);
  await createManagedProject(request);
  expect(await listProjectTasks(request)).toEqual([]);

  await openPortfolioControl(page, tenantA.projectManagerUserId);
  await expect(page.getByTestId("operational-surface-shell")).toContainText("Портфельный контроль");
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText(tenantA.criticalSignalId);

  await page.getByRole("button", { name: "Создать корректирующую задачу" }).click();
  await portfolioActionPanel(page).getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByTestId("portfolio-control-preview")).toContainText("corrective_task.create");
  expect(await listProjectTasks(request)).toEqual([]);

  await portfolioActionPanel(page).getByRole("button", { name: "Применить после preview" }).click();
  await expect(page.getByTestId("portfolio-control-result")).toContainText("corrective_task.create: succeeded");
  await expect(page.getByTestId("portfolio-control-audit")).toContainText("corrective_task.create");

  const tasks = await listProjectTasks(request);
  expect(tasks).toEqual([expect.objectContaining({ projectId: tenantA.projectId, status: "todo" })]);
  expect((await getPortfolioView(request)).rows.find((row) => row.id === tenantA.criticalSignalRowId)?.explanation).toContain(
    tasks[0]!.id
  );
  expect((await getControlAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "corrective_task.create", status: "succeeded" })])
  );

  await page.reload();
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText(tasks[0]!.id);
});

test("E2E-R2-006 KPI Deviation: source trace to corrective action or accepted risk", async ({ request }) => {
  await resetPhase7Fixtures(request);

  const signal = await getSignalDetail(request, tenantASignalId);
  const evaluation = await getEvaluation(request, signal.evaluation.id);
  expect(evaluation.sourceTrace.length).toBeGreaterThan(0);
  expect(evaluation.formulaTrace.length).toBeGreaterThan(0);
  expect(evaluation.thresholdTrace.length).toBeGreaterThan(0);
  expect(signal.signal.recommendedActionKeys).toEqual(expect.arrayContaining(["create_corrective_action"]));

  await resetPhase8Fixtures(request);
  await createManagedProject(request);
  const preview = await previewAction(
    request,
    tenantA.actions.acceptRisk,
    kpiTarget(),
    { reason: "Release 2 accepted risk path with source trace" },
    tenantA.adminUserId
  );
  expect(preview.preview.mutatesState).toBe(false);
  const result = await executeAction(request, tenantA.actions.acceptRisk, preview.preview.id, tenantA.adminUserId);
  expect(result.result.commandType).toBe("risk.accept");
  expect((await getControlAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "risk.accept", status: "succeeded" })])
  );
});
