import { expect, test } from "@playwright/test";

import {
  getLoadBucket,
  getResourceAudit,
  openResourceLoadSurface,
  resetPhase6Fixtures,
  tenantALoadBucketId
} from "./helpers";

test("E2E-053 dry-run preview shows before/after impact and does not mutate state", async ({ page, request }) => {
  await resetPhase6Fixtures(request);
  const beforeBucket = await getLoadBucket(request);
  expect(beforeBucket.totalLoadHours).toBe(50);
  expect(beforeBucket.severity).toBe("critical");

  await openResourceLoadSurface(page);
  await page.getByRole("button", { name: "Предпросмотреть перенос" }).click();

  const preview = page.getByTestId("resource-resolution-preview");
  await expect(preview).toContainText("До: 50 ч");
  await expect(preview).toContainText("После: 8 ч");
  await expect(preview).toContainText("Снижение: 42 ч");
  await expect(preview).toContainText("Остаточная перегрузка: 0 ч");
  await expect(preview).toContainText("Состояние еще не изменено");
  await expect(page.getByTestId(`resource-load-bucket-${tenantALoadBucketId}`)).toContainText("50 ч");

  const unchangedBucket = await getLoadBucket(request);
  expect(unchangedBucket.totalLoadHours).toBe(50);
  expect(unchangedBucket.severity).toBe("critical");
  const audit = await getResourceAudit(request);
  expect(audit.actionExecutions).toEqual([]);
  expect(audit.events).toEqual([]);
});
