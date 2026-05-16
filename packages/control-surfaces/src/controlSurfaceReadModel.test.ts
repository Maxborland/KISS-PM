import { describe, expect, it } from "vitest";

import {
  createControlSurfaceDefinition,
  createControlSurfaceReadModel,
  type ControlSurfaceSourceRecord
} from "./index";

const tenantId = "tenant-a";

const definition = createControlSurfaceDefinition({
  id: "surface-portfolio",
  tenantId,
  key: "portfolio.control",
  label: "Контроль портфеля",
  version: 1,
  status: "active",
  surfaceType: "portfolio",
  dataSource: {
    type: "composite",
    key: "portfolio_operational_signals",
    entityTypes: ["project", "kpi_signal", "resource_overload"],
    traceKeys: ["project.id", "kpiSignal.id", "resourceOverload.id"]
  },
  view: {
    id: "view-portfolio-default",
    tenantId,
    surfaceDefinitionId: "surface-portfolio",
    key: "default",
    label: "Основной вид",
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
        id: "slot-corrective",
        key: "create_corrective_action",
        label: "Создать корректирующую задачу",
        actionDefinitionKey: "corrective_task.create",
        slotType: "primary",
        targetEntityType: "kpi_signal",
        requiredPermission: "control.action:write",
        dryRunRequired: false
      },
      {
        id: "slot-risk",
        key: "accept_risk",
        label: "Принять риск",
        actionDefinitionKey: "risk.accept",
        slotType: "row",
        targetEntityType: "control_signal",
        requiredPermission: "risk:accept",
        dryRunRequired: true
      }
    ],
    drilldowns: [
      {
        id: "drilldown-gantt",
        key: "open_project_gantt",
        label: "Открыть Гантт",
        targetSurfaceKey: "project.gantt",
        targetEntityType: "project",
        routeTemplate: "/projects/:projectId/gantt",
        requiredPermission: "schedule:read"
      }
    ],
    savedViews: [],
    permissionRequirements: {
      read: "control.surface:read",
      actions: ["control.action:write", "risk:accept"],
      audit: "audit.read"
    }
  },
  updatedAt: "2026-05-16T14:00:00.000Z"
});

const records: ControlSurfaceSourceRecord[] = [
  {
    id: "row-critical-kpi",
    tenantId,
    entityType: "kpi_signal",
    entityId: "signal-kpi-schedule-variance-a",
    label: "Отклонение трудозатрат",
    severity: "critical",
    explanation: "Критическое отклонение",
    sourceRefs: [
      { entityType: "project", entityId: "project-alpha-a" },
      { entityType: "kpi_signal", entityId: "signal-kpi-schedule-variance-a" }
    ],
    fieldValues: {
      project_label: "Проект Альфа",
      severity: "critical"
    },
    recommendedActionKeys: ["corrective_task.create", "risk.accept"],
    drilldownParams: {
      projectId: "project-alpha-a"
    }
  }
];

describe("control surface read model", () => {
  it("builds a tenant-scoped read DTO with fields, severity, trace, widgets, drilldowns, and permission-scoped actions", () => {
    const model = createControlSurfaceReadModel({
      definition,
      records,
      actorPermissionKeys: ["control.surface:read", "control.action:write", "schedule:read"],
      page: { offset: 0, limit: 20 }
    });

    expect(model).toMatchObject({
      surface: {
        id: "surface-portfolio",
        tenantId,
        key: "portfolio.control",
        viewType: "hybrid"
      },
      rows: [
        {
          id: "row-critical-kpi",
          severity: "critical",
          fieldValues: {
            project_label: "Проект Альфа",
            severity: "critical"
          },
          sourceRefs: [
            { entityType: "project", entityId: "project-alpha-a" },
            { entityType: "kpi_signal", entityId: "signal-kpi-schedule-variance-a" }
          ],
          drilldowns: [
            {
              key: "open_project_gantt",
              href: "/projects/project-alpha-a/gantt",
              available: true
            }
          ],
          actions: [
            {
              key: "create_corrective_action",
              actionDefinitionKey: "corrective_task.create",
              available: true,
              dryRunRequired: false
            },
            {
              key: "accept_risk",
              actionDefinitionKey: "risk.accept",
              available: false,
              unavailableReason: "permission_denied"
            }
          ]
        }
      ],
      widgets: [
        {
          key: "critical_signal_count",
          value: 1,
          severity: "critical"
        }
      ],
      pagination: { offset: 0, limit: 20, total: 1 }
    });
  });

  it("hides executable mutation paths for read-only users while preserving allowed read rows", () => {
    const model = createControlSurfaceReadModel({
      definition,
      records,
      actorPermissionKeys: ["control.surface:read"],
      page: { offset: 0, limit: 20 }
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]!.actions).toEqual([
      expect.objectContaining({ key: "create_corrective_action", available: false, unavailableReason: "permission_denied" }),
      expect.objectContaining({ key: "accept_risk", available: false, unavailableReason: "permission_denied" })
    ]);
    expect(JSON.stringify(model.rows[0]!.actions)).not.toContain("/execute");
  });

  it("uses precomputed backend policy decisions instead of permission keys alone when provided", () => {
    const model = createControlSurfaceReadModel({
      definition,
      records,
      actorPermissionKeys: ["control.surface:read", "control.action:write", "risk:accept", "schedule:read"],
      page: { offset: 0, limit: 20 },
      isActionAllowed: (_record, slot) => slot.requiredPermission !== "risk:accept",
      isDrilldownAllowed: () => false
    });

    expect(model.rows[0]!.actions).toEqual([
      expect.objectContaining({ key: "create_corrective_action", available: true }),
      expect.objectContaining({ key: "accept_risk", available: false, unavailableReason: "permission_denied" })
    ]);
    expect(model.rows[0]!.drilldowns).toEqual([
      expect.objectContaining({ key: "open_project_gantt", available: false, unavailableReason: "permission_denied" })
    ]);
  });

  it("rejects cross-tenant records without leaking source data", () => {
    expect(() =>
      createControlSurfaceReadModel({
        definition,
        records: [{ ...records[0]!, tenantId: "tenant-b", label: "Private B" }],
        actorPermissionKeys: ["control.surface:read"],
        page: { offset: 0, limit: 20 }
      })
    ).toThrow("controlSurface.record tenant mismatch");
  });

  it("rejects malformed pagination before returning partial DTOs", () => {
    expect(() =>
      createControlSurfaceReadModel({
        definition,
        records,
        actorPermissionKeys: ["control.surface:read"],
        page: { offset: Number.NaN, limit: 20 }
      })
    ).toThrow("controlSurface.page.offset must be a non-negative integer");

    expect(() =>
      createControlSurfaceReadModel({
        definition,
        records,
        actorPermissionKeys: ["control.surface:read"],
        page: { offset: 0, limit: 0 }
      })
    ).toThrow("controlSurface.page.limit must be a positive integer");
  });
});
