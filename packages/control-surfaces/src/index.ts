import type { TenantId, TenantOwned } from "@kiss-pm/domain-core";

export const packageName = "@kiss-pm/control-surfaces";

export type ControlSurfaceStatus = "draft" | "active" | "archived";
export type ControlSurfaceType = "portfolio" | "kpi_deviation" | "resource_load" | "crm_intake" | "my_work";
export type ControlSurfaceDataSourceType = "project" | "kpi" | "resource" | "crm" | "task" | "schedule" | "composite";
export type ControlSurfaceEntityType =
  | "opportunity"
  | "project"
  | "project_stage"
  | "task"
  | "resource"
  | "resource_overload"
  | "kpi_signal"
  | "control_signal"
  | "action_execution";
export type ControlSurfaceViewType = "table" | "board" | "calendar" | "timeline" | "gantt" | "heatmap" | "cards" | "hybrid";
export type ControlSurfaceFieldValueType = "text" | "number" | "date" | "boolean" | "severity" | "status" | "link";
export type ControlSurfaceWidgetType = "metric" | "severity_summary" | "trend" | "action_summary";
export type ControlSurfaceSeverity = "none" | "attention" | "warning" | "critical";
export type ControlSurfaceActionSlotType = "primary" | "row" | "bulk" | "global";

export type ControlSurfaceDataSource = {
  type: ControlSurfaceDataSourceType;
  key: string;
  entityTypes: readonly ControlSurfaceEntityType[];
  traceKeys: readonly string[];
};

export type ControlSurfaceFieldDefinition = {
  id: string;
  key: string;
  label: string;
  entityType: ControlSurfaceEntityType;
  valueType: ControlSurfaceFieldValueType;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
};

export type ControlSurfaceWidgetDefinition = {
  id: string;
  key: string;
  label: string;
  widgetType: ControlSurfaceWidgetType;
  sourceFieldKey: string;
  severity?: Exclude<ControlSurfaceSeverity, "none">;
};

export type ControlSurfaceActionSlot = {
  id: string;
  key: string;
  label: string;
  actionDefinitionKey: string;
  slotType: ControlSurfaceActionSlotType;
  targetEntityType: ControlSurfaceEntityType;
  requiredPermission: string;
  dryRunRequired: boolean;
};

export type ControlSurfaceDrilldownTarget = {
  id: string;
  key: string;
  label: string;
  targetSurfaceKey: string;
  targetEntityType: ControlSurfaceEntityType;
  routeTemplate: string;
  requiredPermission: string;
};

export type ControlSurfaceSavedView = {
  id: string;
  key: string;
  label: string;
  ownerType: "tenant" | "user";
  filterKeys: readonly string[];
  sortKeys: readonly string[];
};

export type ControlSurfacePermissionRequirements = {
  read: string;
  actions: readonly string[];
  audit?: string;
};

export type ControlSurfaceView = TenantOwned & {
  id: string;
  surfaceDefinitionId: string;
  key: string;
  label: string;
  viewType: ControlSurfaceViewType;
  version: number;
  fields: readonly ControlSurfaceFieldDefinition[];
  widgets: readonly ControlSurfaceWidgetDefinition[];
  actionSlots: readonly ControlSurfaceActionSlot[];
  drilldowns: readonly ControlSurfaceDrilldownTarget[];
  savedViews: readonly ControlSurfaceSavedView[];
  permissionRequirements: ControlSurfacePermissionRequirements;
};

export type ControlSurfaceDefinition = TenantOwned & {
  id: string;
  key: string;
  label: string;
  version: number;
  status: ControlSurfaceStatus;
  surfaceType: ControlSurfaceType;
  dataSource: ControlSurfaceDataSource;
  view: ControlSurfaceView;
  updatedAt: string;
};

export type ControlSurfaceSourceRef = {
  entityType: ControlSurfaceEntityType;
  entityId: string;
};

export type ControlSurfaceSourceRecord = TenantOwned & {
  id: string;
  entityType: ControlSurfaceEntityType;
  entityId: string;
  label: string;
  severity: ControlSurfaceSeverity;
  explanation: string;
  sourceRefs: readonly ControlSurfaceSourceRef[];
  fieldValues: Readonly<Record<string, string | number | boolean | null>>;
  recommendedActionKeys: readonly string[];
  drilldownParams: Readonly<Record<string, string>>;
  policyContext?: {
    ownerId?: string;
    projectId?: string;
  };
};

export type ControlSurfaceReadAction = {
  key: string;
  label: string;
  actionDefinitionKey: string;
  slotType: ControlSurfaceActionSlotType;
  targetEntityType: ControlSurfaceEntityType;
  dryRunRequired: boolean;
  available: boolean;
  unavailableReason?: "not_recommended" | "permission_denied";
};

export type ControlSurfaceReadDrilldown = {
  key: string;
  label: string;
  targetSurfaceKey: string;
  targetEntityType: ControlSurfaceEntityType;
  href?: string;
  available: boolean;
  unavailableReason?: "missing_param" | "permission_denied";
};

export type ControlSurfaceReadRow = {
  id: string;
  entityType: ControlSurfaceEntityType;
  entityId: string;
  label: string;
  severity: ControlSurfaceSeverity;
  explanation: string;
  fieldValues: Readonly<Record<string, string | number | boolean | null>>;
  sourceRefs: readonly ControlSurfaceSourceRef[];
  drilldowns: readonly ControlSurfaceReadDrilldown[];
  actions: readonly ControlSurfaceReadAction[];
};

export type ControlSurfaceReadWidget = {
  key: string;
  label: string;
  widgetType: ControlSurfaceWidgetType;
  value: number;
  severity?: Exclude<ControlSurfaceSeverity, "none">;
};

export type ControlSurfaceReadModel = {
  surface: {
    id: string;
    tenantId: TenantId;
    key: string;
    label: string;
    viewType: ControlSurfaceViewType;
    version: number;
    updatedAt: string;
  };
  fields: readonly ControlSurfaceFieldDefinition[];
  widgets: readonly ControlSurfaceReadWidget[];
  rows: readonly ControlSurfaceReadRow[];
  pagination: { offset: number; limit: number; total: number };
};

export type ControlSurfaceReadModelInput = {
  definition: ControlSurfaceDefinition;
  records: readonly ControlSurfaceSourceRecord[];
  actorPermissionKeys: readonly string[];
  page: { offset: number; limit: number };
  isActionAllowed?: (record: ControlSurfaceSourceRecord, slot: ControlSurfaceActionSlot) => boolean;
  isDrilldownAllowed?: (record: ControlSurfaceSourceRecord, drilldown: ControlSurfaceDrilldownTarget) => boolean;
};

export class ControlSurfaceModelError extends Error {
  constructor(
    readonly code: "validation_error" | "conflict" | "tenant_mismatch",
    message: string
  ) {
    super(`${code}: ${message}`);
    this.name = "ControlSurfaceModelError";
  }
}

const surfaceTypes = new Set<ControlSurfaceType>(["portfolio", "kpi_deviation", "resource_load", "crm_intake", "my_work"]);
const dataSourceTypes = new Set<ControlSurfaceDataSourceType>([
  "project",
  "kpi",
  "resource",
  "crm",
  "task",
  "schedule",
  "composite"
]);
const entityTypes = new Set<ControlSurfaceEntityType>([
  "opportunity",
  "project",
  "project_stage",
  "task",
  "resource",
  "resource_overload",
  "kpi_signal",
  "control_signal",
  "action_execution"
]);
const viewTypes = new Set<ControlSurfaceViewType>([
  "table",
  "board",
  "calendar",
  "timeline",
  "gantt",
  "heatmap",
  "cards",
  "hybrid"
]);
const fieldValueTypes = new Set<ControlSurfaceFieldValueType>([
  "text",
  "number",
  "date",
  "boolean",
  "severity",
  "status",
  "link"
]);
const widgetTypes = new Set<ControlSurfaceWidgetType>(["metric", "severity_summary", "trend", "action_summary"]);
const actionSlotTypes = new Set<ControlSurfaceActionSlotType>(["primary", "row", "bulk", "global"]);
const statuses = new Set<ControlSurfaceStatus>(["draft", "active", "archived"]);
const readModelSeverities = new Set<ControlSurfaceSeverity>(["none", "attention", "warning", "critical"]);
const severities = new Set<Exclude<ControlSurfaceSeverity, "none">>(["attention", "warning", "critical"]);
const savedViewOwnerTypes = new Set<ControlSurfaceSavedView["ownerType"]>(["tenant", "user"]);

function requireAllowed<T extends string>(value: T | undefined, allowed: ReadonlySet<T>, fieldName: string): T {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new ControlSurfaceModelError("validation_error", `${fieldName} is invalid`);
  }

  return value;
}

function requireObject<T>(value: T | undefined, fieldName: string): T {
  if (value === undefined || value === null || typeof value !== "object") {
    throw new ControlSurfaceModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ControlSurfaceModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ControlSurfaceModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireNonNegativeInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ControlSurfaceModelError("validation_error", `${fieldName} must be a non-negative integer`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new ControlSurfaceModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireArray<T>(value: readonly T[] | undefined, fieldName: string): readonly T[] {
  if (!Array.isArray(value)) {
    throw new ControlSurfaceModelError("validation_error", `${fieldName} must be an array`);
  }

  return value;
}

function requireNonEmptyArray<T>(value: readonly T[] | undefined, fieldName: string): readonly T[] {
  const items = requireArray(value, fieldName);
  if (items.length === 0) {
    throw new ControlSurfaceModelError("validation_error", `${fieldName} must not be empty`);
  }

  return items;
}

function ensureUniqueByKey<T>(items: readonly T[], getKey: (item: T) => string, duplicateMessage: (key: string) => string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      throw new ControlSurfaceModelError("conflict", duplicateMessage(key));
    }
    seen.add(key);
  }
}

function assertTenantId(expectedTenantId: TenantId, actualTenantId: TenantId, message: string): void {
  if (expectedTenantId !== actualTenantId) {
    throw new ControlSurfaceModelError("tenant_mismatch", message);
  }
}

function clonePlain<T>(value: T): T {
  return structuredClone(value) as T;
}

function interpolateRoute(template: string, params: Readonly<Record<string, string>>): string | undefined {
  let missing = false;
  const href = template.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
    const value = params[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      missing = true;
      return "";
    }

    return encodeURIComponent(value);
  });

  return missing ? undefined : href;
}

function createDataSource(input: ControlSurfaceDataSource): ControlSurfaceDataSource {
  return {
    type: requireAllowed(input.type, dataSourceTypes, "controlSurface.dataSource.type"),
    key: requireNonEmptyString(input.key, "controlSurface.dataSource.key"),
    entityTypes: [
      ...requireNonEmptyArray(input.entityTypes, "controlSurface.dataSource.entityTypes").map((entityType) =>
        requireAllowed(entityType, entityTypes, "controlSurface.dataSource.entityType")
      )
    ],
    traceKeys: [...requireNonEmptyArray(input.traceKeys, "controlSurface.dataSource.traceKeys")]
  };
}

function createField(input: ControlSurfaceFieldDefinition): ControlSurfaceFieldDefinition {
  return {
    id: requireNonEmptyString(input.id, "field.id"),
    key: requireNonEmptyString(input.key, "field.key"),
    label: requireNonEmptyString(input.label, "field.label"),
    entityType: requireAllowed(input.entityType, entityTypes, "field.entityType"),
    valueType: requireAllowed(input.valueType, fieldValueTypes, "field.valueType"),
    visible: input.visible === true,
    sortable: input.sortable === true,
    filterable: input.filterable === true
  };
}

function createWidget(input: ControlSurfaceWidgetDefinition): ControlSurfaceWidgetDefinition {
  return {
    id: requireNonEmptyString(input.id, "widget.id"),
    key: requireNonEmptyString(input.key, "widget.key"),
    label: requireNonEmptyString(input.label, "widget.label"),
    widgetType: requireAllowed(input.widgetType, widgetTypes, "widget.widgetType"),
    sourceFieldKey: requireNonEmptyString(input.sourceFieldKey, "widget.sourceFieldKey"),
    ...(input.severity !== undefined ? { severity: requireAllowed(input.severity, severities, "widget.severity") } : {})
  };
}

function createActionSlot(input: ControlSurfaceActionSlot): ControlSurfaceActionSlot {
  return {
    id: requireNonEmptyString(input.id, "actionSlot.id"),
    key: requireNonEmptyString(input.key, "actionSlot.key"),
    label: requireNonEmptyString(input.label, "actionSlot.label"),
    actionDefinitionKey: requireNonEmptyString(input.actionDefinitionKey, "actionSlot.actionDefinitionKey"),
    slotType: requireAllowed(input.slotType, actionSlotTypes, "actionSlot.slotType"),
    targetEntityType: requireAllowed(input.targetEntityType, entityTypes, "actionSlot.targetEntityType"),
    requiredPermission: requireNonEmptyString(input.requiredPermission, "actionSlot.requiredPermission"),
    dryRunRequired: input.dryRunRequired === true
  };
}

function createDrilldown(input: ControlSurfaceDrilldownTarget): ControlSurfaceDrilldownTarget {
  return {
    id: requireNonEmptyString(input.id, "drilldown.id"),
    key: requireNonEmptyString(input.key, "drilldown.key"),
    label: requireNonEmptyString(input.label, "drilldown.label"),
    targetSurfaceKey: requireNonEmptyString(input.targetSurfaceKey, "drilldown.targetSurfaceKey"),
    targetEntityType: requireAllowed(input.targetEntityType, entityTypes, "drilldown.targetEntityType"),
    routeTemplate: requireNonEmptyString(input.routeTemplate, "drilldown.routeTemplate"),
    requiredPermission: requireNonEmptyString(input.requiredPermission, "drilldown.requiredPermission")
  };
}

function createSavedView(input: ControlSurfaceSavedView): ControlSurfaceSavedView {
  return {
    id: requireNonEmptyString(input.id, "savedView.id"),
    key: requireNonEmptyString(input.key, "savedView.key"),
    label: requireNonEmptyString(input.label, "savedView.label"),
    ownerType: requireAllowed(input.ownerType, savedViewOwnerTypes, "savedView.ownerType"),
    filterKeys: [...requireArray(input.filterKeys, "savedView.filterKeys")],
    sortKeys: [...requireArray(input.sortKeys, "savedView.sortKeys")]
  };
}

function createPermissionRequirements(input: ControlSurfacePermissionRequirements): ControlSurfacePermissionRequirements {
  return {
    read: requireNonEmptyString(input.read, "permissionRequirements.read"),
    actions: [...requireArray(input.actions, "permissionRequirements.actions").map((permission) =>
      requireNonEmptyString(permission, "permissionRequirements.actions")
    )],
    ...(input.audit !== undefined ? { audit: requireNonEmptyString(input.audit, "permissionRequirements.audit") } : {})
  };
}

function assertKnownFieldKeys(fieldKeys: ReadonlySet<string>, referencedKeys: readonly string[], fieldName: string): void {
  for (const key of referencedKeys) {
    if (!fieldKeys.has(key)) {
      throw new ControlSurfaceModelError("validation_error", `${fieldName} must reference a field key: ${key}`);
    }
  }
}

export function createControlSurfaceView(input: ControlSurfaceView): ControlSurfaceView {
  const viewInput = requireObject(input, "controlSurface.view");
  const tenantId = requireNonEmptyString(viewInput.tenantId, "tenantId");
  const fields = requireNonEmptyArray(viewInput.fields, "controlSurface.view.fields").map(createField);
  const widgets = requireArray(viewInput.widgets, "controlSurface.view.widgets").map(createWidget);
  const actionSlots = requireArray(viewInput.actionSlots, "controlSurface.view.actionSlots").map(createActionSlot);
  const drilldowns = requireArray(viewInput.drilldowns, "controlSurface.view.drilldowns").map(createDrilldown);
  const savedViews = requireArray(viewInput.savedViews, "controlSurface.view.savedViews").map(createSavedView);

  ensureUniqueByKey(fields, (field) => field.key, (key) => `Duplicate control surface field key: ${key}`);
  ensureUniqueByKey(widgets, (widget) => widget.key, (key) => `Duplicate control surface widget key: ${key}`);
  ensureUniqueByKey(actionSlots, (slot) => slot.key, (key) => `Duplicate control surface action slot key: ${key}`);
  ensureUniqueByKey(drilldowns, (drilldown) => drilldown.key, (key) => `Duplicate control surface drilldown key: ${key}`);
  ensureUniqueByKey(savedViews, (savedView) => savedView.key, (key) => `Duplicate control surface saved view key: ${key}`);

  const fieldKeys = new Set(fields.map((field) => field.key));
  for (const widget of widgets) {
    assertKnownFieldKeys(fieldKeys, [widget.sourceFieldKey], "widget.sourceFieldKey");
  }
  for (const savedView of savedViews) {
    assertKnownFieldKeys(fieldKeys, savedView.filterKeys, "savedView.filterKeys");
    assertKnownFieldKeys(fieldKeys, savedView.sortKeys, "savedView.sortKeys");
  }

  return {
    id: requireNonEmptyString(viewInput.id, "controlSurface.view.id"),
    tenantId,
    surfaceDefinitionId: requireNonEmptyString(viewInput.surfaceDefinitionId, "controlSurface.view.surfaceDefinitionId"),
    key: requireNonEmptyString(viewInput.key, "controlSurface.view.key"),
    label: requireNonEmptyString(viewInput.label, "controlSurface.view.label"),
    viewType: requireAllowed(viewInput.viewType, viewTypes, "controlSurface.view.viewType"),
    version: requirePositiveInteger(viewInput.version, "controlSurface.view.version"),
    fields,
    widgets,
    actionSlots,
    drilldowns,
    savedViews,
    permissionRequirements: createPermissionRequirements(requireObject(viewInput.permissionRequirements, "permissionRequirements"))
  };
}

export function createControlSurfaceDefinition(input: ControlSurfaceDefinition): ControlSurfaceDefinition {
  const definitionInput = requireObject(input, "controlSurface");
  const tenantId = requireNonEmptyString(definitionInput.tenantId, "tenantId");
  const id = requireNonEmptyString(definitionInput.id, "controlSurface.id");
  const view = createControlSurfaceView(definitionInput.view);

  assertTenantId(tenantId, view.tenantId, "controlSurface.view tenant mismatch");
  if (view.surfaceDefinitionId !== id) {
    throw new ControlSurfaceModelError("validation_error", "controlSurface.view.surfaceDefinitionId must match definition id");
  }

  return {
    id,
    tenantId,
    key: requireNonEmptyString(definitionInput.key, "controlSurface.key"),
    label: requireNonEmptyString(definitionInput.label, "controlSurface.label"),
    version: requirePositiveInteger(definitionInput.version, "controlSurface.version"),
    status: requireAllowed(definitionInput.status, statuses, "controlSurface.status"),
    surfaceType: requireAllowed(definitionInput.surfaceType, surfaceTypes, "controlSurface.surfaceType"),
    dataSource: createDataSource(requireObject(definitionInput.dataSource, "controlSurface.dataSource")),
    view,
    updatedAt: requireValidTimestamp(definitionInput.updatedAt, "controlSurface.updatedAt")
  };
}

export function validateControlSurfaceDefinition(input: ControlSurfaceDefinition): string[] {
  try {
    createControlSurfaceDefinition(input);
    return [];
  } catch (error) {
    if (error instanceof ControlSurfaceModelError) {
      return [error.message];
    }
    throw error;
  }
}

export function createControlSurfaceReadModel(input: ControlSurfaceReadModelInput): ControlSurfaceReadModel {
  const definition = createControlSurfaceDefinition(input.definition);
  const actorPermissionKeys = new Set(input.actorPermissionKeys);
  const offset = requireNonNegativeInteger(input.page.offset, "controlSurface.page.offset");
  const limit = requirePositiveInteger(input.page.limit, "controlSurface.page.limit");
  const visibleFields = definition.view.fields.filter((field) => field.visible);
  const visibleFieldKeys = new Set(visibleFields.map((field) => field.key));

  if (!actorPermissionKeys.has(definition.view.permissionRequirements.read)) {
    throw new ControlSurfaceModelError("validation_error", "controlSurface.read permission is required");
  }

  for (const record of input.records) {
    assertTenantId(definition.tenantId, record.tenantId, "controlSurface.record tenant mismatch");
    requireAllowed(record.entityType, entityTypes, "controlSurface.record.entityType");
    requireAllowed(record.severity, readModelSeverities, "controlSurface.record.severity");
    requireNonEmptyString(record.id, "controlSurface.record.id");
    requireNonEmptyString(record.entityId, "controlSurface.record.entityId");
    requireNonEmptyString(record.label, "controlSurface.record.label");
  }

  const pagedRecords = input.records.slice(offset, offset + limit);
  const rows = pagedRecords.map((record): ControlSurfaceReadRow => {
    const fieldValues = Object.fromEntries(
      Object.entries(record.fieldValues).filter(([key]) => visibleFieldKeys.has(key))
    ) as Record<string, string | number | boolean | null>;
    return {
      id: record.id,
      entityType: record.entityType,
      entityId: record.entityId,
      label: record.label,
      severity: record.severity,
      explanation: record.explanation,
      fieldValues,
      sourceRefs: clonePlain(record.sourceRefs),
      drilldowns: definition.view.drilldowns.map((drilldown): ControlSurfaceReadDrilldown => {
        const drilldownAllowed =
          input.isDrilldownAllowed?.(record, drilldown) ?? actorPermissionKeys.has(drilldown.requiredPermission);
        if (!drilldownAllowed) {
          return {
            key: drilldown.key,
            label: drilldown.label,
            targetSurfaceKey: drilldown.targetSurfaceKey,
            targetEntityType: drilldown.targetEntityType,
            available: false,
            unavailableReason: "permission_denied"
          };
        }
        const href = interpolateRoute(drilldown.routeTemplate, record.drilldownParams);
        if (href === undefined) {
          return {
            key: drilldown.key,
            label: drilldown.label,
            targetSurfaceKey: drilldown.targetSurfaceKey,
            targetEntityType: drilldown.targetEntityType,
            available: false,
            unavailableReason: "missing_param"
          };
        }

        return {
          key: drilldown.key,
          label: drilldown.label,
          targetSurfaceKey: drilldown.targetSurfaceKey,
          targetEntityType: drilldown.targetEntityType,
          href,
          available: true
        };
      }),
      actions: definition.view.actionSlots.map((slot): ControlSurfaceReadAction => {
        const isRecommended = record.recommendedActionKeys.includes(slot.actionDefinitionKey);
        const hasPermission = input.isActionAllowed?.(record, slot) ?? actorPermissionKeys.has(slot.requiredPermission);

        return {
          key: slot.key,
          label: slot.label,
          actionDefinitionKey: slot.actionDefinitionKey,
          slotType: slot.slotType,
          targetEntityType: slot.targetEntityType,
          dryRunRequired: slot.dryRunRequired,
          available: isRecommended && hasPermission,
          ...(!isRecommended
            ? { unavailableReason: "not_recommended" as const }
            : !hasPermission
              ? { unavailableReason: "permission_denied" as const }
              : {})
        };
      })
    };
  });

  const widgets = definition.view.widgets.map((widget): ControlSurfaceReadWidget => {
    const value =
      widget.widgetType === "severity_summary" && widget.severity !== undefined
        ? input.records.filter((record) => record.fieldValues[widget.sourceFieldKey] === widget.severity).length
        : input.records.filter((record) => record.fieldValues[widget.sourceFieldKey] !== undefined).length;

    return {
      key: widget.key,
      label: widget.label,
      widgetType: widget.widgetType,
      value,
      ...(widget.severity !== undefined ? { severity: widget.severity } : {})
    };
  });

  return {
    surface: {
      id: definition.id,
      tenantId: definition.tenantId,
      key: definition.key,
      label: definition.label,
      viewType: definition.view.viewType,
      version: definition.version,
      updatedAt: definition.updatedAt
    },
    fields: visibleFields,
    widgets,
    rows,
    pagination: { offset, limit, total: input.records.length }
  };
}
