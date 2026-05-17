import { expect, test } from "@playwright/test";

import {
  getApiJson,
  getOpsAudit,
  openKissPm,
  phase12ApiBaseUrl,
  phase12Users,
  resetPhase12Fixtures,
} from "./helpers";

type TenantIsolationReadback = {
  tenantId: string;
  status: "not_run" | "passed" | "failed";
  latestRun: {
    id: string;
    auditEventId: string;
    summary: { total: number; passed: number; failed: number };
    results: Array<{
      id: string;
      actorId: string;
      expectedStatus: number;
      actualStatus: number;
      status: string;
      leakedForbiddenTerms: string[];
    }>;
  } | null;
};

test("E2E-112 tenant isolation smoke proves no cross-tenant leakage through UI, API, audit, reload, and cleanup", async ({
  page,
  request
}) => {
  await resetPhase12Fixtures(request);

  await openKissPm(page, phase12Users.operatorAdmin);
  await expect(page.getByTestId("tenant-isolation-panel")).toContainText("not_run");

  await page.getByRole("button", { name: "Запустить tenant isolation" }).click();
  await expect(page.getByTestId("release-readiness-result")).toContainText("p12-tenant-isolation-smoke-0001");
  await expect(page.getByTestId("tenant-isolation-panel")).toContainText("Status: passed");
  await expect(page.getByTestId("tenant-isolation-panel")).toContainText("No-leak failures: 0");

  const readback = await getApiJson<TenantIsolationReadback>(
    request,
    "/api/ops/tenant-isolation",
    phase12Users.operatorAdmin
  );
  expect(readback).toMatchObject({
    tenantId: "tenant-a",
    status: "passed",
    latestRun: {
      id: "p12-tenant-isolation-smoke-0001",
      summary: { failed: 0 }
    }
  });
  expect(readback.latestRun?.summary.total).toBeGreaterThanOrEqual(5);
  expect(readback.latestRun?.results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "tenant-b.cannot-read-tenant-a-project",
        actorId: "tenant-admin-b",
        expectedStatus: 404,
        actualStatus: 404,
        status: "passed",
        leakedForbiddenTerms: []
      }),
      expect.objectContaining({
        id: "tenant-b.portfolio-view-excludes-tenant-a-rows",
        expectedStatus: 200,
        actualStatus: 200,
        status: "passed",
        leakedForbiddenTerms: []
      })
    ])
  );
  expect(readback.latestRun?.results.every((result) => result.leakedForbiddenTerms.length === 0)).toBe(true);

  const tenantBReadback = await getApiJson<TenantIsolationReadback>(
    request,
    "/api/ops/tenant-isolation",
    "tenant-admin-b"
  );
  expect(tenantBReadback).toMatchObject({ tenantId: "tenant-b", status: "not_run", latestRun: null });
  const tenantBProjectProbe = await request.get(
    `${phase12ApiBaseUrl()}/api/projects/project-p12-permission-smoke?testUser=${encodeURIComponent(
      "tenant-admin-b"
    )}`
  );
  expect(tenantBProjectProbe.status()).toBe(404);
  expect(await tenantBProjectProbe.text()).not.toContain("project-p12-permission-smoke");

  expect((await getOpsAudit(request)).events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actionKey: "ops.tenant_isolation_smoke.run",
        target: expect.objectContaining({ entityId: readback.latestRun?.id })
      })
    ])
  );
  await page.reload();
  await expect(page.getByTestId("tenant-isolation-panel")).toContainText("p12-tenant-isolation-smoke-0001");

  await resetPhase12Fixtures(request);
  const afterReset = await getApiJson<TenantIsolationReadback>(request, "/api/ops/tenant-isolation", phase12Users.operatorAdmin);
  expect(afterReset).toMatchObject({ status: "not_run", latestRun: null });
});
