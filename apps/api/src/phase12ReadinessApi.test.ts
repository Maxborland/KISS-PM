import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

const productionLikeEnv = {
  KISS_PM_RUNTIME_ENV: "production_like",
  KISS_PM_PUBLIC_BASE_URL: "https://kiss-pm.example.test",
  KISS_PM_API_BASE_URL: "https://api.kiss-pm.example.test",
  KISS_PM_ALLOWED_ORIGINS: "https://kiss-pm.example.test",
  KISS_PM_SECRET_REF: "secret://kiss-pm/prod/app",
  KISS_PM_AUDIT_RETENTION_DAYS: "365",
  KISS_PM_EXTERNAL_SERVICES_MODE: "mocked"
};

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

describe("Phase 12 release readiness API", () => {
  it("returns tenant-scoped readiness read model with safe deployment and blocker evidence", async () => {
    const app = createApiApp({ deploymentEnvironment: productionLikeEnv });

    const response = await app.request("/api/ops/release-readiness?testUser=tenant-admin-a");

    expect(response.status).toBe(200);
    const body = (await readJson(response)) as {
      tenantId: string;
      summary: { status: string; totalChecks: number; failedChecks: number; blockedChecks: number };
      deployment: { status: string; checks: Array<{ id: string; status: string; actual: string }> };
      checks: Array<{ id: string; category: string; status: string; severity: string; recoveryText: string }>;
      openBlockers: Array<{ id: string; severity: string; reason: string }>;
    };

    expect(body.tenantId).toBe("tenant-a");
    expect(body.summary).toMatchObject({ status: "blocked", failedChecks: 0 });
    expect(body.summary.totalChecks).toBeGreaterThan(0);
    expect(body.summary.blockedChecks).toBeGreaterThan(0);
    expect(body.deployment).toMatchObject({ status: "passed" });
    expect(body.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "p12.e2e-110-115",
          category: "e2e",
          status: "blocked",
          severity: "critical"
        }),
        expect.objectContaining({
          id: "p12.no-live-external-dependency",
          category: "dependency",
          status: "passed"
        })
      ])
    );
    expect(body.openBlockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "p12.e2e-110-115", severity: "critical" })])
    );
    expect(JSON.stringify(body)).not.toContain("secret://kiss-pm/prod/app");
  });

  it("denies release-readiness read model to users without operator permissions", async () => {
    const app = createApiApp({ deploymentEnvironment: productionLikeEnv });

    const response = await app.request("/api/ops/release-readiness?testUser=readonly-observer-a");

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toMatchObject({ code: "permission_denied" });
  });

  it("keeps readiness read model scoped to the caller tenant", async () => {
    const app = createApiApp({ deploymentEnvironment: productionLikeEnv });

    const tenantB = await app.request("/api/ops/release-readiness?testUser=tenant-admin-b");

    expect(tenantB.status).toBe(200);
    await expect(readJson(tenantB)).resolves.toMatchObject({
      tenantId: "tenant-b",
      summary: { status: "blocked" }
    });
  });

  it("runs governed readiness checks with audit evidence, run readback, and reset cleanup", async () => {
    const app = createApiApp({ allowTestFixtureReset: true, deploymentEnvironment: productionLikeEnv });

    const initial = await app.request("/api/ops/release-readiness?testUser=tenant-admin-a");
    expect(initial.status).toBe(200);
    await expect(readJson(initial)).resolves.toMatchObject({
      tenantId: "tenant-a",
      latestRun: null
    });

    const run = await app.request("/api/ops/release-readiness/run?testUser=tenant-admin-a", { method: "POST" });
    expect(run.status).toBe(201);
    const runBody = (await readJson(run)) as {
      run: {
        id: string;
        tenantId: string;
        status: string;
        auditEventId: string;
        summary: { totalChecks: number; blockedChecks: number };
        checks: Array<{ id: string; status: string }>;
      };
    };
    expect(runBody.run).toMatchObject({
      tenantId: "tenant-a",
      status: "blocked",
      summary: { blockedChecks: 2 }
    });
    expect(runBody.run.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "p12.deployment-smoke", status: "passed" }),
        expect.objectContaining({ id: "p12.e2e-110-115", status: "blocked" })
      ])
    );

    const readback = await app.request(`/api/ops/release-readiness/runs/${runBody.run.id}?testUser=tenant-admin-a`);
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      run: {
        id: runBody.run.id,
        tenantId: "tenant-a",
        auditEventId: runBody.run.auditEventId
      }
    });

    const latest = await app.request("/api/ops/release-readiness?testUser=tenant-admin-a");
    await expect(readJson(latest)).resolves.toMatchObject({
      latestRun: {
        id: runBody.run.id,
        auditEventId: runBody.run.auditEventId
      }
    });

    const audit = await app.request("/api/ops/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: [
        expect.objectContaining({
          id: runBody.run.auditEventId,
          actionKey: "ops.release_readiness.run",
          target: { entityType: "releaseReadinessRun", entityId: runBody.run.id }
        })
      ]
    });

    const reset = await app.request("/test-fixtures/reset", { method: "POST" });
    expect(reset.status).toBe(200);

    const afterResetRun = await app.request(`/api/ops/release-readiness/runs/${runBody.run.id}?testUser=tenant-admin-a`);
    expect(afterResetRun.status).toBe(404);
    const afterResetLatest = await app.request("/api/ops/release-readiness?testUser=tenant-admin-a");
    await expect(readJson(afterResetLatest)).resolves.toMatchObject({ latestRun: null });
  });

  it("denies readiness execution and cross-tenant run readback without partial mutation", async () => {
    const app = createApiApp({ deploymentEnvironment: productionLikeEnv });

    const denied = await app.request("/api/ops/release-readiness/run?testUser=readonly-observer-a", { method: "POST" });
    expect(denied.status).toBe(403);
    await expect(readJson(denied)).resolves.toMatchObject({ code: "permission_denied" });

    const deniedAudit = await app.request("/api/ops/audit?testUser=readonly-observer-a");
    expect(deniedAudit.status).toBe(403);
    await expect(readJson(deniedAudit)).resolves.toMatchObject({ code: "permission_denied" });

    const tenantA = await app.request("/api/ops/release-readiness/run?testUser=tenant-admin-a", { method: "POST" });
    expect(tenantA.status).toBe(201);
    const tenantABody = (await readJson(tenantA)) as { run: { id: string } };

    const tenantBRead = await app.request(`/api/ops/release-readiness/runs/${tenantABody.run.id}?testUser=tenant-admin-b`);
    expect(tenantBRead.status).toBe(404);

    const tenantBLatest = await app.request("/api/ops/release-readiness?testUser=tenant-admin-b");
    await expect(readJson(tenantBLatest)).resolves.toMatchObject({ tenantId: "tenant-b", latestRun: null });
  });
});
