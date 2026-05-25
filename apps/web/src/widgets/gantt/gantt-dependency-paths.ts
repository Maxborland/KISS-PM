import type { GanttDependency, GanttDependencyEndpoint, GanttDependencyType, GanttRow } from "./types";

/** Pixel height of the chart header: head1 + head2. Keep in sync with gantt.css. */
export const GANTT_CHART_HEADER_PX = 46;
export const GANTT_ROW_PX = 28;

export const GANTT_MILESTONE_PX = 12;

export type EndpointDir = "left" | "right";

export function exitDirOf(endpoint: GanttDependencyEndpoint): EndpointDir {
  return endpoint === "start" ? "left" : "right";
}

export function entryDirOf(endpoint: GanttDependencyEndpoint): EndpointDir {
  return endpoint === "start" ? "left" : "right";
}

function rowCenterY(rowIndex: number) {
  return GANTT_CHART_HEADER_PX + rowIndex * GANTT_ROW_PX + GANTT_ROW_PX / 2;
}

/** Right edge of a bar in px. */
export function barFinishX(row: GanttRow, dayW: number) {
  const endDay = row.kind === "milestone" ? row.startDay : row.startDay + row.durationDays;
  return endDay * dayW;
}

/** Left edge of a bar in px. */
export function barStartX(row: GanttRow, dayW: number) {
  return row.startDay * dayW;
}

export function barEndpointX(row: GanttRow, endpoint: GanttDependencyEndpoint, dayW: number) {
  if (row.kind === "milestone") {
    return endpoint === "start"
      ? row.startDay * dayW
      : row.startDay * dayW + GANTT_MILESTONE_PX;
  }
  return endpoint === "start" ? barStartX(row, dayW) : barFinishX(row, dayW);
}

function depEndpoints(type: GanttDependencyType | undefined): {
  from: GanttDependencyEndpoint;
  to: GanttDependencyEndpoint;
} {
  switch (type ?? "FS") {
    case "SS":
      return { from: "start", to: "start" };
    case "FF":
      return { from: "finish", to: "finish" };
    case "SF":
      return { from: "start", to: "finish" };
    default:
      return { from: "finish", to: "start" };
  }
}

const GUTTER_PX = 4;

function buildOrthogonalDependencyPath(input: {
  x1: number;
  y1: number;
  exitDir: EndpointDir;
  x2: number;
  y2: number;
  entryDir: EndpointDir;
  yChannel: number;
}): { d: string; arrowDir: EndpointDir } {
  const { x1, y1, exitDir, x2, y2, entryDir, yChannel } = input;
  const arrowDir: EndpointDir = entryDir === "left" ? "right" : "left";

  const xa = exitDir === "right" ? x1 + GUTTER_PX : x1 - GUTTER_PX;
  const xb = entryDir === "left" ? x2 - GUTTER_PX : x2 + GUTTER_PX;

  // Always route through the row-gap channel adjacent to TARGET row.
  // Horizontal travel happens at row-border (between bar bodies) → bars cover
  // any vertical crossings via z-index, while horizontal segment stays in the gap.
  return {
    d: `M ${x1} ${y1} H ${xa} V ${yChannel} H ${xb} V ${y2} H ${x2}`,
    arrowDir
  };
}

/** Channel y placed at row-border adjacent to TARGET row. */
function rowGapChannelY(fromIndex: number, toIndex: number): number {
  if (toIndex > fromIndex) {
    return GANTT_CHART_HEADER_PX + toIndex * GANTT_ROW_PX;
  }
  if (toIndex < fromIndex) {
    return GANTT_CHART_HEADER_PX + (toIndex + 1) * GANTT_ROW_PX;
  }
  return GANTT_CHART_HEADER_PX + (toIndex + 1) * GANTT_ROW_PX;
}

export type DependencyPath = {
  id: string;
  d: string;
  x2: number;
  y2: number;
  arrowDir: EndpointDir;
};

export function buildDependencyPaths(
  rows: GanttRow[],
  dependencies: GanttDependency[],
  dayW: number
): DependencyPath[] {
  const indexById = new Map(rows.map((row, index) => [row.id, index]));

  return dependencies
    .map((dep) => {
      const fromIndex = indexById.get(dep.fromId);
      const toIndex = indexById.get(dep.toId);
      const fromRow = fromIndex !== undefined ? rows[fromIndex] : undefined;
      const toRow = toIndex !== undefined ? rows[toIndex] : undefined;
      if (fromRow === undefined || toRow === undefined || fromIndex === undefined || toIndex === undefined) {
        return null;
      }

      const { from, to } = depEndpoints(dep.type);
      const x1 = barEndpointX(fromRow, from, dayW);
      const x2 = barEndpointX(toRow, to, dayW);
      const y1 = rowCenterY(fromIndex);
      const y2 = rowCenterY(toIndex);
      const exitDir = exitDirOf(from);
      const entryDir = entryDirOf(to);
      const yChannel = rowGapChannelY(fromIndex, toIndex);
      const { d, arrowDir } = buildOrthogonalDependencyPath({
        x1,
        y1,
        exitDir,
        x2,
        y2,
        entryDir,
        yChannel
      });

      return {
        id: dep.id,
        d,
        x2,
        y2,
        arrowDir
      };
    })
    .filter((path): path is DependencyPath => path !== null);
}
