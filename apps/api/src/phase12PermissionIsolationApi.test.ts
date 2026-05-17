import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function postJson(body: unknown = {}): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

describe("Phase 12 permission and tenant isolation smoke API", () => {
  it("runs permission smoke across release-critical surfaces with audit evidence and readback", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const initial = await app.request("/api/ops/permission-smoke?testUser=tenant-admin-a");
    expect(initial.status).toBe(200);
    await expect(readJson(initial)).resolves.toMatchObject({
      tenantId: "tenant-a",
      status: "not_run",
      latestRun: null
    });

    const run = await app.request("/api/ops/permission-smoke/run?testUser=tenant-admin-a", postJson());
    expect(run.status).toBe(201);
    const runBody = (await readJson(run)) as {
      run: {
        id: string;
        tenantId: string;
        status: string;
        auditEventId: string;
        summary: { total: number; passed: number; failed: number };
        results: Array<{ id: string; status: string; expectedStatus: number; actualStatus: number; actorId: string }>;
      };
    };

    expect(runBody.run).toMatchObject({
      tenantId: "tenant-a",
      status: "passed",
      summary: { failed: 0 }
    });
    expect(runBody.run.summary.total).toBeGreaterThanOrEqual(12);
    expect(runBody.run.summary.passed).toBe(runBody.run.summary.total);
    expect(runBody.run.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "crm.write.denied.readonly",
          actorId: "readonly-observer-a",
          expectedStatus: 403,
          actualStatus: 403,
          status: "passed"
        }),
        expect.objectContaining({
          id: "project.task.write.denied.readonly",
          actorId: "readonly-observer-a",
          expectedStatus: 403,
          actualStatus: 403,
          status: "passed"
        }),
        expect.objectContaining({
          id: "schedule.task.write.denied.readonly",
          actorId: "readonly-observer-a",
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

    const readback = await app.request("/api/ops/permission-smoke?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      tenantId: "tenant-a",
      status: "passed",
      latestRun: {
        id: runBody.run.id,
        auditEventId: runBody.run.auditEventId,
        summary: { failed: 0 }
      }
    });

    const audit = await app.request(
      `/api/audit?testUser=tenant-admin-a&targetType=permissionSmoke&targetId=${encodeURIComponent(runBody.run.id)}`
    );
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: [
        expect.objectContaining({
          id: runBody.run.auditEventId,
          actionKey: "ops.permission_smoke.run",
          target: { entityType: "permissionSmoke", entityId: runBody.run.id }
        })
      ]
    });
  });

  it("runs tenant-isolation smoke without leaking tenant A private identifiers to tenant B probes", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const run = await app.request("/api/ops/tenant-isolation/run?testUser=tenant-admin-a", postJson());
    expect(run.status).toBe(201);
    const runBody = (await readJson(run)) as {
      run: {
        id: string;
        tenantId: string;
        status: string;
        auditEventId: string;
        summary: { total: number; passed: number; failed: number };
        results: Array<{
          id: string;
          status: string;
          expectedStatus: number;
          actualStatus: number;
          actorId: string;
          leakedForbiddenTerms: string[];
        }>;
      };
    };

    expect(runBody.run).toMatchObject({
      tenantId: "tenant-a",
      status: "passed",
      summary: { failed: 0 }
    });
    expect(runBody.run.summary.total).toBeGreaterThanOrEqual(5);
    expect(runBody.run.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tenant-b.cannot-read-tenant-a-project",
          actorId: "tenant-admin-b",
          expectedStatus: 404,
          actualStatus: 404,
          leakedForbiddenTerms: []
        }),
        expect.objectContaining({
          id: "tenant-b.portfolio-view-excludes-tenant-a-rows",
          expectedStatus: 200,
          actualStatus: 200,
          leakedForbiddenTerms: []
        })
      ])
    );

    const readback = await app.request("/api/ops/tenant-isolation?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      tenantId: "tenant-a",
      status: "passed",
      latestRun: {
        id: runBody.run.id,
        auditEventId: runBody.run.auditEventId,
        summary: { failed: 0 }
      }
    });

    const tenantBReadback = await app.request("/api/ops/tenant-isolation?testUser=tenant-admin-b");
    expect(tenantBReadback.status).toBe(200);
    await expect(readJson(tenantBReadback)).resolves.toMatchObject({
      tenantId: "tenant-b",
      status: "not_run",
      latestRun: null
    });

    const setupProject = await app.request("/api/projects/project-p12-permission-smoke?testUser=tenant-admin-a");
    expect(setupProject.status).toBe(200);

    const reset = await app.request("/test-fixtures/reset", { method: "POST" });
    expect(reset.status).toBe(200);

    const afterReset = await app.request("/api/ops/tenant-isolation?testUser=tenant-admin-a");
    await expect(readJson(afterReset)).resolves.toMatchObject({ status: "not_run", latestRun: null });

    const setupProjectAfterReset = await app.request("/api/projects/project-p12-permission-smoke?testUser=tenant-admin-a");
    expect(setupProjectAfterReset.status).toBe(404);
  });

  it("denies smoke execution to read-only users and keeps smoke state resettable", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const deniedRead = await app.request("/api/ops/permission-smoke?testUser=readonly-observer-a");
    expect(deniedRead.status).toBe(403);

    const denied = await app.request("/api/ops/permission-smoke/run?testUser=readonly-observer-a", postJson());
    expect(denied.status).toBe(403);

    const beforeRun = await app.request("/api/ops/permission-smoke?testUser=tenant-admin-a");
    await expect(readJson(beforeRun)).resolves.toMatchObject({ status: "not_run", latestRun: null });

    const run = await app.request("/api/ops/permission-smoke/run?testUser=tenant-admin-a", postJson());
    expect(run.status).toBe(201);

    const setupProject = await app.request("/api/projects/project-p12-permission-smoke?testUser=tenant-admin-a");
    expect(setupProject.status).toBe(200);

    const reset = await app.request("/test-fixtures/reset", { method: "POST" });
    expect(reset.status).toBe(200);

    const afterReset = await app.request("/api/ops/permission-smoke?testUser=tenant-admin-a");
    await expect(readJson(afterReset)).resolves.toMatchObject({ status: "not_run", latestRun: null });

    const setupProjectAfterReset = await app.request("/api/projects/project-p12-permission-smoke?testUser=tenant-admin-a");
    expect(setupProjectAfterReset.status).toBe(404);
  });
});
