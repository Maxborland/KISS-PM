import { expect, test } from "@playwright/test";

import {
  getLoadBucket,
  getResourceAudit,
  getResourceLoad,
  openResourceLoadSurface,
  resetPhase6Fixtures,
  tenantALoadBucketId,
  tenantAOverloadId
} from "./helpers";

test("E2E-054 apply writes result, audit/action evidence, refreshed projection, reload persistence, and reset cleanup", async ({
  page,
  request
}) => {
  await resetPhase6Fixtures(request);
  await openResourceLoadSurface(page);

  await page.getByRole("button", { name: "Предпросмотреть перенос" }).click();
  await expect(page.getByTestId("resource-resolution-preview")).toContainText("После: 8 ч");
  await page.getByRole("button", { name: "Применить preview" }).click();

  await expect(page.getByTestId("resource-apply-result")).toContainText("resource_resolution.shift_work");
  await expect(page.getByTestId("resource-apply-result")).toContainText("resource.write");
  await expect(page.getByTestId("resource-audit-evidence")).toContainText("resource_resolution.shift_work");
  await expect(page.getByTestId(`resource-load-bucket-${tenantALoadBucketId}`)).toContainText("8 ч");
  await expect(page.getByTestId("resource-overload-signal")).toContainText("Открытых перегрузок нет");

  const bucketAfterApply = await getLoadBucket(request);
  expect(bucketAfterApply.totalLoadHours).toBe(8);
  expect(bucketAfterApply.severity).toBe("none");
  const loadAfterApply = await getResourceLoad(request);
  expect(loadAfterApply.overloads).toEqual([]);
  const auditAfterApply = await getResourceAudit(request);
  expect(auditAfterApply.actionExecutions).toHaveLength(1);
  expect(auditAfterApply.actionExecutions[0]).toMatchObject({
    commandType: "resource_resolution.shift_work",
    requiredPermission: "resource.write",
    status: "succeeded",
    source: { entityId: tenantAOverloadId },
    target: { entityId: "assignment-design-architect-a" }
  });
  expect(auditAfterApply.events[0]?.actionKey).toBe("resource_resolution.shift_work");

  await page.reload();
  await expect(page.getByTestId("resource-load-surface")).toBeVisible();
  await expect(page.getByTestId(`resource-load-bucket-${tenantALoadBucketId}`)).toContainText("8 ч");
  await expect(page.getByTestId("resource-overload-signal")).toContainText("Открытых перегрузок нет");
  await expect(page.getByTestId("resource-audit-evidence")).toContainText("resource_resolution.shift_work");

  await resetPhase6Fixtures(request);
  const restoredBucket = await getLoadBucket(request);
  expect(restoredBucket.totalLoadHours).toBe(50);
  expect(restoredBucket.severity).toBe("critical");
  expect((await getResourceLoad(request)).overloads.map((overload) => overload.id)).toEqual([tenantAOverloadId]);
  expect((await getResourceAudit(request)).actionExecutions).toEqual([]);
});
