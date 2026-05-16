import { expect, test } from "@playwright/test";

import { createManagedProject, getPortfolioView, openPortfolioControl, phase8ApiBaseUrl, resetPhase8Fixtures, tenantA } from "./helpers";

test("E2E-070 user opens Portfolio Control and drills into project Gantt", async ({ page, request }) => {
  await resetPhase8Fixtures(request);
  await createManagedProject(request);
  await openPortfolioControl(page);

  await expect(page.getByTestId("portfolio-control-row-list")).toContainText(tenantA.criticalSignalId);
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText(tenantA.resourceOverloadId);
  await expect(page.getByTestId("portfolio-control-detail")).toContainText(tenantA.projectId);
  await expect(page.getByTestId("portfolio-control-widget-critical_signal_count")).toBeVisible();

  const view = await getPortfolioView(request);
  expect(view.rows.map((row) => row.id)).toEqual(
    expect.arrayContaining([tenantA.criticalSignalRowId, tenantA.warningSignalRowId, tenantA.resourceOverloadRowId])
  );

  await page.getByRole("button", { name: "Открыть Гантт" }).first().click();
  await expect(page.getByLabel("ID проекта для Гантта")).toHaveValue(tenantA.projectId);
  await expect(page.getByTestId("gantt-status")).toContainText("Гантт загружен");
  await expect(page.getByTestId("gantt-surface")).not.toContainText("project-private-b");

  const tenantBReadTenantA = await request.get(
    `${phase8ApiBaseUrl()}/api/control/surfaces/${encodeURIComponent(tenantA.surfaceId)}/view?testUser=tenant-admin-b`
  );
  await expect(tenantBReadTenantA).toBeOK();
  const tenantBText = await tenantBReadTenantA.text();
  expect(tenantBText).not.toContain(tenantA.projectId);
  expect(tenantBText).not.toContain(tenantA.criticalSignalId);
});
