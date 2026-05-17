import { expect, test } from "@playwright/test";

import {
  getLoadBucket,
  getOverloadDetail,
  getResourceAudit,
  getResourceLoad,
  openResourceLoadSurface,
  resetPhase6Fixtures,
  tenantALoadBucketId,
  tenantAOverloadId
} from "../phase6/helpers";

test("E2E-R2-004 Resource Capacity Matrix: overload cell opens affected work and resolution flow", async ({ page, request }) => {
  await resetPhase6Fixtures(request);
  await openResourceLoadSurface(page);

  await expect(page.getByTestId("capacity-matrix")).toContainText("Анна Архитектор");
  await expect(page.getByTestId(`resource-load-bucket-${tenantALoadBucketId}`)).toContainText("Критическая");
  await expect(page.getByTestId("resource-overload-signal")).toContainText(tenantAOverloadId);
  await page.getByTestId("capacity-cell-resource-architect-a-2026-06-01").click();
  await expect(page.getByTestId("capacity-cell-drilldown")).toContainText("assignment-design-architect-a");

  const detail = await getOverloadDetail(request);
  expect(detail.overload.id).toBe(tenantAOverloadId);
  expect(detail.affectedAssignments.map((assignment) => assignment.id)).toContain("assignment-design-architect-a");
});

test("E2E-R2-005 Resource conflict resolution: preview shift, apply, audit, reload", async ({ page, request }) => {
  await resetPhase6Fixtures(request);
  await openResourceLoadSurface(page);

  await page.getByRole("button", { name: "Предпросмотреть перенос" }).click();
  await expect(page.getByTestId("resource-resolution-preview")).toContainText("После: 8 ч");
  await page.getByRole("button", { name: "Применить preview" }).click();
  await expect(page.getByTestId("resource-apply-result")).toContainText("resource_resolution.shift_work");
  await expect(page.getByTestId(`resource-load-bucket-${tenantALoadBucketId}`)).toContainText("8 ч");

  expect((await getLoadBucket(request)).totalLoadHours).toBe(8);
  expect((await getResourceLoad(request)).overloads).toEqual([]);
  expect((await getResourceAudit(request)).actionExecutions).toEqual(
    expect.arrayContaining([expect.objectContaining({ commandType: "resource_resolution.shift_work", status: "succeeded" })])
  );

  await page.reload();
  await expect(page.getByTestId(`resource-load-bucket-${tenantALoadBucketId}`)).toContainText("8 ч");
  await expect(page.getByTestId("resource-audit-evidence")).toContainText("resource_resolution.shift_work");
});
