export type ControlSurfaceStatus = "draft" | "published" | "archived";

export type ControlSurfaceDataSourceKey =
  | "crm_intake"
  | "portfolio_projects"
  | "project_delivery"
  | "resource_load"
  | "kpi_deviation"
  | "my_work"
  | "closed_projects"
  | "tenant_admin_config";

export type ControlSurfaceEntityType =
  | "opportunity"
  | "project"
  | "task"
  | "resource"
  | "control_signal"
  | "corrective_action"
  | "user"
  | "tenant_config";

export type ControlSurfaceViewType =
  | "table"
  | "board"
  | "timeline"
  | "gantt"
  | "heatmap"
  | "calendar"
  | "cards"
  | "dashboard"
  | "hybrid";

export type ControlSurfaceActionKey =
  | "open_entity"
  | "open_gantt"
  | "create_task"
  | "create_corrective_action"
  | "generate_planning_solution"
  | "apply_planning_scenario"
  | "reserve_capacity"
  | "reassign_resource"
  | "shift_task_dates"
  | "split_work"
  | "request_explanation"
  | "escalate"
  | "apply_planning_delta"
  | "accept_risk"
  | "move_deadline"
  | "change_lifecycle_stage"
  | "update_kpi_target";

export type ControlSurfaceActionScope = "row" | "card" | "bulk" | "global";

export type ControlSurfaceFieldDefinition = {
  id: string;
  label: string;
  sourceField: string;
  visible: boolean;
  width?: number;
};

export type ControlSurfaceFilterDefinition = {
  id: string;
  label: string;
  sourceField: string;
  operator: "eq" | "neq" | "contains" | "in" | "gte" | "lte";
  value: string | number | boolean | string[] | null;
};

export type ControlSurfaceGroupingDefinition = {
  id: string;
  label: string;
  sourceField: string;
};

export type ControlSurfaceWidgetDefinition = {
  id: string;
  label: string;
  metricKey: string;
  visualization: "kpi_card" | "counter" | "trend" | "heat";
};

export type ControlSurfaceSeverityRule = {
  id: string;
  label: string;
  sourceField: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;
  severity: "warning" | "critical";
};

export type ControlSurfaceDrilldownDefinition = {
  id: string;
  label: string;
  targetSurfaceCode?: string;
  targetEntityType?: ControlSurfaceEntityType;
};

export type ControlSurfaceActionBinding = {
  id: string;
  label: string;
  actionKey: ControlSurfaceActionKey;
  scope: ControlSurfaceActionScope;
  requiredPermissions: string[];
  inputSchema?: Record<string, unknown>;
};

export type ControlSurfaceDefinition = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  dataSource: ControlSurfaceDataSourceKey;
  entityType: ControlSurfaceEntityType;
  viewType: ControlSurfaceViewType;
  fields: ControlSurfaceFieldDefinition[];
  filters: ControlSurfaceFilterDefinition[];
  groupings: ControlSurfaceGroupingDefinition[];
  widgets: ControlSurfaceWidgetDefinition[];
  severityRules: ControlSurfaceSeverityRule[];
  drilldowns: ControlSurfaceDrilldownDefinition[];
  actions: ControlSurfaceActionBinding[];
  requiredPermissions: string[];
  savedViewPolicy: "none" | "user" | "tenant";
  auditPolicy: "publish_only" | "all_mutations";
};

export type ControlSurfaceValidationSeverity = "error" | "warning";

export type ControlSurfaceValidationIssue = {
  code: string;
  severity: ControlSurfaceValidationSeverity;
  path: string;
  message: string;
};

export type ControlSurfaceValidationResult = {
  issues: ControlSurfaceValidationIssue[];
  canPublish: boolean;
};

export type ControlSurfaceRecord = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  ownerUserId: string | null;
  status: ControlSurfaceStatus;
  currentVersion: number;
  draftVersion: number;
  draftDefinition: ControlSurfaceDefinition;
  publishedDefinition: ControlSurfaceDefinition | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

export type ControlSurfaceVersionRecord = {
  tenantId: string;
  surfaceId: string;
  version: number;
  definition: ControlSurfaceDefinition;
  publishedByUserId: string;
  auditEventId: string | null;
  createdAt: string;
};
