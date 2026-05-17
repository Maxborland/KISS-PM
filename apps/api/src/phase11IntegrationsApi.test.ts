import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

describe("Phase 11 integrations API", () => {
  it("lists tenant-scoped adapters, connections, and empty diagnostics for authorized readers", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const adapters = await app.request("/api/integrations/adapters?testUser=readonly-observer-a");
    expect(adapters.status).toBe(200);
    await expect(readJson(adapters)).resolves.toMatchObject({
      adapters: [
        {
          id: "adapter-mock-crm",
          tenantId: "tenant-a",
          sourceSystem: "mock-crm",
          active: true
        }
      ]
    });

    const connections = await app.request("/api/integrations/connections?testUser=readonly-observer-a");
    expect(connections.status).toBe(200);
    await expect(readJson(connections)).resolves.toMatchObject({
      connections: [
        {
          id: "conn-mock-crm-a",
          tenantId: "tenant-a",
          adapterId: "adapter-mock-crm",
          status: "healthy"
        }
      ]
    });

    const diagnostics = await app.request("/api/integrations/diagnostics?testUser=readonly-observer-a");
    expect(diagnostics.status).toBe(200);
    await expect(readJson(diagnostics)).resolves.toMatchObject({
      diagnostics: [
        {
          adapterId: "adapter-mock-crm",
          connectionId: "conn-mock-crm-a",
          status: "healthy"
        }
      ]
    });
  });

  it("previews import, exposes validation report and dry-run summary, and does not mutate mappings or batches", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const preview = await app.request(
      "/api/integrations/import/preview?testUser=tenant-admin-a",
      jsonRequest({
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        payloadFixtureKey: "mock-crm-valid"
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as {
      preview: { id: string; mutatesState: false; report: { creates: number; updates: number; skips: number; errors: number } };
      validationReport: { previewId: string; safeToApply: boolean; summary: { creates: number; totalAffected: number } };
      dryRunSummary: { previewId: string; canApply: boolean; mutatesState: false };
    };

    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      report: { creates: 5, updates: 0, skips: 0, errors: 0 }
    });
    expect(previewBody.validationReport).toMatchObject({
      previewId: previewBody.preview.id,
      safeToApply: true,
      summary: { creates: 5, totalAffected: 5 }
    });
    expect(previewBody.dryRunSummary).toMatchObject({
      previewId: previewBody.preview.id,
      canApply: true,
      mutatesState: false
    });

    const report = await app.request(
      `/api/integrations/import/previews/${previewBody.preview.id}/report?testUser=tenant-admin-a`
    );
    expect(report.status).toBe(200);
    await expect(readJson(report)).resolves.toMatchObject({
      validationReport: {
        previewId: previewBody.preview.id,
        safeToApply: true,
        sampleMappings: expect.arrayContaining([expect.objectContaining({ action: "create" })])
      }
    });

    const dryRun = await app.request(
      `/api/integrations/import/previews/${previewBody.preview.id}/dry-run?testUser=tenant-admin-a`
    );
    expect(dryRun.status).toBe(200);
    await expect(readJson(dryRun)).resolves.toMatchObject({
      dryRunSummary: {
        previewId: previewBody.preview.id,
        canApply: true,
        expectedTotalAffected: 5
      }
    });

    const batches = await app.request("/api/integrations/import/batches?testUser=tenant-admin-a");
    await expect(readJson(batches)).resolves.toMatchObject({ batches: [] });
    const mappings = await app.request("/api/integrations/mappings?testUser=tenant-admin-a");
    await expect(readJson(mappings)).resolves.toMatchObject({ mappings: [] });
  });

  it("applies a confirmed preview through governed command and returns batch, mapping, and audit readback", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const preview = await app.request(
      "/api/integrations/import/preview?testUser=tenant-admin-a",
      jsonRequest({
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        payloadFixtureKey: "mock-crm-valid"
      })
    );
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const apply = await app.request(
      "/api/integrations/import/apply?testUser=tenant-admin-a",
      jsonRequest({
        previewId: previewBody.preview.id,
        batchId: "batch-api-import-100",
        idempotencyKey: "idem-api-import-100",
        confirmed: true
      })
    );
    expect(apply.status).toBe(200);
    await expect(readJson(apply)).resolves.toMatchObject({
      result: {
        status: "applied",
        idempotentReplay: false,
        batch: { id: "batch-api-import-100", tenantId: "tenant-a", previewId: previewBody.preview.id },
        audit: { command: "import_apply", result: "success" }
      },
      readback: {
        batches: [expect.objectContaining({ id: "batch-api-import-100" })],
        mappings: expect.arrayContaining([expect.objectContaining({ tenantId: "tenant-a", lastSyncStatus: "synced" })]),
        audit: expect.arrayContaining([expect.objectContaining({ command: "import_apply", result: "success" })])
      }
    });

    const replay = await app.request(
      "/api/integrations/import/apply?testUser=tenant-admin-a",
      jsonRequest({
        previewId: previewBody.preview.id,
        batchId: "batch-api-import-duplicate",
        idempotencyKey: "idem-api-import-100",
        confirmed: true
      })
    );
    expect(replay.status).toBe(200);
    await expect(readJson(replay)).resolves.toMatchObject({
      result: { status: "idempotent_replay", idempotentReplay: true },
      readback: { batches: [expect.objectContaining({ id: "batch-api-import-100" })] }
    });

    const audit = await app.request("/api/integrations/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      audit: [expect.objectContaining({ command: "import_apply", result: "success" })]
    });
  });

  it("keeps imported project operable through canonical project APIs after the adapter fails", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const preview = await app.request(
      "/api/integrations/import/preview?testUser=tenant-admin-a",
      jsonRequest({
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        payloadFixtureKey: "mock-crm-valid"
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const apply = await app.request(
      "/api/integrations/import/apply?testUser=tenant-admin-a",
      jsonRequest({
        previewId: previewBody.preview.id,
        batchId: "batch-imported-project-continuity",
        idempotencyKey: "idem-imported-project-continuity",
        confirmed: true
      })
    );
    expect(apply.status).toBe(200);
    const applyBody = (await readJson(apply)) as {
      readback: {
        mappings: Array<{
          externalEntityId: string;
          canonicalEntityType: string;
          canonicalEntityId: string;
        }>;
      };
    };
    const projectMapping = applyBody.readback.mappings.find((mapping) => mapping.canonicalEntityType === "project");
    const taskMapping = applyBody.readback.mappings.find((mapping) => mapping.canonicalEntityType === "task");
    if (projectMapping === undefined || taskMapping === undefined) {
      throw new Error("expected project and task mappings after import apply");
    }

    const failure = await app.request(
      "/api/integrations/connections/conn-mock-crm-a/failure-mode?testUser=tenant-admin-a",
      jsonRequest({
        code: "adapter_unavailable",
        message: "Mock CRM is offline after import"
      })
    );
    expect(failure.status).toBe(200);

    const project = await app.request(`/api/projects/${projectMapping.canonicalEntityId}?testUser=project-manager-a`);
    expect(project.status).toBe(200);
    const projectText = await project.text();
    expect(projectText).toContain("Импорт: API проект");
    expect(projectText).toContain(taskMapping.canonicalEntityId);
    expect(projectText).not.toContain(projectMapping.externalEntityId);
    expect(projectText).not.toContain(taskMapping.externalEntityId);

    const taskList = await app.request(`/api/projects/${projectMapping.canonicalEntityId}/tasks?testUser=project-manager-a`);
    expect(taskList.status).toBe(200);
    await expect(readJson(taskList)).resolves.toMatchObject({
      tasks: [expect.objectContaining({ id: taskMapping.canonicalEntityId, title: "API imported task" })]
    });

    const statusChange = await app.request(
      `/api/tasks/${taskMapping.canonicalEntityId}/status?testUser=project-manager-a`,
      jsonRequest({ toStatus: "in_progress" }, "PATCH")
    );
    expect(statusChange.status).toBe(200);
    await expect(readJson(statusChange)).resolves.toMatchObject({
      task: { id: taskMapping.canonicalEntityId, status: "in_progress" }
    });

    const audit = await app.request(`/api/audit?testUser=tenant-admin-a&targetType=task&targetId=${taskMapping.canonicalEntityId}`);
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ actionKey: "task.status.change" })])
    });

    const tenantBProject = await app.request(`/api/projects/${projectMapping.canonicalEntityId}?testUser=tenant-admin-b`);
    expect(tenantBProject.status).toBe(404);
    const tenantBText = await tenantBProject.text();
    expect(tenantBText).not.toContain("Импорт: API проект");
    expect(tenantBText).not.toContain(projectMapping.externalEntityId);

    const reset = await app.request("/test-fixtures/reset", jsonRequest({}));
    expect(reset.status).toBe(200);
    const afterReset = await app.request(`/api/projects/${projectMapping.canonicalEntityId}?testUser=project-manager-a`);
    expect(afterReset.status).toBe(404);
  });

  it("rejects stale preview tokens when a newer dry-run exists for the same tenant and fixture", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const previewRequest = {
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      payloadFixtureKey: "mock-crm-valid"
    };

    const firstPreview = await app.request(
      "/api/integrations/import/preview?testUser=tenant-admin-a",
      jsonRequest(previewRequest)
    );
    const firstPreviewBody = (await readJson(firstPreview)) as { preview: { id: string } };
    const secondPreview = await app.request(
      "/api/integrations/import/preview?testUser=tenant-admin-a",
      jsonRequest(previewRequest)
    );
    const secondPreviewBody = (await readJson(secondPreview)) as { preview: { id: string } };

    expect(firstPreview.status).toBe(200);
    expect(secondPreview.status).toBe(200);
    expect(firstPreviewBody.preview.id).not.toBe(secondPreviewBody.preview.id);

    const staleApply = await app.request(
      "/api/integrations/import/apply?testUser=tenant-admin-a",
      jsonRequest({
        previewId: firstPreviewBody.preview.id,
        batchId: "batch-stale-preview",
        idempotencyKey: "idem-stale-preview",
        confirmed: true
      })
    );
    expect(staleApply.status).toBe(409);
    await expect(readJson(staleApply)).resolves.toMatchObject({ code: "stale_preview" });

    const batchesAfterStale = await app.request("/api/integrations/import/batches?testUser=tenant-admin-a");
    await expect(readJson(batchesAfterStale)).resolves.toMatchObject({ batches: [] });
    const mappingsAfterStale = await app.request("/api/integrations/mappings?testUser=tenant-admin-a");
    await expect(readJson(mappingsAfterStale)).resolves.toMatchObject({ mappings: [] });

    const currentApply = await app.request(
      "/api/integrations/import/apply?testUser=tenant-admin-a",
      jsonRequest({
        previewId: secondPreviewBody.preview.id,
        batchId: "batch-current-preview",
        idempotencyKey: "idem-current-preview",
        confirmed: true
      })
    );
    expect(currentApply.status).toBe(200);
    await expect(readJson(currentApply)).resolves.toMatchObject({
      result: {
        status: "applied",
        batch: { id: "batch-current-preview", previewId: secondPreviewBody.preview.id }
      },
      readback: {
        batches: [expect.objectContaining({ id: "batch-current-preview" })],
        mappings: expect.arrayContaining([expect.objectContaining({ lastSyncStatus: "synced" })]),
        audit: expect.arrayContaining([
          expect.objectContaining({ command: "import_apply", result: "failed" }),
          expect.objectContaining({ command: "import_apply", result: "success" })
        ])
      }
    });
  });

  it("enforces preview/apply permissions and tenant isolation through backend routes", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readOnlyRead = await app.request("/api/integrations/adapters?testUser=readonly-observer-a");
    expect(readOnlyRead.status).toBe(200);

    const readOnlyPreview = await app.request(
      "/api/integrations/import/preview?testUser=readonly-observer-a",
      jsonRequest({
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        payloadFixtureKey: "mock-crm-valid"
      })
    );
    expect(readOnlyPreview.status).toBe(403);

    const preview = await app.request(
      "/api/integrations/import/preview?testUser=tenant-admin-a",
      jsonRequest({
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        payloadFixtureKey: "mock-crm-valid"
      })
    );
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const tenantBReport = await app.request(
      `/api/integrations/import/previews/${previewBody.preview.id}/report?testUser=tenant-admin-b`
    );
    expect(tenantBReport.status).toBe(403);
    const tenantBReportText = await tenantBReport.text();
    expect(tenantBReportText).not.toContain("mock-crm-valid");
    expect(tenantBReportText).not.toContain("conn-mock-crm-a");

    const tenantBApply = await app.request(
      "/api/integrations/import/apply?testUser=tenant-admin-b",
      jsonRequest({
        previewId: previewBody.preview.id,
        batchId: "batch-tenant-b-cross",
        idempotencyKey: "idem-tenant-b-cross",
        confirmed: true
      })
    );
    expect(tenantBApply.status).toBe(403);
    const tenantBApplyText = await tenantBApply.text();
    expect(tenantBApplyText).not.toContain("batch-api-import");
    expect(tenantBApplyText).not.toContain("conn-mock-crm-a");

    const tenantBMappings = await app.request("/api/integrations/mappings?testUser=tenant-admin-b");
    expect(tenantBMappings.status).toBe(200);
    await expect(readJson(tenantBMappings)).resolves.toMatchObject({ mappings: [] });
  });

  it("returns invalid payload diagnostics and rejects apply without partial mappings or batches", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const preview = await app.request(
      "/api/integrations/import/preview?testUser=tenant-admin-a",
      jsonRequest({
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        payloadFixtureKey: "mock-crm-invalid"
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };
    expect(previewBody).toMatchObject({
      validationReport: {
        safeToApply: false,
        blockers: expect.arrayContaining([expect.objectContaining({ severity: "blocking" })])
      },
      dryRunSummary: { canApply: false }
    });

    const apply = await app.request(
      "/api/integrations/import/apply?testUser=tenant-admin-a",
      jsonRequest({
        previewId: previewBody.preview.id,
        batchId: "batch-invalid-import",
        idempotencyKey: "idem-invalid-import",
        confirmed: true
      })
    );
    expect(apply.status).toBe(400);
    await expect(readJson(apply)).resolves.toMatchObject({ code: "validation_error" });

    const batches = await app.request("/api/integrations/import/batches?testUser=tenant-admin-a");
    await expect(readJson(batches)).resolves.toMatchObject({ batches: [] });
    const mappings = await app.request("/api/integrations/mappings?testUser=tenant-admin-a");
    await expect(readJson(mappings)).resolves.toMatchObject({ mappings: [] });
    const audit = await app.request("/api/integrations/audit?testUser=tenant-admin-a");
    await expect(readJson(audit)).resolves.toMatchObject({
      audit: expect.arrayContaining([
        expect.objectContaining({ command: "import_preview", result: "failed" }),
        expect.objectContaining({ command: "import_apply", result: "failed" })
      ])
    });
  });

  it("exposes safe adapter failure diagnostics and recovers after clearing failure mode", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const setFailure = await app.request(
      "/api/integrations/connections/conn-mock-crm-a/failure-mode?testUser=tenant-admin-a",
      jsonRequest({
        code: "adapter_rate_limited",
        message: "Mock CRM rate limited",
        retryAfterSeconds: 60
      })
    );
    expect(setFailure.status).toBe(200);

    const failedPreview = await app.request(
      "/api/integrations/import/preview?testUser=tenant-admin-a",
      jsonRequest({
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        payloadFixtureKey: "mock-crm-valid"
      })
    );
    expect(failedPreview.status).toBe(429);
    await expect(readJson(failedPreview)).resolves.toMatchObject({
      code: "adapter_rate_limited"
    });

    const diagnostics = await app.request("/api/integrations/diagnostics?testUser=tenant-admin-a");
    await expect(readJson(diagnostics)).resolves.toMatchObject({
      diagnostics: [
        expect.objectContaining({
          connectionId: "conn-mock-crm-a",
          status: "rate_limited",
          failure: expect.objectContaining({ code: "adapter_rate_limited", retryAfterSeconds: 60 })
        })
      ]
    });

    const clearFailure = await app.request(
      "/api/integrations/connections/conn-mock-crm-a/failure-mode?testUser=tenant-admin-a",
      jsonRequest({}, "DELETE")
    );
    expect(clearFailure.status).toBe(200);

    const recoveredPreview = await app.request(
      "/api/integrations/import/preview?testUser=tenant-admin-a",
      jsonRequest({
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        payloadFixtureKey: "mock-crm-valid"
      })
    );
    expect(recoveredPreview.status).toBe(200);
  });
});
