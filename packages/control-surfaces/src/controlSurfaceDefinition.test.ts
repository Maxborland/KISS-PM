import { describe, expect, it } from "vitest";

import {
  ControlSurfaceModelError,
  createControlSurfaceDefinition,
  createControlSurfaceView,
  validateControlSurfaceDefinition
} from "./index";

const tenantId = "tenant-a";

const portfolioDefinitionInput = {
  id: "surface-portfolio",
  tenantId,
  key: "portfolio.control",
  label: "Контроль портфеля",
  version: 1,
  status: "active" as const,
  surfaceType: "portfolio" as const,
  dataSource: {
    type: "composite" as const,
    key: "portfolio_operational_signals",
    entityTypes: ["project", "kpi_signal", "resource_overload"] as const,
    traceKeys: ["project.id", "kpiSignal.id", "resourceOverload.id"] as const
  },
  view: {
    id: "view-portfolio-default",
    tenantId,
    surfaceDefinitionId: "surface-portfolio",
    key: "default",
    label: "Основной вид",
    viewType: "hybrid" as const,
    version: 1,
    fields: [
      {
        id: "field-project",
        key: "project_label",
        label: "Проект",
        entityType: "project" as const,
        valueType: "text" as const,
        visible: true,
        sortable: true,
        filterable: true
      },
      {
        id: "field-severity",
        key: "severity",
        label: "Риск",
        entityType: "control_signal" as const,
        valueType: "severity" as const,
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
        widgetType: "metric" as const,
        sourceFieldKey: "severity",
        severity: "critical" as const
      }
    ],
    actionSlots: [
      {
        id: "slot-primary",
        key: "primary_corrective_action",
        label: "Создать корректирующую задачу",
        actionDefinitionKey: "corrective_task.create",
        slotType: "primary" as const,
        targetEntityType: "kpi_signal" as const,
        requiredPermission: "control.action:write",
        dryRunRequired: false
      },
      {
        id: "slot-risk",
        key: "accept_risk",
        label: "Принять риск",
        actionDefinitionKey: "risk.accept",
        slotType: "row" as const,
        targetEntityType: "control_signal" as const,
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
        targetEntityType: "project" as const,
        routeTemplate: "/projects/:projectId/gantt",
        requiredPermission: "schedule:read"
      }
    ],
    savedViews: [
      {
        id: "saved-critical",
        key: "critical_only",
        label: "Только критичные",
        ownerType: "tenant" as const,
        filterKeys: ["severity"],
        sortKeys: ["project_label"]
      }
    ],
    permissionRequirements: {
      read: "control.surface:read",
      actions: ["control.action:write", "risk:accept"],
      audit: "audit.read"
    }
  },
  updatedAt: "2026-05-16T13:45:00.000Z"
};

describe("control surface definition foundation", () => {
  it("creates a tenant-owned versioned definition with detached view, actions, drilldowns, widgets, saved views, and permission requirements", () => {
    const definition = createControlSurfaceDefinition(portfolioDefinitionInput);

    expect(definition).toMatchObject({
      id: "surface-portfolio",
      tenantId,
      key: "portfolio.control",
      version: 1,
      surfaceType: "portfolio",
      view: {
        tenantId,
        surfaceDefinitionId: "surface-portfolio",
        permissionRequirements: {
          read: "control.surface:read",
          actions: ["control.action:write", "risk:accept"],
          audit: "audit.read"
        }
      }
    });
    expect(definition.view.fields.map((field) => field.key)).toEqual(["project_label", "severity"]);
    expect(definition.view.actionSlots.map((slot) => slot.actionDefinitionKey)).toEqual([
      "corrective_task.create",
      "risk.accept"
    ]);

    portfolioDefinitionInput.view.fields[0]!.label = "Mutated";
    expect(definition.view.fields[0]!.label).toBe("Проект");
  });

  it("validates data sources, duplicate fields/actions, action slot permissions, and cross-tenant nested views", () => {
    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        dataSource: { ...portfolioDefinitionInput.dataSource, entityTypes: [] }
      })
    ).toThrow("controlSurface.dataSource.entityTypes must not be empty");

    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          fields: [
            portfolioDefinitionInput.view.fields[0]!,
            { ...portfolioDefinitionInput.view.fields[1]!, key: "project_label" }
          ]
        }
      })
    ).toThrow("Duplicate control surface field key: project_label");

    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          actionSlots: [
            portfolioDefinitionInput.view.actionSlots[0]!,
            { ...portfolioDefinitionInput.view.actionSlots[1]!, key: "primary_corrective_action" }
          ]
        }
      })
    ).toThrow("Duplicate control surface action slot key: primary_corrective_action");

    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          tenantId: "tenant-b"
        }
      })
    ).toThrow("controlSurface.view tenant mismatch");

    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          actionSlots: [
            {
              ...portfolioDefinitionInput.view.actionSlots[0]!,
              requiredPermission: ""
            }
          ]
        }
      })
    ).toThrow("actionSlot.requiredPermission is required");
  });

  it("describes the required operational surfaces without tenant-specific branches", () => {
    const surfaceTypes = [
      "portfolio",
      "kpi_deviation",
      "resource_load",
      "crm_intake",
      "my_work"
    ] as const;

    const definitions = surfaceTypes.map((surfaceType, index) =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        id: `surface-${surfaceType}`,
        key: `${surfaceType}.control`,
        label: `${surfaceType} surface`,
        surfaceType,
        version: index + 1,
        view: {
          ...portfolioDefinitionInput.view,
          id: `view-${surfaceType}`,
          surfaceDefinitionId: `surface-${surfaceType}`,
          key: `${surfaceType}.default`
        }
      })
    );

    expect(definitions.map((definition) => definition.surfaceType)).toEqual(surfaceTypes);
    expect(definitions.every((definition) => definition.tenantId === tenantId)).toBe(true);
    expect(definitions.every((definition) => !definition.key.includes("bitrix"))).toBe(true);
  });

  it("creates a standalone view model only when it is tenant-owned, versioned, and actionable", () => {
    const view = createControlSurfaceView(portfolioDefinitionInput.view);

    expect(view.version).toBe(1);
    expect(view.fields).toHaveLength(2);
    expect(view.actionSlots[0]).toMatchObject({
      slotType: "primary",
      requiredPermission: "control.action:write",
      dryRunRequired: false
    });
    expect(validateControlSurfaceDefinition(createControlSurfaceDefinition(portfolioDefinitionInput))).toEqual([]);
  });

  it("throws typed model errors for invalid definitions", () => {
    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        version: 0
      })
    ).toThrow(ControlSurfaceModelError);
  });

  it("rejects runtime-invalid enum values from untrusted DTOs", () => {
    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        surfaceType: "bitrix_report" as never
      })
    ).toThrow("controlSurface.surfaceType is invalid");

    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          viewType: "spreadsheet" as never
        }
      })
    ).toThrow("controlSurface.view.viewType is invalid");

    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          actionSlots: [
            {
              ...portfolioDefinitionInput.view.actionSlots[0]!,
              slotType: "script" as never
            }
          ]
        }
      })
    ).toThrow("actionSlot.slotType is invalid");
  });

  it("rejects malformed arrays and view references with typed errors", () => {
    expect(
      validateControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: undefined as never
      })
    ).toEqual(["validation_error: controlSurface.view is required"]);

    expect(
      validateControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        dataSource: undefined as never
      })
    ).toEqual(["validation_error: controlSurface.dataSource is required"]);

    expect(
      validateControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          permissionRequirements: undefined as never
        }
      })
    ).toEqual(["validation_error: permissionRequirements is required"]);

    expect(() =>
      createControlSurfaceView({
        ...portfolioDefinitionInput.view,
        fields: undefined as never
      })
    ).toThrow("controlSurface.view.fields must be an array");

    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          widgets: [
            {
              ...portfolioDefinitionInput.view.widgets[0]!,
              sourceFieldKey: "missing_field"
            }
          ]
        }
      })
    ).toThrow("widget.sourceFieldKey must reference a field key: missing_field");

    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          savedViews: [
            {
              ...portfolioDefinitionInput.view.savedViews[0]!,
              filterKeys: ["missing_field"]
            }
          ]
        }
      })
    ).toThrow("savedView.filterKeys must reference a field key: missing_field");
  });

  it("rejects runtime-invalid nested enum values", () => {
    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          widgets: [
            {
              ...portfolioDefinitionInput.view.widgets[0]!,
              severity: "urgent" as never
            }
          ]
        }
      })
    ).toThrow("widget.severity is invalid");

    expect(() =>
      createControlSurfaceDefinition({
        ...portfolioDefinitionInput,
        view: {
          ...portfolioDefinitionInput.view,
          savedViews: [
            {
              ...portfolioDefinitionInput.view.savedViews[0]!,
              ownerType: "workspace" as never
            }
          ]
        }
      })
    ).toThrow("savedView.ownerType is invalid");
  });
});
