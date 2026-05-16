import { expect, test } from "@playwright/test";

import {
  getLoadBucket,
  getPortfolioView,
  getResourceAudit,
  openResourceLoadControl,
  resetPhase8Fixtures,
  tenantA
} from "./helpers";

test("E2E-072 resource manager resolves overload through P8 action engine from Resource Load Control", async ({
  page,
  request
}) => {
  await resetPhase8Fixtures(request);
  await openResourceLoadControl(page);
  await expect(page.getByTestId(`resource-load-bucket-${tenantA.loadBucketId}`)).toContainText("50 ч");

  await page.getByRole("button", { name: "Предпросмотреть перенос" }).click();
  await expect(page.getByTestId("resource-resolution-preview")).toContainText("После: 8 ч");
  expect((await getLoadBucket(request)).bucket).toMatchObject({ totalLoadHours: 50, severity: "critical" });

  await page.getByRole("button", { name: "Применить preview" }).click();
  await expect(page.getByTestId("resource-apply-result")).toContainText("resource_resolution.shift_work");
  await expect(page.getByTestId("resource-audit-evidence")).toContainText("resource_resolution.shift_work");
  await expect(page.getByTestId(`resource-load-bucket-${tenantA.loadBucketId}`)).toContainText("8 ч");

  expect((await getLoadBucket(request)).bucket).toMatchObject({ totalLoadHours: 8, severity: "none" });
  expect((await getPortfolioView(request, tenantA.resourceManagerUserId)).rows.map((row) => row.id)).not.toContain(
    tenantA.resourceOverloadRowId
  );
  const audit = await getResourceAudit(request);
  expect(audit.actionExecutions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        commandType: "resource_resolution.shift_work",
        source: { entityType: "resourceOverload", entityId: tenantA.resourceOverloadId }
      })
    ])
  );

  await page.reload();
  await expect(page.getByTestId(`resource-load-bucket-${tenantA.loadBucketId}`)).toContainText("8 ч");
  await expect(page.getByTestId("resource-audit-evidence")).toContainText("resource_resolution.shift_work");

  await resetPhase8Fixtures(request);
  expect((await getLoadBucket(request)).bucket).toMatchObject({ totalLoadHours: 50, severity: "critical" });
  expect((await getResourceAudit(request)).actionExecutions).toEqual([]);
});
