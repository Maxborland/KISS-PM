import { dependencyTypeFromEndpoints } from "./gantt-dependency-rules";
import { barEndpointX, GANTT_CHART_HEADER_PX, GANTT_ROW_PX } from "./gantt-dependency-paths";
import type {
  GanttDependencyEndpoint,
  GanttDependencyType,
  GanttLinkSession,
  GanttRow
} from "./types";

export type GanttLinkHoverTarget = {
  rowId: string;
  endpoint: GanttDependencyEndpoint;
};

/** Raw hit-test attributes from a dependency endpoint handle (DOM adapter). */
export type GanttEndpointHitAttrs = {
  rowId: string | null;
  endpoint: string | null;
};

export function isGanttDependencyEndpoint(value: string | null): value is GanttDependencyEndpoint {
  return value === "start" || value === "finish";
}

/** Resolve link target from data-* attributes (no DOM). */
export function linkTargetFromHitAttrs(attrs: GanttEndpointHitAttrs): GanttLinkHoverTarget | undefined {
  const { rowId, endpoint } = attrs;
  if (!rowId || !isGanttDependencyEndpoint(endpoint)) return undefined;
  return { rowId, endpoint };
}

/**
 * DOM adapter: resolve endpoint under pointer via elementFromPoint + closest handle.
 * Pass `doc` in tests with a stub document.
 */
export function linkTargetFromPointer(
  clientX: number,
  clientY: number,
  doc: Document = typeof document !== "undefined" ? document : (null as unknown as Document)
): GanttLinkHoverTarget | undefined {
  if (!doc?.elementFromPoint) return undefined;
  const el = doc.elementFromPoint(clientX, clientY);
  const handle = el?.closest("[data-gantt-endpoint]") as HTMLElement | null;
  if (!handle) return undefined;
  return linkTargetFromHitAttrs({
    rowId: handle.getAttribute("data-gantt-row-id"),
    endpoint: handle.getAttribute("data-gantt-endpoint")
  });
}

export function linkPreviewDependencyType(
  fromEndpoint: GanttDependencyEndpoint,
  hover?: Pick<GanttLinkHoverTarget, "endpoint">
): GanttDependencyType | null {
  if (!hover) return null;
  return dependencyTypeFromEndpoints(fromEndpoint, hover.endpoint);
}

/** Russian readout while dragging a link ("Связь: FS"). */
export function linkReadoutLabel(type: GanttDependencyType | null): string | null {
  if (!type) return null;
  return `Связь: ${type}`;
}

export function canCompleteLinkHover(
  fromId: string,
  hover?: GanttLinkHoverTarget
): hover is GanttLinkHoverTarget {
  return Boolean(hover && hover.rowId !== fromId);
}

export type LinkPreviewLine = { x1: number; y1: number; x2: number; y2: number };

/** Chart-space preview segment for an in-progress link drag. */
export function buildLinkPreviewLine(input: {
  rows: GanttRow[];
  link: Pick<
    GanttLinkSession,
    "fromId" | "fromEndpoint" | "pointerX" | "pointerY" | "hoverToId" | "hoverToEndpoint"
  >;
  dayW: number;
}): LinkPreviewLine | null {
  const { rows, link, dayW } = input;
  const fromIndex = rows.findIndex((r) => r.id === link.fromId);
  if (fromIndex < 0) return null;

  const fromRow = rows[fromIndex]!;
  const x1 = barEndpointX(fromRow, link.fromEndpoint, dayW);
  const y1 = GANTT_CHART_HEADER_PX + fromIndex * GANTT_ROW_PX + GANTT_ROW_PX / 2;

  let x2 = link.pointerX;
  let y2 = link.pointerY;

  if (link.hoverToId && link.hoverToEndpoint) {
    const toIndex = rows.findIndex((r) => r.id === link.hoverToId);
    const toRow = toIndex >= 0 ? rows[toIndex] : undefined;
    if (toRow) {
      x2 = barEndpointX(toRow, link.hoverToEndpoint, dayW);
      y2 = GANTT_CHART_HEADER_PX + toIndex * GANTT_ROW_PX + GANTT_ROW_PX / 2;
    }
  }

  return { x1, y1, x2, y2 };
}
