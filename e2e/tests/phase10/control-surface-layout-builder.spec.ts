import { expect, test } from "@playwright/test";

import {
  getConfigurationAudit,
  getPortfolioView,
  jsonRequest,
  openActionConfigs,
  openSavedViews,
  phase10ApiBaseUrl,
  resetPhase10Fixtures,
  tenantA
} from "./helpers";

test("E2E-093 admin configures control-surface layout and action availability with reload and backend denial", async ({
  page,
  request
}) => {
  await resetPhase10Fixtures(request);
  await openSavedViews(page);

  await expect(page.getByTestId("saved-view-layout-readback")).toContainText("v1");
  await page.getByTestId("saved-view-layout-builder-surface").getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByTestId("saved-view-layout-preview")).toContainText("Состояние еще не изменено");
  expect((await getPortfolioView(request)).surface.version).toBe(1);

  const readOnlyPreview = await request.post(
    `${phase10ApiBaseUrl()}/api/tenant/saved-views/preview?testUser=${encodeURIComponent(tenantA.readOnlyUserId)}`,
    jsonRequest({
      surfaceId: tenantA.savedView.surfaceId,
      expectedSurfaceVersion: 1,
      viewLabel: tenantA.savedView.viewLabel,
      visibleFieldKeys: tenantA.savedView.visibleFieldKeys,
      filterKeys: ["severity"],
      sortKeys: ["project_label"],
      groupKeys: ["severity"],
      widgetKeys: ["critical_signal_count"],
      actionSlotKeys: ["create_corrective_action", "accept_risk"],
      savedView: {
        id: tenantA.savedView.savedViewId,
        key: tenantA.savedView.savedViewKey,
        label: tenantA.savedView.savedViewLabel,
        ownerType: "tenant",
        filterKeys: ["severity"],
        sortKeys: ["project_label"],
        groupKeys: ["severity"],
        scope: "tenant"
      },
      affectedRuntimeSurfaces: ["portfolio.control"]
    })
  );
  expect(readOnlyPreview.status()).toBe(403);

  await page.getByTestId("saved-view-layout-builder-surface").getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByTestId("saved-view-layout-readback")).toContainText("v2");
  await expect(page.getByTestId("saved-view-layout-result")).toContainText("control_surface_layout.publish");
  let portfolio = await getPortfolioView(request);
  expect(portfolio.surface.version).toBe(2);
  expect(portfolio.savedViews).toEqual(expect.arrayContaining([expect.objectContaining({ key: tenantA.savedView.savedViewKey })]));

  await openActionConfigs(page);
  await page.getByLabel("Отключить действие принятия риска").check();
  await page.getByLabel("Default причины").fill(tenantA.actionConfig.reasonDefault);
  await page.getByTestId("action-config-surface").getByRole("button", { name: "Предпросмотр действий" }).click();
  await expect(page.getByTestId("action-config-preview")).toContainText("accept_risk");
  await page.getByTestId("action-config-surface").getByRole("button", { name: "Опубликовать действия" }).click();
  await expect(page.getByTestId("action-config-readback")).toContainText("accept_risk");
  await expect(page.getByTestId("action-config-result")).toContainText("action_configuration.publish");

  portfolio = await getPortfolioView(request);
  expect(portfolio.rows.find((row) => row.id === tenantA.actionConfig.targetRowId)?.actions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: tenantA.actionConfig.disabledActionKey, available: false, unavailableReason: "configuration_disabled" })
    ])
  );
  const directPreview = await request.post(
    `${phase10ApiBaseUrl()}/api/control/actions/${tenantA.actionConfig.actionDefinitionId}/preview?testUser=${encodeURIComponent(
      tenantA.adminUserId
    )}`,
    jsonRequest({
      target: {
        surfaceId: tenantA.savedView.surfaceId,
        surfaceKey: "portfolio.control",
        rowId: tenantA.actionConfig.targetRowId,
        entityType: "kpi_signal",
        entityId: tenantA.actionConfig.targetSignalId
      },
      input: { reason: "direct disabled action attempt" }
    })
  );
  expect(directPreview.status()).toBe(403);
  expect((await getConfigurationAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ commandType: "control_surface_layout.publish" }),
      expect.objectContaining({ commandType: "action_configuration.publish" })
    ])
  );

  await page.reload();
  await expect(page.getByTestId("action-config-readback")).toContainText("accept_risk");

  await resetPhase10Fixtures(request);
  expect((await getPortfolioView(request)).surface.version).toBe(1);
});
