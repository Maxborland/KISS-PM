import { expect, test } from "@playwright/test";

import {
  phase6ApiBaseUrl,
  phase6Seed,
  resetPhase6Fixtures,
  tenantALoadBucketId,
  tenantAOverloadId
} from "./helpers";

function jsonRequest(body: unknown) {
  return {
    headers: { "content-type": "application/json" },
    data: body
  };
}

test("E2E-055 permissions and tenant isolation deny unauthorized UI and direct API mutations", async ({ page, request }) => {
  await resetPhase6Fixtures(request);

  await page.goto(`/?testUser=${encodeURIComponent(phase6Seed.tenantA.readerUserId)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("resource-load-surface")).toBeVisible();
  await expect(page.getByTestId(`resource-load-bucket-${tenantALoadBucketId}`)).toContainText("Анна Архитектор");
  await expect(page.getByTestId("resource-command-denied")).toContainText("Изменение нагрузки недоступно по правам");
  await expect(page.getByRole("button", { name: "Предпросмотреть перенос" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Применить preview" })).toHaveCount(0);

  const readonlyPreview = await request.post(
    `${phase6ApiBaseUrl()}/api/resources/overloads/${encodeURIComponent(tenantAOverloadId)}/preview?testUser=${encodeURIComponent(
      phase6Seed.tenantA.readerUserId
    )}`,
    jsonRequest({
      actionKey: "shift_work",
      assignmentId: phase6Seed.tenantA.overload!.assignmentId,
      shiftDays: 7,
      reason: "readonly denial proof"
    })
  );
  expect(readonlyPreview.status()).toBe(403);
  expect(await readonlyPreview.json()).toMatchObject({ code: "permission_denied" });

  const readonlyApply = await request.post(
    `${phase6ApiBaseUrl()}/api/resources/overloads/${encodeURIComponent(tenantAOverloadId)}/apply?testUser=${encodeURIComponent(
      phase6Seed.tenantA.readerUserId
    )}`,
    jsonRequest({ previewId: phase6Seed.tenantA.overload!.previewId })
  );
  expect(readonlyApply.status()).toBe(403);
  expect(await readonlyApply.json()).toMatchObject({ code: "permission_denied" });

  const tenantBReadTenantA = await request.get(
    `${phase6ApiBaseUrl()}/api/resources/load/${encodeURIComponent(tenantALoadBucketId)}?testUser=${encodeURIComponent(
      phase6Seed.tenantB.managerUserId
    )}`
  );
  expect(tenantBReadTenantA.status()).toBe(404);
  const tenantBReadBody = JSON.stringify(await tenantBReadTenantA.json());
  expect(tenantBReadBody).not.toContain("resource-architect-a");
  expect(tenantBReadBody).not.toContain("Анна Архитектор");

  const tenantBPreviewTenantA = await request.post(
    `${phase6ApiBaseUrl()}/api/resources/overloads/${encodeURIComponent(tenantAOverloadId)}/preview?testUser=${encodeURIComponent(
      phase6Seed.tenantB.managerUserId
    )}`,
    jsonRequest({
      actionKey: "shift_work",
      assignmentId: phase6Seed.tenantA.overload!.assignmentId,
      shiftDays: 7,
      reason: "tenant isolation denial proof"
    })
  );
  expect(tenantBPreviewTenantA.status()).toBe(404);
  const tenantBPreviewBody = JSON.stringify(await tenantBPreviewTenantA.json());
  expect(tenantBPreviewBody).not.toContain("resource-architect-a");
  expect(tenantBPreviewBody).not.toContain("Анна Архитектор");
});
