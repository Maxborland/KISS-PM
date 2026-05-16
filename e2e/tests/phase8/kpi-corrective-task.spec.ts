import { expect, test } from "@playwright/test";

import {
  createManagedProject,
  getControlAudit,
  getPortfolioView,
  jsonRequest,
  kpiTarget,
  listProjectTasks,
  openPortfolioControl,
  phase8ApiBaseUrl,
  portfolioActionPanel,
  resetPhase8Fixtures,
  tenantA
} from "./helpers";

test("E2E-071 project manager creates corrective task from KPI signal with audit and readback", async ({
  page,
  request
}) => {
  await resetPhase8Fixtures(request);
  await createManagedProject(request);
  expect(await listProjectTasks(request)).toEqual([]);

  const deniedPreview = await request.post(
    `${phase8ApiBaseUrl()}/api/control/actions/${encodeURIComponent(tenantA.actions.corrective)}/preview?testUser=${encodeURIComponent(
      tenantA.resourceManagerUserId
    )}`,
    jsonRequest({
      target: kpiTarget(),
      input: {
        title: "Ресурсный менеджер не должен создавать корректирующую задачу",
        dueDate: "2026-06-12"
      }
    })
  );
  await expect(deniedPreview).toBeOK();
  const deniedPreviewBody = (await deniedPreview.json()) as { preview: { id: string } };
  const deniedExecute = await request.post(
    `${phase8ApiBaseUrl()}/api/control/actions/${encodeURIComponent(tenantA.actions.corrective)}/execute?testUser=${encodeURIComponent(
      tenantA.resourceManagerUserId
    )}`,
    jsonRequest({ previewId: deniedPreviewBody.preview.id })
  );
  expect(deniedExecute.status()).toBe(403);
  await expect(deniedExecute.json()).resolves.toMatchObject({ code: "permission_denied" });
  expect(await listProjectTasks(request)).toEqual([]);
  await expect(getControlAudit(request)).resolves.toMatchObject({ actionExecutions: [] });

  await openPortfolioControl(page, tenantA.projectManagerUserId);
  await page.getByRole("button", { name: "Создать корректирующую задачу" }).click();
  await portfolioActionPanel(page).getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByTestId("portfolio-control-preview")).toContainText("corrective_task.create");
  expect(await listProjectTasks(request)).toEqual([]);

  await portfolioActionPanel(page).getByRole("button", { name: "Применить после preview" }).click();
  await expect(page.getByTestId("portfolio-control-result")).toContainText("corrective_task.create: succeeded");
  await expect(page.getByTestId("portfolio-control-audit")).toContainText("corrective_task.create");

  const tasksAfter = await listProjectTasks(request);
  expect(tasksAfter).toEqual([
    expect.objectContaining({
      projectId: tenantA.projectId,
      status: "todo",
      title: "Корректирующее действие по контрольному сигналу"
    })
  ]);
  const auditAfter = await getControlAudit(request);
  expect(auditAfter.actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        commandType: "corrective_task.create",
        source: { entityType: "kpi_signal", entityId: tenantA.criticalSignalId },
        target: { entityType: "task", entityId: tasksAfter[0].id }
      })
    ])
  );
  const refreshedView = await getPortfolioView(request);
  expect(refreshedView.rows.find((row) => row.id === tenantA.criticalSignalRowId)?.explanation).toContain(tasksAfter[0].id);

  await page.reload();
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText(tasksAfter[0].id);
  await expect(page.getByTestId("portfolio-control-audit")).toContainText("corrective_task.create");

  await resetPhase8Fixtures(request);
  await createManagedProject(request);
  expect(await listProjectTasks(request)).toEqual([]);
});
