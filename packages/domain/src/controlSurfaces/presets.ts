import type { ControlSurfaceDefinition } from "./types";

export function createDefaultControlSurfacePresets(tenantId: string): ControlSurfaceDefinition[] {
  return [
    createPreset({
      tenantId,
      id: "surface-crm-intake",
      code: "crm-intake-control",
      name: "CRM Intake Control",
      dataSource: "crm_intake",
      entityType: "opportunity",
      viewType: "board",
      fields: ["title", "clientName", "stage", "contractValue", "feasibilityStatus"],
      actions: [
        {
          id: "open-opportunity",
          label: "Открыть сделку",
          actionKey: "open_entity",
          scope: "card",
          requiredPermissions: ["tenant.opportunities.read"]
        }
      ]
    }),
    createPreset({
      tenantId,
      id: "surface-kpi-deviation",
      code: "kpi-deviation-control",
      name: "KPI Deviation Control",
      dataSource: "kpi_deviation",
      entityType: "control_signal",
      viewType: "table",
      fields: ["severity", "sourceMetric", "explanation", "status"],
      actions: [
        {
          id: "create-corrective-action",
          label: "Создать корректирующее действие",
          actionKey: "create_corrective_action",
          scope: "row",
          requiredPermissions: ["tenant.corrective_actions.manage"]
        },
        {
          id: "accept-risk",
          label: "Принять риск",
          actionKey: "accept_risk",
          scope: "row",
          requiredPermissions: ["tenant.management_actions.execute", "tenant.control_signals.manage"]
        }
      ]
    }),
    createPreset({
      tenantId,
      id: "surface-resource-load",
      code: "resource-load-control",
      name: "Resource Load Control",
      dataSource: "resource_load",
      entityType: "resource",
      viewType: "heatmap",
      fields: ["name", "position", "capacityMinutes", "workMinutes", "overloadMinutes"],
      actions: [
        {
          id: "generate-planning-solution",
          label: "Предложить план",
          actionKey: "generate_planning_solution",
          scope: "row",
          requiredPermissions: ["tenant.planning_scenarios.preview"]
        }
      ]
    })
  ];
}

function createPreset(input: {
  tenantId: string;
  id: string;
  code: string;
  name: string;
  dataSource: ControlSurfaceDefinition["dataSource"];
  entityType: ControlSurfaceDefinition["entityType"];
  viewType: ControlSurfaceDefinition["viewType"];
  fields: string[];
  actions: ControlSurfaceDefinition["actions"];
}): ControlSurfaceDefinition {
  return {
    id: input.id,
    tenantId: input.tenantId,
    code: input.code,
    name: input.name,
    description: null,
    dataSource: input.dataSource,
    entityType: input.entityType,
    viewType: input.viewType,
    fields: input.fields.map((field) => ({
      id: field,
      label: field,
      sourceField: field,
      visible: true
    })),
    filters: [],
    groupings: [],
    widgets: [],
    severityRules: [],
    drilldowns: [],
    actions: input.actions,
    requiredPermissions: [],
    savedViewPolicy: "user",
    auditPolicy: "publish_only"
  };
}
