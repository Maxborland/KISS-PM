export type GanttZoom = "day" | "week" | "month";

export const GANTT_ROW_HEIGHT_PX = 36;

const ZOOM_CELL_WIDTH: Record<GanttZoom, number> = {
  day: 40,
  week: 140,
  month: 220
};

export type GanttTimelineScale = {
  rangeStart: string;
  rangeFinish: string;
  zoom: GanttZoom;
  cellWidth: number;
  timelineWidth: number;
  columns: Array<{ key: string; label: string; startDate: string }>;
};

function parseUtcDate(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function formatUtcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addUtcDays(iso: string, days: number): string {
  const ms = parseUtcDate(iso);
  if (ms === null) return iso;
  return formatUtcDate(ms + days * 86_400_000);
}

function diffUtcDays(fromIso: string, toIso: string): number {
  const from = parseUtcDate(fromIso);
  const to = parseUtcDate(toIso);
  if (from === null || to === null) return 0;
  return Math.round((to - from) / 86_400_000);
}

function expandRange(start: string, finish: string, paddingDays: number): { start: string; finish: string } {
  return {
    start: addUtcDays(start, -paddingDays),
    finish: addUtcDays(finish, paddingDays)
  };
}

function buildColumns(
  rangeStart: string,
  rangeFinish: string,
  zoom: GanttZoom
): Array<{ key: string; label: string; startDate: string }> {
  const columns: Array<{ key: string; label: string; startDate: string }> = [];
  if (zoom === "day") {
    let cursor = rangeStart;
    while (diffUtcDays(cursor, rangeFinish) >= 0) {
      columns.push({ key: cursor, label: cursor.slice(8), startDate: cursor });
      cursor = addUtcDays(cursor, 1);
    }
    return columns;
  }
  if (zoom === "week") {
    let cursor = rangeStart;
    let index = 0;
    while (diffUtcDays(cursor, rangeFinish) >= 0) {
      columns.push({ key: `w-${index}`, label: `Н${index + 1}`, startDate: cursor });
      cursor = addUtcDays(cursor, 7);
      index += 1;
    }
    return columns;
  }
  const [startYear] = rangeStart.split("-");
  const [endYear, endMonth] = rangeFinish.split("-");
  let year = Number.parseInt(startYear ?? "2026", 10);
  let month = 1;
  const endYearNum = Number.parseInt(endYear ?? String(year), 10);
  const endMonthNum = Number.parseInt(endMonth ?? "12", 10);
  while (year < endYearNum || (year === endYearNum && month <= endMonthNum)) {
    const monthIso = `${year}-${String(month).padStart(2, "0")}-01`;
    columns.push({
      key: monthIso,
      label: `${String(month).padStart(2, "0")}.${year}`,
      startDate: monthIso
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return columns;
}

export function buildGanttTimelineScale(input: {
  rangeStart: string | undefined;
  rangeFinish: string | undefined;
  zoom: GanttZoom;
}): GanttTimelineScale | null {
  if (!input.rangeStart || !input.rangeFinish) return null;
  const expanded = expandRange(input.rangeStart, input.rangeFinish, 2);
  const columns = buildColumns(expanded.start, expanded.finish, input.zoom);
  const cellWidth = ZOOM_CELL_WIDTH[input.zoom];
  return {
    rangeStart: expanded.start,
    rangeFinish: expanded.finish,
    zoom: input.zoom,
    cellWidth,
    timelineWidth: Math.max(cellWidth, columns.length * cellWidth),
    columns
  };
}

export function dateToTimelineX(scale: GanttTimelineScale, dateIso: string): number {
  if (scale.zoom === "day") {
    return Math.max(0, diffUtcDays(scale.rangeStart, dateIso) * scale.cellWidth);
  }
  if (scale.zoom === "week") {
    const dayOffset = diffUtcDays(scale.rangeStart, dateIso);
    return Math.max(0, (dayOffset / 7) * scale.cellWidth);
  }
  const [yearText, monthText] = dateIso.split("-");
  const [startYearText, startMonthText] = scale.rangeStart.split("-");
  const monthIndex =
    (Number.parseInt(yearText ?? "0", 10) - Number.parseInt(startYearText ?? "0", 10)) * 12 +
    (Number.parseInt(monthText ?? "1", 10) - Number.parseInt(startMonthText ?? "1", 10));
  return Math.max(0, monthIndex * scale.cellWidth);
}

export function barWidthOnTimeline(
  scale: GanttTimelineScale,
  startIso: string,
  finishIso: string
): number {
  const startX = dateToTimelineX(scale, startIso);
  const endX = dateToTimelineX(scale, finishIso) + (scale.zoom === "day" ? scale.cellWidth : scale.cellWidth / 2);
  return Math.max(scale.cellWidth / 4, endX - startX);
}

/** Inverse of dateToTimelineX for drag-edit (day/week zoom). */
export function timelineXToDate(scale: GanttTimelineScale, x: number): string {
  const clampedX = Math.max(0, x);
  if (scale.zoom === "day") {
    const dayOffset = Math.round(clampedX / scale.cellWidth);
    return addUtcDays(scale.rangeStart, dayOffset);
  }
  if (scale.zoom === "week") {
    const dayOffset = Math.round((clampedX / scale.cellWidth) * 7);
    return addUtcDays(scale.rangeStart, dayOffset);
  }
  const monthOffset = Math.floor(clampedX / scale.cellWidth);
  const [startYearText, startMonthText] = scale.rangeStart.split("-");
  const startYear = Number.parseInt(startYearText ?? "2026", 10);
  const startMonth = Number.parseInt(startMonthText ?? "1", 10);
  const totalMonths = startMonth - 1 + monthOffset;
  const year = startYear + Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function diffUtcDaysBetween(startIso: string, finishIso: string): number {
  return Math.max(0, diffUtcDays(startIso, finishIso));
}
