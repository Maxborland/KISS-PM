import { expect, test } from "@playwright/test";

import { getApiJson, getOpsAudit, openKissPm, phase12ApiBaseUrl, phase12Users, resetPhase12Fixtures } from "./helpers";

type RecoveryReadback = {
  tenantId: string;
  status: "not_run" | "passed";
  latestRun: {
    id: string;
    auditEventId: string;
    status: "passed";
    before: { marker: string; usable: boolean };
    simulatedFailure: { marker: string; usable: boolean };
    after: { marker: string; usable: boolean };
  } | null;
};

test("E2E-114 recovery smoke proves restore readback, denial, audit, reload persistence, and cleanup", async ({
  page,
  request
}) => {
  await resetPhase12Fixtures(request);

  await openKissPm(page, phase12Users.operatorAdmin);
  await expect(page.getByTestId("recovery-smoke-panel")).toContainText("status not_run");

  const deniedRun = await request.post(
    `${phase12ApiBaseUrl()}/api/ops/recovery-smoke/run?testUser=${encodeURIComponent(phase12Users.readonlyObserver)}`,
    {
      data: { scenarioKey: "release-readiness-state" },
      headers: { "content-type": "application/json" }
    }
  );
  expect(deniedRun.status()).toBe(403);
  const beforeAuthorizedRun = await getApiJson<RecoveryReadback>(
    request,
    "/api/ops/recovery-smoke",
    phase12Users.operatorAdmin
  );
  expect(beforeAuthorizedRun).toMatchObject({ status: "not_run", latestRun: null });

  await page.getByRole("button", { name: "Запустить recovery smoke" }).click();
  await expect(page.getByTestId("release-readiness-result")).toContainText("p12-recovery-tenant-a-0001");
  await expect(page.getByTestId("recovery-smoke-panel")).toContainText("status passed");
  await expect(page.getByTestId("recovery-smoke-panel")).toContainText("After usable: true");

  const readback = await getApiJson<RecoveryReadback>(request, "/api/ops/recovery-smoke", phase12Users.operatorAdmin);
  expect(readback).toMatchObject({
    tenantId: "tenant-a",
    status: "passed",
    latestRun: {
      id: "p12-recovery-tenant-a-0001",
      status: "passed",
      before: { marker: "seed", usable: true },
      simulatedFailure: { marker: "corrupted", usable: false },
      after: { marker: "seed", usable: true }
    }
  });

  expect((await getOpsAudit(request)).events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actionKey: "ops.recovery_smoke.run",
        target: expect.objectContaining({ entityId: readback.latestRun?.id })
      })
    ])
  );
  await page.reload();
  await expect(page.getByTestId("recovery-smoke-panel")).toContainText("p12-recovery-tenant-a-0001");
  await expect(page.getByTestId("recovery-smoke-panel")).toContainText("After usable: true");

  await resetPhase12Fixtures(request);
  const afterReset = await getApiJson<RecoveryReadback>(request, "/api/ops/recovery-smoke", phase12Users.operatorAdmin);
  expect(afterReset).toMatchObject({ status: "not_run", latestRun: null });
});
