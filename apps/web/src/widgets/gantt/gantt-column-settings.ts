import type { GanttColumnConfig, GanttColumnId } from "./types";

export type { GanttColumnConfig, GanttColumnId };

const STORAGE_KEY = "kiss-pm-gantt-column-settings-v1";

export const DEFAULT_GANTT_COLUMNS: GanttColumnConfig[] = [
  { id: "num", width: 32, visible: true, order: 0 },
  { id: "mode", width: 36, visible: true, order: 1 },
  { id: "wbs", width: 84, visible: true, order: 2 },
  { id: "name", width: 272, visible: true, order: 3 },
  { id: "duration", width: 68, visible: true, order: 4 },
  { id: "progress", width: 52, visible: true, order: 5 },
  { id: "start", width: 80, visible: true, order: 6 },
  { id: "finish", width: 80, visible: true, order: 7 },
  { id: "predecessors", width: 96, visible: true, order: 8 },
  { id: "resource", width: 140, visible: true, order: 9 },
  { id: "work", width: 72, visible: true, order: 10 }
];

export function sortColumns(columns: GanttColumnConfig[]): GanttColumnConfig[] {
  return [...columns].sort((a, b) => a.order - b.order).filter((c) => c.visible);
}

export function gridTemplateColumns(columns: GanttColumnConfig[]): string {
  return sortColumns(columns)
    .map((c) => `${c.width}px`)
    .join(" ");
}

export function gridTotalWidth(columns: GanttColumnConfig[]): number {
  return sortColumns(columns).reduce((sum, c) => sum + c.width, 0);
}

export function loadGanttColumnSettings(): GanttColumnConfig[] {
  if (typeof window === "undefined") return DEFAULT_GANTT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GANTT_COLUMNS;
    const parsed = JSON.parse(raw) as GanttColumnConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_GANTT_COLUMNS;
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_GANTT_COLUMNS;
  }
}

function mergeWithDefaults(saved: GanttColumnConfig[]): GanttColumnConfig[] {
  const byId = new Map(saved.map((c) => [c.id, c]));
  return DEFAULT_GANTT_COLUMNS.map((def) => ({ ...def, ...byId.get(def.id) }));
}

export function saveGanttColumnSettings(columns: GanttColumnConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
}

export function resetGanttColumnSettings(): GanttColumnConfig[] {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return [...DEFAULT_GANTT_COLUMNS];
}

export function resizeColumn(
  columns: GanttColumnConfig[],
  id: GanttColumnId,
  width: number
): GanttColumnConfig[] {
  const min = id === "num" ? 28 : 40;
  const max = id === "name" ? 480 : 200;
  return columns.map((c) => (c.id === id ? { ...c, width: Math.min(max, Math.max(min, Math.round(width))) } : c));
}

export function reorderColumns(
  columns: GanttColumnConfig[],
  fromId: GanttColumnId,
  toId: GanttColumnId
): GanttColumnConfig[] {
  const sorted = sortColumns(columns);
  const fromIndex = sorted.findIndex((c) => c.id === fromId);
  const toIndex = sorted.findIndex((c) => c.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return columns;

  const next = [...sorted];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item!);
  const orderMap = new Map(next.map((c, i) => [c.id, i]));
  return columns.map((c) => ({ ...c, order: orderMap.get(c.id) ?? c.order }));
}
