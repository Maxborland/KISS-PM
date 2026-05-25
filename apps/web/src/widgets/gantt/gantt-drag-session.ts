import { clampDayIndex, snapDayFromPointer } from "./gantt-dates";
import type { GanttDragKind, GanttDragSession, GanttRow } from "./types";

export function createBarDragSession(
  row: GanttRow,
  kind: GanttDragKind,
  clientX: number
): GanttDragSession {
  return {
    kind,
    rowId: row.id,
    pointerStartX: clientX,
    originStartDay: row.startDay,
    originDuration: row.durationDays,
    originProgress: row.progress ?? 0,
    previewStartDay: row.startDay,
    previewDuration: row.durationDays,
    previewProgress: row.progress ?? 0
  };
}

export function computeBarDragPreview(
  drag: GanttDragSession,
  row: GanttRow,
  clientX: number,
  chartRectLeft: number,
  dayW: number,
  maxDays: number
): Pick<GanttDragSession, "previewStartDay" | "previewDuration" | "previewProgress"> {
  const snapDay = snapDayFromPointer(clientX, chartRectLeft, dayW, maxDays);
  const originSnap = snapDayFromPointer(drag.pointerStartX, chartRectLeft, dayW, maxDays);
  const deltaDays = snapDay - originSnap;

  let previewStartDay = drag.originStartDay;
  let previewDuration = drag.originDuration;
  let previewProgress = drag.originProgress;

  if (drag.kind === "move" || drag.kind === "milestone-move") {
    previewStartDay = clampDayIndex(drag.originStartDay + deltaDays, maxDays);
  } else if (drag.kind === "resize-end") {
    previewDuration = Math.max(row.kind === "milestone" ? 0 : 1, drag.originDuration + deltaDays);
  } else if (drag.kind === "resize-start") {
    previewStartDay = clampDayIndex(drag.originStartDay + deltaDays, maxDays);
    const end = drag.originStartDay + drag.originDuration;
    previewDuration = Math.max(row.kind === "milestone" ? 0 : 1, end - previewStartDay);
  } else if (drag.kind === "progress") {
    const barLeft = row.startDay * dayW;
    const barWidth = Math.max(row.durationDays, 1) * dayW;
    const rel = (clientX - chartRectLeft - barLeft) / barWidth;
    previewProgress = Math.min(1, Math.max(0, rel));
  }

  return { previewStartDay, previewDuration, previewProgress };
}

export function barDragHasChanges(drag: GanttDragSession): boolean {
  if (drag.kind === "progress") {
    return drag.previewProgress !== drag.originProgress;
  }
  return (
    drag.previewStartDay !== drag.originStartDay || drag.previewDuration !== drag.originDuration
  );
}

export function rowAfterBarDragCommit(row: GanttRow, drag: GanttDragSession): GanttRow {
  if (drag.kind === "progress") {
    return { ...row, progress: drag.previewProgress };
  }
  return {
    ...row,
    startDay: drag.previewStartDay,
    durationDays: row.kind === "milestone" ? 0 : drag.previewDuration
  };
}
