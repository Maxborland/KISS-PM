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
});
