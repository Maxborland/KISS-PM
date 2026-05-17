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

describe("Phase 12 recovery smoke API", () => {
  it("runs deterministic recovery smoke, writes audit evidence, and preserves readback", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const initial = await app.request("/api/ops/recovery-smoke?testUser=tenant-admin-a");
    expect(initial.status).toBe(200);
    await expect(readJson(initial)).resolves.toMatchObject({
      tenantId: "tenant-a",
      status: "not_run",
      latestRun: null,
      policy: {
        mode: "deterministic_in_memory_smoke",
        productionBackupRequired: true
      }
    });

    const run = await app.request(
      "/api/ops/recovery-smoke/run?testUser=tenant-admin-a",
      postJson({ scenarioKey: "release-readiness-state" })
    );
    expect(run.status).toBe(201);
    const runBody = (await readJson(run)) as {
      run: {
        id: string;
        tenantId: string;
        status: string;
        before: { marker: string; usable: boolean };
        simulatedFailure: { marker: string; usable: boolean };
        after: { marker: string; usable: boolean };
        auditEventId: string;
      };
    };

    expect(runBody.run).toMatchObject({
      tenantId: "tenant-a",
      status: "passed",
      before: { marker: "seed", usable: true },
      simulatedFailure: { marker: "corrupted", usable: false },
      after: { marker: "seed", usable: true }
    });

    const readback = await app.request("/api/ops/recovery-smoke?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      tenantId: "tenant-a",
      status: "passed",
      latestRun: {
        id: runBody.run.id,
        auditEventId: runBody.run.auditEventId,
        after: { usable: true }
      }
    });

    const audit = await app.request(
      `/api/audit?testUser=tenant-admin-a&targetType=recoverySmoke&targetId=${encodeURIComponent(runBody.run.id)}`
    );
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: [
        {
          id: runBody.run.auditEventId,
          actionKey: "ops.recovery_smoke.run",
          target: { entityType: "recoverySmoke", entityId: runBody.run.id }
        }
      ]
    });
  });

  it("denies read-only recovery execution without partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const denied = await app.request(
      "/api/ops/recovery-smoke/run?testUser=readonly-observer-a",
      postJson({ scenarioKey: "release-readiness-state" })
    );
    expect(denied.status).toBe(403);

    const readback = await app.request("/api/ops/recovery-smoke?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({ status: "not_run", latestRun: null });
  });

  it("rejects malformed recovery scenario without partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const invalid = await app.request("/api/ops/recovery-smoke/run?testUser=tenant-admin-a", postJson({ scenarioKey: "unknown" }));
    expect(invalid.status).toBe(400);
    await expect(readJson(invalid)).resolves.toMatchObject({ code: "validation_error" });

    const readback = await app.request("/api/ops/recovery-smoke?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({ status: "not_run", latestRun: null });
  });

  it("keeps recovery smoke state tenant-scoped and resettable", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const tenantA = await app.request(
      "/api/ops/recovery-smoke/run?testUser=tenant-admin-a",
      postJson({ scenarioKey: "release-readiness-state" })
    );
    expect(tenantA.status).toBe(201);

    const tenantBRead = await app.request("/api/ops/recovery-smoke?testUser=tenant-admin-b");
    expect(tenantBRead.status).toBe(200);
    await expect(readJson(tenantBRead)).resolves.toMatchObject({ tenantId: "tenant-b", status: "not_run" });

    const reset = await app.request("/test-fixtures/reset", { method: "POST" });
    expect(reset.status).toBe(200);

    const afterReset = await app.request("/api/ops/recovery-smoke?testUser=tenant-admin-a");
    expect(afterReset.status).toBe(200);
    await expect(readJson(afterReset)).resolves.toMatchObject({ tenantId: "tenant-a", status: "not_run", latestRun: null });
  });
});
