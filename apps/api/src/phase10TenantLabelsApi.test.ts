import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

describe("Phase 10 tenant labels API", () => {
  it("previews and publishes role/stage labels with audit and runtime readback", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const initial = await app.request("/api/tenant/labels?testUser=tenant-admin-a");
    expect(initial.status).toBe(200);
    await expect(readJson(initial)).resolves.toMatchObject({
      labelSet: {
        tenantId: "tenant-a",
        labels: {
          "runtime.role.project_manager": "Руководитель проекта",
          "runtime.stage.initiation": "Инициация"
        }
      },
      runtimeProjection: {
        roles: expect.arrayContaining([{ key: "project_manager", label: "Руководитель проекта" }]),
        stages: expect.arrayContaining([{ key: "initiation", label: "Инициация" }])
      }
    });

    const preview = await app.request(
      "/api/tenant/labels/preview?testUser=tenant-admin-a",
      jsonRequest({
        changes: [
          { key: "runtime.role.project_manager", label: "РП" },
          { key: "runtime.stage.initiation", label: "Старт проекта" }
        ],
        affectedRuntimeSurfaces: ["project.stage.header", "task.participant.role"]
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as {
      preview: { id: string; mutatesState: boolean; changes: Array<{ key: string; afterLabel: string }> };
    };
    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      changes: [
        { key: "runtime.role.project_manager", afterLabel: "РП" },
        { key: "runtime.stage.initiation", afterLabel: "Старт проекта" }
      ]
    });

    const unchanged = await app.request("/api/tenant/labels?testUser=tenant-admin-a");
    expect(unchanged.status).toBe(200);
    await expect(readJson(unchanged)).resolves.toMatchObject({
      labelSet: { configurationVersion: 1, labels: { "runtime.role.project_manager": "Руководитель проекта" } }
    });

    const publish = await app.request(
      "/api/tenant/labels/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(publish.status).toBe(200);
    const publishBody = (await readJson(publish)) as {
      result: { audit: { auditEventId: string; commandType: string }; actionExecution: { commandType: string } };
    };
    expect(publishBody.result).toMatchObject({
      audit: { commandType: "tenant_label_set.publish" },
      actionExecution: { commandType: "tenant_label_set.publish" }
    });

    const readback = await app.request("/api/tenant/labels?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      labelSet: {
        configurationVersion: 2,
        labels: {
          "runtime.role.project_manager": "РП",
          "runtime.stage.initiation": "Старт проекта"
        }
      },
      runtimeProjection: {
        roles: expect.arrayContaining([{ key: "project_manager", label: "РП" }]),
        stages: expect.arrayContaining([{ key: "initiation", label: "Старт проекта" }])
      }
    });

    const currentTenant = await app.request("/tenants/current?testUser=tenant-admin-a");
    expect(currentTenant.status).toBe(200);
    await expect(readJson(currentTenant)).resolves.toMatchObject({
      tenant: { configurationVersion: 2 },
      labels: { "runtime.role.project_manager": "РП" }
    });

    const audit = await app.request("/api/tenant/configuration/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: [expect.objectContaining({ actionKey: "tenant_label_set.publish" })],
      actionExecutions: [
        expect.objectContaining({
          commandType: "tenant_label_set.publish",
          auditEventIds: [publishBody.result.audit.auditEventId]
        })
      ]
    });
  });

  it("denies read-only and cross-tenant publish without partial mutation or leaked preview", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readOnlyRead = await app.request("/api/tenant/labels?testUser=readonly-observer-a");
    expect(readOnlyRead.status).toBe(200);

    const readOnlyPreview = await app.request(
      "/api/tenant/labels/preview?testUser=readonly-observer-a",
      jsonRequest({
        changes: [{ key: "runtime.role.project_manager", label: "РП" }],
        affectedRuntimeSurfaces: ["task.participant.role"]
      })
    );
    expect(readOnlyPreview.status).toBe(403);

    const adminPreview = await app.request(
      "/api/tenant/labels/preview?testUser=tenant-admin-a",
      jsonRequest({
        changes: [{ key: "runtime.role.project_manager", label: "РП" }],
        affectedRuntimeSurfaces: ["task.participant.role"]
      })
    );
    expect(adminPreview.status).toBe(200);
    const adminPreviewBody = (await readJson(adminPreview)) as { preview: { id: string } };

    const tenantBPublish = await app.request(
      "/api/tenant/labels/publish?testUser=tenant-admin-b",
      jsonRequest({ previewId: adminPreviewBody.preview.id })
    );
    expect(tenantBPublish.status).toBe(409);
    expect(await tenantBPublish.text()).not.toContain(adminPreviewBody.preview.id);

    const afterDenied = await app.request("/api/tenant/labels?testUser=tenant-admin-a");
    expect(afterDenied.status).toBe(200);
    await expect(readJson(afterDenied)).resolves.toMatchObject({
      labelSet: { configurationVersion: 1, labels: { "runtime.role.project_manager": "Руководитель проекта" } }
    });
  });

  it("rejects invalid label keys and stale publish without partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const invalid = await app.request(
      "/api/tenant/labels/preview?testUser=tenant-admin-a",
      jsonRequest({
        changes: [{ key: "runtime.stage.unknown", label: "Неизвестно" }],
        affectedRuntimeSurfaces: ["project.stage.header"]
      })
    );
    expect(invalid.status).toBe(400);

    const firstPreview = await app.request(
      "/api/tenant/labels/preview?testUser=tenant-admin-a",
      jsonRequest({
        changes: [{ key: "runtime.role.project_manager", label: "РП" }],
        affectedRuntimeSurfaces: ["task.participant.role"]
      })
    );
    expect(firstPreview.status).toBe(200);
    const firstPreviewBody = (await readJson(firstPreview)) as { preview: { id: string } };

    const secondPreview = await app.request(
      "/api/tenant/labels/preview?testUser=tenant-admin-a",
      jsonRequest({
        changes: [{ key: "runtime.stage.initiation", label: "Старт проекта" }],
        affectedRuntimeSurfaces: ["project.stage.header"]
      })
    );
    expect(secondPreview.status).toBe(200);
    const secondPreviewBody = (await readJson(secondPreview)) as { preview: { id: string } };
    const secondPublish = await app.request(
      "/api/tenant/labels/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: secondPreviewBody.preview.id })
    );
    expect(secondPublish.status).toBe(200);

    const stalePublish = await app.request(
      "/api/tenant/labels/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: firstPreviewBody.preview.id })
    );
    expect(stalePublish.status).toBe(409);
    await expect(readJson(stalePublish)).resolves.toMatchObject({ code: "stale_preview" });

    const readback = await app.request("/api/tenant/labels?testUser=tenant-admin-a");
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      labelSet: {
        configurationVersion: 2,
        labels: {
          "runtime.role.project_manager": "Руководитель проекта",
          "runtime.stage.initiation": "Старт проекта"
        }
      }
    });
  });
});
