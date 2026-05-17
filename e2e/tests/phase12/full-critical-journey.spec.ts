import { expect, test } from "@playwright/test";

import {
  createManagedProject as createPortfolioProject,
  getControlAudit,
  getPortfolioView,
  listProjectTasks,
  openPortfolioControl,
  portfolioActionPanel,
  tenantA as phase8Tenant
} from "../phase8/helpers";
import {
  createClosableProject,
  getClosure,
  getClosedPortfolio,
  getRetrospectiveAudit,
  openClosedPortfolio,
  openProjectClosure,
  tenantA as phase9Tenant
} from "../phase9/helpers";
import { applyImport, getIntegrationAudit, getMappings, openIntegrationAdmin, previewImport } from "../phase11/helpers";
import { getOpsAudit, openKissPm, phase12Users, resetPhase12Fixtures, tenantA } from "./helpers";

test("E2E-110 full release-critical journey reaches retrospective action with API readback, audit, reload, and cleanup", async ({
  page,
  request
}) => {
  await resetPhase12Fixtures(request);

  await openKissPm(page, phase12Users.tenantAdmin);
  await expect(page.getByTestId("crm-intake-surface")).toContainText("Внедрение портала АКМЕ");
  await expect(page.getByTestId("configuration-overview-surface")).toBeVisible();

  await createPortfolioProject(request);
  await openPortfolioControl(page, phase8Tenant.projectManagerUserId);
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText(phase8Tenant.criticalSignalId);
  await page.getByRole("button", { name: "Создать корректирующую задачу" }).click();
  await portfolioActionPanel(page).getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByTestId("portfolio-control-preview")).toContainText("corrective_task.create");
  expect(await listProjectTasks(request)).toEqual([]);

  await portfolioActionPanel(page).getByRole("button", { name: "Применить после preview" }).click();
  await expect(page.getByTestId("portfolio-control-result")).toContainText("corrective_task.create: succeeded");
  const correctiveTasks = await listProjectTasks(request);
  expect(correctiveTasks).toEqual([
    expect.objectContaining({ projectId: phase8Tenant.projectId, title: "Корректирующее действие по контрольному сигналу" })
  ]);
  expect((await getControlAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "corrective_task.create" })])
  );
  expect((await getPortfolioView(request)).rows.find((row) => row.id === phase8Tenant.criticalSignalRowId)?.explanation).toContain(
    correctiveTasks[0]!.id
  );

  await openIntegrationAdmin(page, phase12Users.integrationAdmin);
  const importPreview = await previewImport(request, phase12Users.integrationAdmin);
  expect(importPreview.dryRunSummary.mutatesState).toBe(false);
  expect(await getMappings(request, phase12Users.integrationAdmin)).toEqual([]);
  const importApply = await applyImport(
    request,
    importPreview.preview.id,
    tenantA.criticalJourney.integrationBatchId,
    "p12-e2e-110-import",
    phase12Users.integrationAdmin
  );
  expect(importApply.result.status).toBe("applied");
  expect((await getIntegrationAudit(request, phase12Users.integrationAdmin)).audit).toEqual(
    expect.arrayContaining([expect.objectContaining({ command: "import_apply", result: "success" })])
  );
  expect((await getMappings(request, phase12Users.integrationAdmin)).map((mapping) => mapping.canonicalEntityType).sort()).toEqual(
    ["account", "contact", "opportunity", "project", "task"].sort()
  );

  const closableProjectId = await createClosableProject(request, phase9Tenant.closureProjectId);
  await openProjectClosure(page, phase9Tenant.projectManagerUserId);
  await expect(page.getByTestId("project-closure-project-state")).toContainText("active");
  await page.getByRole("button", { name: "Предпросмотр закрытия" }).click();
  await expect(page.getByTestId("project-closure-preview")).toContainText("Без мутации");
  expect(await getClosure(request, closableProjectId)).toMatchObject({ project: { lifecycleStatus: "active" }, snapshots: [] });

  await page.getByRole("button", { name: "Закрыть проект" }).click();
  await expect(page.getByTestId("project-closure-result")).toContainText("project.closure.apply");
  const closureReadback = await getClosure(request, closableProjectId);
  expect(closureReadback).toMatchObject({
    project: { lifecycleStatus: "completed" },
    latestSnapshot: { id: `snapshot-${closableProjectId}-1` }
  });

  const retrospectiveAudit = await getRetrospectiveAudit(request);
  expect(retrospectiveAudit.actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "project.closure.apply" })])
  );

  await openClosedPortfolio(page, phase9Tenant.adminUserId);
  await expect(page.getByTestId("closed-portfolio-row-list")).toContainText("Внедрение портала АКМЕ");
  expect((await getClosedPortfolio(request)).rows).toEqual(
    expect.arrayContaining([expect.objectContaining({ entityId: `snapshot-${closableProjectId}-1` })])
  );

  await page.reload();
  await expect(page.getByTestId("closed-portfolio-surface")).toBeVisible();
  await expect(page.getByTestId("closed-portfolio-row-list")).toContainText("Внедрение портала АКМЕ");
  expect((await getOpsAudit(request)).events).toEqual([]);

  await resetPhase12Fixtures(request);
  const afterReset = await request.get(
    `${process.env.PW_API_PORT ? `http://127.0.0.1:${process.env.PW_API_PORT}` : "http://127.0.0.1:4187"}/api/projects/${encodeURIComponent(
      closableProjectId
    )}/closure?testUser=${encodeURIComponent(phase9Tenant.projectManagerUserId)}`
  );
  expect(afterReset.status()).toBe(404);
});
