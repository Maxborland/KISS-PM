import { expect, test } from "@playwright/test";

import {
  getConfigurationAudit,
  getPortfolioView,
  jsonRequest,
  openSavedViews,
  openTenantLabels,
  phase10ApiBaseUrl,
  resetPhase10Fixtures,
  tenantA
} from "../phase10/helpers";

test("E2E-R2-008 Tenant Admin layout/saved view affects runtime surface after reload", async ({ page, request }) => {
  await resetPhase10Fixtures(request);
  await openSavedViews(page);

  await expect(page.getByTestId("saved-view-layout-readback")).toContainText("v1");
  await page.getByRole("button", { name: "Предпросмотр макета" }).click();
  await expect(page.getByTestId("runtime-config-preview")).toContainText("portfolio.control");
  await expect(page.getByTestId("runtime-config-preview")).toContainText("v1 -> v2");
  expect((await getPortfolioView(request)).surface.version).toBe(1);

  await page.getByRole("button", { name: "Опубликовать макет" }).click();
  await expect(page.getByTestId("saved-view-layout-readback")).toContainText("v2");
  expect((await getPortfolioView(request)).savedViews).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: tenantA.savedView.savedViewKey })])
  );
  expect((await getConfigurationAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "control_surface_layout.publish", status: "succeeded" })])
  );

  await page.reload();
  await expect(page.getByTestId("saved-view-layout-readback")).toContainText("v2");
});

test("E2E-R2-009 Read-only user sees disabled reasons and backend denies mutation", async ({ page, request }) => {
  await resetPhase10Fixtures(request);
  await openTenantLabels(page, tenantA.readOnlyUserId);
  await expect(page.getByTestId("tenant-labels-readonly")).toContainText("tenant.config.write");
  await expect(page.getByRole("button", { name: "Предпросмотр" })).toHaveCount(0);

  const deniedPreview = await request.post(
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
  expect(deniedPreview.status()).toBe(403);
  expect((await getPortfolioView(request)).surface.version).toBe(1);
});
