import type { GanttSavedViewPayload, PlanningSavedViewPayload } from "@kiss-pm/domain";

const ganttZooms = new Set<GanttSavedViewPayload["zoom"]>(["hour", "day", "week", "month"]);
const ganttPayloadKeys = new Set([
  "viewKind",
  "zoom",
  "visibleColumns",
  "columnWidths",
  "collapsedTaskIds",
  "selectedTaskIds",
  "scrollPosition",
  "filters",
  "baselineOverlayEnabled",
  "baselineId",
  "scenarioRunId"
]);
const ganttFilterKeys = new Set(["resourceIds", "criticalOnly", "milestonesOnly", "hasValidationIssues"]);

export function parsePlanningSavedViewPayload(value: unknown): PlanningSavedViewPayload | null {
  if (!isRecord(value) || value.viewKind !== "gantt" || !hasOnlyKeys(value, ganttPayloadKeys)) return null;
  if (!isGanttZoom(value.zoom)) return null;
  const visibleColumns = parseStringArray(value.visibleColumns, { requireItems: true });
  const columnWidths = parseColumnWidths(value.columnWidths);
  const collapsedTaskIds = parseStringArray(value.collapsedTaskIds);
  const selectedTaskIds = parseStringArray(value.selectedTaskIds);
  const scrollPosition = parseScrollPosition(value.scrollPosition);
  const filters = parseFilters(value.filters);
  if (!visibleColumns || !columnWidths || !collapsedTaskIds || !selectedTaskIds || !scrollPosition || !filters) return null;
  if (typeof value.baselineOverlayEnabled !== "boolean") return null;

  const payload: GanttSavedViewPayload = {
    viewKind: "gantt",
    zoom: value.zoom,
    visibleColumns,
    columnWidths,
    collapsedTaskIds,
    selectedTaskIds,
    scrollPosition,
    filters,
    baselineOverlayEnabled: value.baselineOverlayEnabled
  };
  if ("baselineId" in value) {
    if (!isNonEmptyString(value.baselineId)) return null;
    payload.baselineId = value.baselineId;
  }
  if ("scenarioRunId" in value) {
    if (!isNonEmptyString(value.scenarioRunId)) return null;
    payload.scenarioRunId = value.scenarioRunId;
  }
  return payload;
}

function parseColumnWidths(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0) return null;
  const columnWidths: Record<string, number> = {};
  for (const [key, width] of entries) {
    if (!key || !isNonNegativeInteger(width)) return null;
    columnWidths[key] = width;
  }
  return columnWidths;
}

function parseScrollPosition(value: unknown): GanttSavedViewPayload["scrollPosition"] | null {
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(["rowIndex", "timelineOffset"]))) return null;
  if (!isNonNegativeInteger(value.rowIndex) || !isNonNegativeInteger(value.timelineOffset)) return null;
  return { rowIndex: value.rowIndex, timelineOffset: value.timelineOffset };
}

function parseFilters(value: unknown): GanttSavedViewPayload["filters"] | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ganttFilterKeys)) return null;
  const filters: GanttSavedViewPayload["filters"] = {};
  if ("resourceIds" in value) {
    const resourceIds = parseStringArray(value.resourceIds);
    if (!resourceIds) return null;
    filters.resourceIds = resourceIds;
  }
  for (const key of ["criticalOnly", "milestonesOnly", "hasValidationIssues"] as const) {
    if (key in value) {
      if (typeof value[key] !== "boolean") return null;
      filters[key] = value[key];
    }
  }
  return filters;
}

function parseStringArray(value: unknown, options: { requireItems?: boolean } = {}): string[] | null {
  if (!Array.isArray(value) || (options.requireItems && value.length === 0)) return null;
  return value.every(isNonEmptyString) ? [...value] : null;
}

function isGanttZoom(value: unknown): value is GanttSavedViewPayload["zoom"] {
  return typeof value === "string" && ganttZooms.has(value as GanttSavedViewPayload["zoom"]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
