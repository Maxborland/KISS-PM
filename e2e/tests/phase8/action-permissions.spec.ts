import { expect, test } from "@playwright/test";

import {
  getControlAudit,
  getLoadBucket,
  jsonRequest,
  kpiTarget,
  phase8ApiBaseUrl,
  resetPhase8Fixtures,
  resourceTarget,
  tenantA
} from "./helpers";

test("E2E-074 action availability and backend guards deny read-only and cross-tenant mutations", async ({
  page,
  request
}) => {
  await resetPhase8Fixtures(request);

  await page.goto(`/?testUser=${encodeURIComponent(tenantA.readOnlyUserId)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("portfolio-control-row-list")).toContainText(tenantA.criticalSignalId);
  await expect(page.getByTestId("portfolio-control-readonly")).toContainText("Действия недоступны");
  await expect(page.getByRole("button", { name: "Предпросмотр" })).toHaveCount(0);

  const readonlyPreview = await request.post(
    `${phase8ApiBaseUrl()}/api/control/actions/${encodeURIComponent(tenantA.actions.acceptRisk)}/preview?testUser=${encodeURIComponent(
      tenantA.readOnlyUserId
    )}`,
    jsonRequest({ target: kpiTarget(), input: { reason: "readonly denial" } })
  );
  expect(readonlyPreview.status()).toBe(403);
  await expect(readonlyPreview.json()).resolves.toMatchObject({ code: "permission_denied" });

  const directExecute = await request.post(
    `${phase8ApiBaseUrl()}/api/control/actions/${encodeURIComponent(
      tenantA.actions.shiftResourceWork
    )}/execute?testUser=${encodeURIComponent(tenantA.resourceManagerUserId)}`,
    jsonRequest({
      target: resourceTarget(),
      input: {
        assignmentId: tenantA.assignmentId,
        shiftDays: 7,
        reason: "No preview"
      }
    })
  );
  expect(directExecute.status()).toBe(409);
  await expect(directExecute.json()).resolves.toMatchObject({ code: "dry_run_required" });

  const crossTenantPreview = await request.post(
    `${phase8ApiBaseUrl()}/api/control/actions/${encodeURIComponent(tenantA.actions.acceptRisk)}/preview?testUser=tenant-admin-b`,
    jsonRequest({ target: kpiTarget(), input: { reason: "Tenant B cannot mutate Tenant A" } })
  );
  expect(crossTenantPreview.status()).toBe(404);
  const crossTenantText = await crossTenantPreview.text();
  expect(crossTenantText).not.toContain(tenantA.criticalSignalId);
  expect(crossTenantText).not.toContain(tenantA.projectId);

  const tenantBView = await request.get(`${phase8ApiBaseUrl()}/api/control/surfaces/portfolio-control/view?testUser=tenant-admin-b`);
  await expect(tenantBView).toBeOK();
  const tenantBText = await tenantBView.text();
  expect(tenantBText).toContain("project-private-b");
  expect(tenantBText).not.toContain(tenantA.projectId);

  expect((await getControlAudit(request)).actionExecutions).toEqual([]);
  expect((await getLoadBucket(request)).bucket).toMatchObject({ totalLoadHours: 50, severity: "critical" });
});
