import { describe, expect, it } from "vitest";

import {
  createControlSurfaceDefinition,
  previewControlSurfaceLayoutPublish,
  publishControlSurfaceLayoutPreview
} from "./index";

const tenantId = "tenant-a";

const definition = createControlSurfaceDefinition({
  id: "portfolio-control",
  tenantId,
  key: "portfolio.control",
  label: "Контроль портфеля",
  version: 1,
  status: "active",
  surfaceType: "portfolio",
  dataSource: {
    type: "composite",
    key: "portfolio_operational_signals",
    entityTypes: ["project", "control_signal"],
    traceKeys: ["project.id"]
  },
  view: {
    id: "portfolio-view",
    tenantId,
    surfaceDefinitionId: "portfolio-control",
    key: "default",
    label: "Операционный контроль",
    viewType: "hybrid",
    version: 1,
    fields: [
      {
        id: "field-project",
        key: "project_label",
        label: "Проект",
        entityType: "project",
        valueType: "text",
        visible: true,
        sortable: true,
        filterable: true
      },
      {
        id: "field-severity",
        key: "severity",
        label: "Риск",
        entityType: "control_signal",
        valueType: "severity",
        visible: true,
        sortable: true,
        filterable: true
      },
      {
        id: "field-internal",
        key: "suggested_resource_profile_id",
        label: "Ресурс",
        entityType: "resource_overload",
        valueType: "text",
        visible: true,
        sortable: false,
        filterable: false
      }
    ],
    widgets: [
      {
        id: "widget-critical",
        key: "critical_signal_count",
        label: "Критичные сигналы",
        widgetType: "severity_summary",
        sourceFieldKey: "severity",
        severity: "critical"
      }
    ],
    actionSlots: [
      {
        id: "action-corrective",
        key: "create_corrective_action",
        label: "Создать задачу",
        actionDefinitionKey: "create_corrective_action",
        slotType: "primary",
        targetEntityType: "control_signal",
        requiredPermission: "control.action:write",
        dryRunRequired: true
      },
      {
        id: "action-risk",
        key: "accept_risk",
        label: "Принять риск",
        actionDefinitionKey: "accept_risk",
        slotType: "row",
        targetEntityType: "control_signal",
        requiredPermission: "risk:accept",
        dryRunRequired: true
      }
    ],
    drilldowns: [],
    savedViews: [],
    permissionRequirements: {
      read: "control.surface:read",
      actions: ["control.action:write", "risk:accept"],
      audit: "audit.read"
    }
  },
  updatedAt: "2026-05-16T14:00:00.000Z"
});

const draft = {
  viewLabel: "Портфель без технических полей",
  visibleFieldKeys: ["project_label", "severity"],
  filterKeys: ["severity"],
  sortKeys: ["project_label"],
  groupKeys: ["severity"],
  widgetKeys: ["critical_signal_count"],
  actionSlotKeys: ["create_corrective_action", "accept_risk"],
  savedView: {
    id: "saved-view-critical-portfolio",
    key: "critical_portfolio",
    label: "Критичный портфель",
    ownerType: "tenant" as const,
    filterKeys: ["severity"],
    sortKeys: ["project_label"],
    groupKeys: ["severity"],
    scope: "tenant" as const
  }
};

describe("control surface layout builder", () => {
  it("previews a non-mutating saved-view layout publish and explains removed fields", () => {
    const preview = previewControlSurfaceLayoutPublish(definition, {
      id: "preview-layout-1",
      actorId: "tenant-admin-a",
      expectedSurfaceVersion: 1,
      draft,
      affectedRuntimeSurfaces: ["portfolio.control"],
      createdAt: "2026-08-01T00:00:00.000Z"
    });

    expect(preview).toMatchObject({
      mutatesState: false,
      before: {
        surfaceVersion: 1,
        viewVersion: 1,
        visibleFieldKeys: ["project_label", "severity", "suggested_resource_profile_id"]
      },
      after: {
        surfaceVersion: 2,
        viewVersion: 2,
        visibleFieldKeys: ["project_label", "severity"],
        savedViewKeys: ["critical_portfolio"]
      },
      unavailable: {
        fields: ["suggested_resource_profile_id"],
        reasons: expect.arrayContaining([
          "field suggested_resource_profile_id will be hidden by the published layout"
        ])
      }
    });

    expect(definition.version).toBe(1);
    expect(definition.view.savedViews).toEqual([]);
  });

  it("publishes only a fresh preview, preserves the previous version, and rejects stale previews", () => {
    const preview = previewControlSurfaceLayoutPublish(definition, {
      id: "preview-layout-1",
      actorId: "tenant-admin-a",
      expectedSurfaceVersion: 1,
      draft,
      affectedRuntimeSurfaces: ["portfolio.control"],
      createdAt: "2026-08-01T00:00:00.000Z"
    });

    const result = publishControlSurfaceLayoutPreview(definition, {
      preview,
      expectedSurfaceVersion: 1,
      auditEventId: "audit-layout-1",
      publishedAt: "2026-08-01T00:01:00.000Z"
    });

    expect(result.previousDefinition.version).toBe(1);
    expect(result.definition).toMatchObject({
      version: 2,
      view: {
        version: 2,
        label: "Портфель без технических полей",
        savedViews: [expect.objectContaining({ key: "critical_portfolio", groupKeys: ["severity"], scope: "tenant" })]
      }
    });
    expect(result.definition.view.fields.find((field) => field.key === "suggested_resource_profile_id")?.visible).toBe(false);
    expect(result.audit).toMatchObject({
      commandType: "control_surface_layout.publish",
      beforeSurfaceVersion: 1,
      afterSurfaceVersion: 2,
      savedViewKey: "critical_portfolio"
    });

    expect(() =>
      publishControlSurfaceLayoutPreview(result.definition, {
        preview,
        expectedSurfaceVersion: 2,
        auditEventId: "audit-layout-stale",
        publishedAt: "2026-08-01T00:02:00.000Z"
      })
    ).toThrow("control surface layout preview is stale");
  });

  it("rejects invalid field, filter, widget, and action references without producing a publishable preview", () => {
    expect(() =>
      previewControlSurfaceLayoutPublish(definition, {
        id: "preview-layout-invalid",
        actorId: "tenant-admin-a",
        expectedSurfaceVersion: 1,
        draft: {
          ...draft,
          visibleFieldKeys: ["project_label", "missing_field"]
        },
        affectedRuntimeSurfaces: ["portfolio.control"],
        createdAt: "2026-08-01T00:00:00.000Z"
      })
    ).toThrow("invalid_layout");

    expect(() =>
      previewControlSurfaceLayoutPublish(definition, {
        id: "preview-layout-invalid-filter",
        actorId: "tenant-admin-a",
        expectedSurfaceVersion: 1,
        draft: {
          ...draft,
          filterKeys: ["suggested_resource_profile_id"]
        },
        affectedRuntimeSurfaces: ["portfolio.control"],
        createdAt: "2026-08-01T00:00:00.000Z"
      })
    ).toThrow("invalid_layout");
  });
});
