import { describe, expect, it } from "vitest";

import {
  createTenantLabelSet,
  publishTenantLabelSetPreview,
  previewTenantLabelSetPublish,
  TenantConfigModelError
} from "./index";

const currentLabelSet = createTenantLabelSet({
  tenantId: "tenant-a",
  configurationVersion: 3,
  labels: {
    "role.project_manager": "Руководитель проекта",
    "stage.initiation": "Инициация",
    "navigation.projects": "Проекты"
  },
  updatedAt: "2026-05-17T00:00:00.000Z"
});

describe("tenant label builder", () => {
  it("previews role and stage label changes without mutating the current label set", () => {
    const preview = previewTenantLabelSetPublish(currentLabelSet, {
      id: "preview-labels-a",
      actorId: "tenant-admin-a",
      changes: [
        { key: "role.project_manager", label: "РП" },
        { key: "stage.initiation", label: "Старт проекта" }
      ],
      affectedRuntimeSurfaces: ["project.stage.header", "task.participant.role", "control.surface.filters"],
      createdAt: "2026-05-17T00:01:00.000Z"
    });

    expect(preview).toMatchObject({
      id: "preview-labels-a",
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      mutatesState: false,
      before: { configurationVersion: 3 },
      after: { configurationVersion: 4 },
      affectedRuntimeSurfaces: ["project.stage.header", "task.participant.role", "control.surface.filters"]
    });
    expect(preview.changes).toEqual([
      { key: "role.project_manager", beforeLabel: "Руководитель проекта", afterLabel: "РП" },
      { key: "stage.initiation", beforeLabel: "Инициация", afterLabel: "Старт проекта" }
    ]);
    expect(currentLabelSet.labels["role.project_manager"]).toBe("Руководитель проекта");
  });

  it("publishes only a fresh preview and returns audit evidence", () => {
    const preview = previewTenantLabelSetPublish(currentLabelSet, {
      id: "preview-labels-a",
      actorId: "tenant-admin-a",
      changes: [{ key: "role.project_manager", label: "РП" }],
      affectedRuntimeSurfaces: ["task.participant.role"],
      createdAt: "2026-05-17T00:01:00.000Z"
    });

    const result = publishTenantLabelSetPreview(currentLabelSet, {
      preview,
      expectedConfigurationVersion: 3,
      auditEventId: "audit-labels-a",
      publishedAt: "2026-05-17T00:02:00.000Z"
    });

    expect(result.labelSet).toMatchObject({
      tenantId: "tenant-a",
      configurationVersion: 4,
      labels: {
        "role.project_manager": "РП",
        "stage.initiation": "Инициация"
      }
    });
    expect(result.audit).toMatchObject({
      auditEventId: "audit-labels-a",
      commandType: "tenant_label_set.publish",
      beforeConfigurationVersion: 3,
      afterConfigurationVersion: 4,
      changedKeys: ["role.project_manager"]
    });
    expect(currentLabelSet.configurationVersion).toBe(3);
  });

  it("rejects unknown keys, duplicate keys, stale previews, and missing audit evidence", () => {
    expect(() =>
      previewTenantLabelSetPublish(currentLabelSet, {
        id: "preview-unknown",
        actorId: "tenant-admin-a",
        changes: [{ key: "stage.unknown", label: "Неизвестно" }],
        affectedRuntimeSurfaces: ["project.stage.header"],
        createdAt: "2026-05-17T00:01:00.000Z"
      })
    ).toThrow(TenantConfigModelError);

    expect(() =>
      previewTenantLabelSetPublish(currentLabelSet, {
        id: "preview-duplicate",
        actorId: "tenant-admin-a",
        changes: [
          { key: "stage.initiation", label: "Старт" },
          { key: "stage.initiation", label: "Запуск" }
        ],
        affectedRuntimeSurfaces: ["project.stage.header"],
        createdAt: "2026-05-17T00:01:00.000Z"
      })
    ).toThrow(TenantConfigModelError);

    const preview = previewTenantLabelSetPublish(currentLabelSet, {
      id: "preview-labels-a",
      actorId: "tenant-admin-a",
      changes: [{ key: "role.project_manager", label: "РП" }],
      affectedRuntimeSurfaces: ["task.participant.role"],
      createdAt: "2026-05-17T00:01:00.000Z"
    });
    const changedCurrent = createTenantLabelSet({
      ...currentLabelSet,
      configurationVersion: 4,
      labels: {
        ...currentLabelSet.labels,
        "navigation.projects": "Портфель"
      }
    });

    expect(() =>
      publishTenantLabelSetPreview(changedCurrent, {
        preview,
        expectedConfigurationVersion: 3,
        auditEventId: "audit-labels-a",
        publishedAt: "2026-05-17T00:02:00.000Z"
      })
    ).toThrow(/stale/i);

    expect(() =>
      publishTenantLabelSetPreview(currentLabelSet, {
        preview,
        expectedConfigurationVersion: 3,
        auditEventId: "",
        publishedAt: "2026-05-17T00:02:00.000Z"
      })
    ).toThrow(TenantConfigModelError);
  });
});
