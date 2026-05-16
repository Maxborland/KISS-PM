import { createConfigurationImportPackageWithChecksum } from "@kiss-pm/tenant-config";
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

describe("Phase 10 configuration validation and export/import API", () => {
  it("returns configuration overview, validates current state, exports a tenant-safe package, and imports through preview/apply", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const overview = await app.request("/api/tenant/configuration?testUser=tenant-admin-a");
    expect(overview.status).toBe(200);
    await expect(readJson(overview)).resolves.toMatchObject({
      active: {
        tenantId: "tenant-a",
        configurationVersion: 1,
        labelSetVersion: 1,
        customFieldRegistryVersion: 1,
        actionConfigurationVersion: 1
      },
      validation: { canPublish: true, issues: [] },
      runtimeSurfaces: expect.arrayContaining(["tenant.labels", "portfolio.control", "tenant.action_config"])
    });

    const validation = await app.request("/api/tenant/configuration/validate?testUser=tenant-admin-a", jsonRequest({}));
    expect(validation.status).toBe(200);
    await expect(readJson(validation)).resolves.toMatchObject({
      validation: { canPublish: true, issues: [] }
    });

    const exported = await app.request("/api/tenant/configuration/export?testUser=tenant-admin-a");
    expect(exported.status).toBe(200);
    const exportedBody = (await readJson(exported)) as { package: ReturnType<typeof createConfigurationImportPackageWithChecksum> };
    expect(exportedBody.package).toMatchObject({
      tenantId: "tenant-a",
      configurationVersion: 1,
      labelSet: { tenantId: "tenant-a", configurationVersion: 1 },
      checksum: expect.stringMatching(/^cfg-/)
    });

    const incoming = createConfigurationImportPackageWithChecksum({
      ...exportedBody.package,
      configurationVersion: 2,
      exportedAt: "2026-08-01T00:30:00.000Z",
      labelSet: {
        ...exportedBody.package.labelSet,
        configurationVersion: 2,
        labels: {
          ...exportedBody.package.labelSet.labels,
          "runtime.role.project_manager": "РП импорт"
        },
        updatedAt: "2026-08-01T00:30:00.000Z"
      },
      actionConfiguration: {
        ...exportedBody.package.actionConfiguration,
        version: 2,
        actionConfigs: [{ actionKey: "accept_risk", enabled: false, formFields: [] }],
        updatedAt: "2026-08-01T00:30:00.000Z"
      }
    });

    const preview = await app.request(
      "/api/tenant/configuration/import/preview?testUser=tenant-admin-a",
      jsonRequest({ package: incoming })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };
    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      canApply: true,
      validationIssues: [],
      after: {
        configurationVersion: 2,
        labelSetVersion: 2,
        actionConfigurationVersion: 2
      }
    });

    const unchanged = await app.request("/api/tenant/configuration?testUser=tenant-admin-a");
    await expect(readJson(unchanged)).resolves.toMatchObject({
      active: { configurationVersion: 1, labelSetVersion: 1, actionConfigurationVersion: 1 }
    });

    const apply = await app.request(
      "/api/tenant/configuration/import/apply?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(apply.status).toBe(200);
    await expect(readJson(apply)).resolves.toMatchObject({
      result: {
        audit: {
          commandType: "tenant_configuration.import_apply",
          beforeVersion: 1,
          afterVersion: 2
        },
        actionExecution: {
          commandType: "tenant_configuration.import_apply",
          requiredPermission: "tenant.config.import"
        }
      },
      readback: {
        active: {
          configurationVersion: 2,
          labelSetVersion: 2,
          actionConfigurationVersion: 2
        }
      }
    });

    const labels = await app.request("/api/tenant/labels?testUser=tenant-admin-a");
    await expect(readJson(labels)).resolves.toMatchObject({
      labelSet: {
        configurationVersion: 2,
        labels: { "runtime.role.project_manager": "РП импорт" }
      }
    });

    const actionConfigs = await app.request("/api/tenant/action-configs?testUser=tenant-admin-a");
    await expect(readJson(actionConfigs)).resolves.toMatchObject({
      configuration: { version: 2 },
      actions: expect.arrayContaining([expect.objectContaining({ key: "accept_risk", enabled: false })])
    });

    const audit = await app.request("/api/tenant/configuration/audit?testUser=tenant-admin-a");
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ actionKey: "tenant_configuration.import_apply" })]),
      actionExecutions: expect.arrayContaining([
        expect.objectContaining({ commandType: "tenant_configuration.import_apply" })
      ])
    });
  });

  it("denies unauthorized and cross-tenant import/export without leaking or partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readOnlyExport = await app.request("/api/tenant/configuration/export?testUser=readonly-observer-a");
    expect(readOnlyExport.status).toBe(403);

    const exported = await app.request("/api/tenant/configuration/export?testUser=tenant-admin-a");
    const exportedBody = (await readJson(exported)) as { package: ReturnType<typeof createConfigurationImportPackageWithChecksum> };
    const tenantBPackage = createConfigurationImportPackageWithChecksum({
      ...exportedBody.package,
      tenantId: "tenant-b",
      labelSet: { ...exportedBody.package.labelSet, tenantId: "tenant-b" },
      customFieldRegistry: { ...exportedBody.package.customFieldRegistry, tenantId: "tenant-b" },
      actionConfiguration: { ...exportedBody.package.actionConfiguration, tenantId: "tenant-b" }
    });

    const crossTenantPreview = await app.request(
      "/api/tenant/configuration/import/preview?testUser=tenant-admin-a",
      jsonRequest({ package: tenantBPackage })
    );
    expect(crossTenantPreview.status).toBe(200);
    const crossTenantBody = (await readJson(crossTenantPreview)) as { preview: { id: string; canApply: boolean } };
    expect(crossTenantBody.preview.canApply).toBe(false);
    expect(JSON.stringify(crossTenantBody)).not.toContain("tenant-admin-b");

    const deniedApply = await app.request(
      "/api/tenant/configuration/import/apply?testUser=tenant-admin-a",
      jsonRequest({ previewId: crossTenantBody.preview.id })
    );
    expect(deniedApply.status).toBe(409);

    const readback = await app.request("/api/tenant/configuration?testUser=tenant-admin-a");
    await expect(readJson(readback)).resolves.toMatchObject({
      active: { configurationVersion: 1, labelSetVersion: 1, actionConfigurationVersion: 1 }
    });
  });

  it("rejects malformed import packages and stale previews without partial writes", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const exported = await app.request("/api/tenant/configuration/export?testUser=tenant-admin-a");
    const exportedBody = (await readJson(exported)) as { package: ReturnType<typeof createConfigurationImportPackageWithChecksum> };

    const tampered = { ...exportedBody.package, checksum: "bad-checksum" };
    const preview = await app.request(
      "/api/tenant/configuration/import/preview?testUser=tenant-admin-a",
      jsonRequest({ package: tampered })
    );
    expect(preview.status).toBe(200);
    await expect(readJson(preview)).resolves.toMatchObject({
      preview: {
        canApply: false,
        validationIssues: [expect.objectContaining({ code: "import_checksum_mismatch" })]
      }
    });

    const validPreview = await app.request(
      "/api/tenant/configuration/import/preview?testUser=tenant-admin-a",
      jsonRequest({ package: exportedBody.package })
    );
    const validPreviewBody = (await readJson(validPreview)) as { preview: { id: string } };
    const secondValidPreview = await app.request(
      "/api/tenant/configuration/import/preview?testUser=tenant-admin-a",
      jsonRequest({ package: exportedBody.package })
    );
    expect(secondValidPreview.status).toBe(200);

    const staleApply = await app.request(
      "/api/tenant/configuration/import/apply?testUser=tenant-admin-a",
      jsonRequest({ previewId: validPreviewBody.preview.id })
    );
    expect(staleApply.status).toBe(409);
  });

  it("validates packages without consuming an existing import preview token", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const exported = await app.request("/api/tenant/configuration/export?testUser=tenant-admin-a");
    const exportedBody = (await readJson(exported)) as { package: ReturnType<typeof createConfigurationImportPackageWithChecksum> };
    const incoming = createConfigurationImportPackageWithChecksum({
      ...exportedBody.package,
      configurationVersion: 2,
      exportedAt: "2026-08-01T00:40:00.000Z",
      labelSet: {
        ...exportedBody.package.labelSet,
        configurationVersion: 2,
        labels: {
          ...exportedBody.package.labelSet.labels,
          "runtime.role.project_manager": "РП после validate"
        },
        updatedAt: "2026-08-01T00:40:00.000Z"
      }
    });
    const preview = await app.request(
      "/api/tenant/configuration/import/preview?testUser=tenant-admin-a",
      jsonRequest({ package: incoming })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const validation = await app.request(
      "/api/tenant/configuration/validate?testUser=tenant-admin-a",
      jsonRequest({ package: incoming })
    );
    expect(validation.status).toBe(200);

    const apply = await app.request(
      "/api/tenant/configuration/import/apply?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(apply.status).toBe(200);
    await expect(readJson(apply)).resolves.toMatchObject({
      readback: { active: { configurationVersion: 2, labelSetVersion: 2 } }
    });
  });
});
