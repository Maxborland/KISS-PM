import { expect, test } from "@playwright/test";

import { getApiJson, getOpsAudit, openKissPm, phase12ApiBaseUrl, phase12Users, resetPhase12Fixtures } from "./helpers";

type PermissionSmokeReadback = {
  tenantId: string;
  status: "not_run" | "passed" | "failed";
  latestRun: {
    id: string;
    auditEventId: string;
    summary: { total: number; passed: number; failed: number };
    results: Array<{ id: string; actorId: string; expectedStatus: number; actualStatus: number; status: string }>;
  } | null;
};

test("E2E-111 permission matrix smoke proves UI visibility, backend denial, audit, reload, and cleanup", async ({
  page,
  request
}) => {
  await resetPhase12Fixtures(request);

  await openKissPm(page, phase12Users.operatorAdmin);
  await expect(page.getByTestId("permission-smoke-panel")).toContainText("not_run");

  await page.getByRole("button", { name: "Запустить permission smoke" }).click();
  await expect(page.getByTestId("release-readiness-result")).toContainText("p12-permission-smoke-0001");
  await expect(page.getByTestId("permission-smoke-panel")).toContainText("Status: passed");
  await expect(page.getByTestId("permission-smoke-panel")).toContainText("Failed: 0");

  const readback = await getApiJson<PermissionSmokeReadback>(
    request,
    "/api/ops/permission-smoke",
    phase12Users.operatorAdmin
  );
  expect(readback).toMatchObject({
    tenantId: "tenant-a",
    status: "passed",
    latestRun: {
      id: "p12-permission-smoke-0001",
      summary: { failed: 0 }
    }
  });
  expect(readback.latestRun?.summary.total).toBeGreaterThanOrEqual(12);
  expect(readback.latestRun?.summary.passed).toBe(readback.latestRun?.summary.total);
  expect(readback.latestRun?.results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "crm.write.denied.readonly",
        actorId: phase12Users.readonlyObserver,
        expectedStatus: 403,
        actualStatus: 403,
        status: "passed"
      }),
      expect.objectContaining({
        id: "project.task.write.denied.readonly",
        expectedStatus: 403,
        actualStatus: 403,
        status: "passed"
      }),
      expect.objectContaining({
        id: "schedule.task.write.denied.readonly",
        expectedStatus: 403,
        actualStatus: 403,
        status: "passed"
      }),
      expect.objectContaining({
        id: "ops.recovery.execute.denied.readonly",
        expectedStatus: 403,
        actualStatus: 403,
        status: "passed"
      })
    ])
  );

  const deniedRead = await request.get(
    `${phase12ApiBaseUrl()}/api/ops/permission-smoke?testUser=${encodeURIComponent(phase12Users.readonlyObserver)}`
  );
  expect(deniedRead.status()).toBe(403);
  const deniedRun = await request.post(
    `${phase12ApiBaseUrl()}/api/ops/permission-smoke/run?testUser=${encodeURIComponent(phase12Users.readonlyObserver)}`
  );
  expect(deniedRun.status()).toBe(403);
  await openKissPm(page, phase12Users.readonlyObserver);
  await expect(page.getByTestId("operator-readiness-denied")).toContainText("Нет разрешений");

  await openKissPm(page, phase12Users.operatorAdmin);
  expect((await getOpsAudit(request)).events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actionKey: "ops.permission_smoke.run",
        target: expect.objectContaining({ entityId: readback.latestRun?.id })
      })
    ])
  );
  await page.reload();
  await expect(page.getByTestId("permission-smoke-panel")).toContainText("p12-permission-smoke-0001");

  await resetPhase12Fixtures(request);
  const afterReset = await getApiJson<PermissionSmokeReadback>(request, "/api/ops/permission-smoke", phase12Users.operatorAdmin);
  expect(afterReset).toMatchObject({ status: "not_run", latestRun: null });
  const setupProjectAfterReset = await request.get(
    `${phase12ApiBaseUrl()}/api/projects/project-p12-permission-smoke?testUser=${encodeURIComponent(phase12Users.operatorAdmin)}`
  );
  expect(setupProjectAfterReset.status()).toBe(404);
});
