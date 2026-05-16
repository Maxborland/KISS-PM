import { describe, expect, it } from "vitest";

import {
  applyConfigurationImportPreview,
  createConfigurationExportPackage,
  createConfigurationImportPackageWithChecksum,
  createCustomFieldRegistry,
  createTenantLabelSet,
  previewConfigurationImport
} from "./index";

function currentPackage() {
  return createConfigurationExportPackage({
    schemaVersion: 1,
    tenantId: "tenant-a",
    exportedAt: "2026-08-01T00:00:00.000Z",
    configurationVersion: 1,
    labelSet: createTenantLabelSet({
      tenantId: "tenant-a",
      configurationVersion: 1,
      labels: {
        "runtime.role.project_manager": "Руководитель проекта",
        "runtime.stage.initiation": "Инициация"
      },
      updatedAt: "2026-08-01T00:00:00.000Z"
    }),
    customFieldRegistry: createCustomFieldRegistry({
      tenantId: "tenant-a",
      version: 1,
      definitions: [],
      updatedAt: "2026-08-01T00:00:00.000Z"
    }),
    actionConfiguration: {
      tenantId: "tenant-a",
      version: 1,
      actionConfigs: [],
      updatedAt: "2026-08-01T00:00:00.000Z"
    }
  });
}

function incomingPackage() {
  const current = currentPackage();
  return createConfigurationImportPackageWithChecksum({
    ...current,
    configurationVersion: 2,
    exportedAt: "2026-08-01T00:05:00.000Z",
    labelSet: createTenantLabelSet({
      ...current.labelSet,
      configurationVersion: 2,
      labels: {
        ...current.labelSet.labels,
        "runtime.role.project_manager": "РП"
      },
      updatedAt: "2026-08-01T00:05:00.000Z"
    }),
    actionConfiguration: {
      tenantId: "tenant-a",
      version: 2,
      actionConfigs: [{ actionKey: "accept_risk", enabled: false, formFields: [] }],
      updatedAt: "2026-08-01T00:05:00.000Z"
    }
  });
}

describe("configuration export and import package", () => {
  it("previews tenant-scoped import changes without mutating the current package", () => {
    const current = currentPackage();
    const incoming = incomingPackage();

    const preview = previewConfigurationImport(current, incoming, {
      id: "preview-config-import-tenant-a-1",
      actorId: "tenant-admin-a",
      createdAt: "2026-08-01T00:06:00.000Z"
    });

    expect(preview).toMatchObject({
      id: "preview-config-import-tenant-a-1",
      tenantId: "tenant-a",
      mutatesState: false,
      canApply: true,
      validationIssues: [],
      before: {
        configurationVersion: 1,
        labelSetVersion: 1,
        actionConfigurationVersion: 1
      },
      after: {
        configurationVersion: 2,
        labelSetVersion: 2,
        actionConfigurationVersion: 2
      },
      diffs: expect.arrayContaining([
        expect.objectContaining({ kind: "label_set", path: "labelSet.configurationVersion" }),
        expect.objectContaining({ kind: "action_configuration", path: "actionConfiguration.version" })
      ])
    });
    expect(current.labelSet.labels["runtime.role.project_manager"]).toBe("Руководитель проекта");
    expect(current.actionConfiguration.version).toBe(1);
  });

  it("rejects checksum mismatch and tenant mismatch without an applyable preview", () => {
    const current = currentPackage();
    const tampered = { ...incomingPackage(), checksum: "bad-checksum" };
    const tamperedPreview = previewConfigurationImport(current, tampered, {
      id: "preview-config-import-tampered",
      actorId: "tenant-admin-a",
      createdAt: "2026-08-01T00:06:00.000Z"
    });

    expect(tamperedPreview.canApply).toBe(false);
    expect(tamperedPreview.validationIssues).toEqual([
      expect.objectContaining({
        code: "import_checksum_mismatch",
        severity: "error",
        recoveryText: "Повторите экспорт и загрузите пакет без ручных изменений checksum."
      })
    ]);

    const tenantMismatch = createConfigurationImportPackageWithChecksum({
      ...incomingPackage(),
      tenantId: "tenant-b",
      labelSet: { ...incomingPackage().labelSet, tenantId: "tenant-b" },
      customFieldRegistry: { ...incomingPackage().customFieldRegistry, tenantId: "tenant-b" },
      actionConfiguration: { ...incomingPackage().actionConfiguration, tenantId: "tenant-b" }
    });
    const mismatchPreview = previewConfigurationImport(current, tenantMismatch, {
      id: "preview-config-import-tenant-b",
      actorId: "tenant-admin-a",
      createdAt: "2026-08-01T00:06:00.000Z"
    });

    expect(mismatchPreview.canApply).toBe(false);
    expect(mismatchPreview.validationIssues).toEqual([
      expect.objectContaining({ code: "tenant_mismatch", severity: "error" })
    ]);
  });

  it("applies only a fresh valid preview and emits audit evidence", () => {
    const current = currentPackage();
    const incoming = incomingPackage();
    const preview = previewConfigurationImport(current, incoming, {
      id: "preview-config-import-tenant-a-1",
      actorId: "tenant-admin-a",
      createdAt: "2026-08-01T00:06:00.000Z"
    });

    const result = applyConfigurationImportPreview(current, {
      preview,
      incomingPackage: incoming,
      auditEventId: "audit-config-import-tenant-a-2",
      appliedAt: "2026-08-01T00:07:00.000Z"
    });

    expect(result).toMatchObject({
      importedPackage: {
        tenantId: "tenant-a",
        configurationVersion: 2,
        labelSet: { configurationVersion: 2 },
        actionConfiguration: { version: 2 }
      },
      audit: {
        commandType: "tenant_configuration.import_apply",
        beforeVersion: 1,
        afterVersion: 2,
        auditEventId: "audit-config-import-tenant-a-2"
      }
    });

    const invalidPreview = previewConfigurationImport(current, { ...incoming, checksum: "bad-checksum" }, {
      id: "preview-config-import-invalid",
      actorId: "tenant-admin-a",
      createdAt: "2026-08-01T00:08:00.000Z"
    });
    expect(() =>
      applyConfigurationImportPreview(current, {
        preview: invalidPreview,
        incomingPackage: incoming,
        auditEventId: "audit-invalid",
        appliedAt: "2026-08-01T00:09:00.000Z"
      })
    ).toThrow("configuration import preview has validation errors");
  });
});
