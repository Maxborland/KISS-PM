import { dateLabelToDayIndex, dayIndexToDateLabel, finishDayIndex } from "./gantt-dates";
import type { EffortMode, GanttRow } from "./types";

export const DEFAULT_HOURS_PER_DAY = 8;

export function deriveWorkHours(row: GanttRow): number {
  if (row.kind === "milestone") return 0;
  const hpd = row.hoursPerDay ?? DEFAULT_HOURS_PER_DAY;
  return Math.max(0, Math.round(row.durationDays * hpd));
}

export function deriveHoursPerDay(row: GanttRow): number {
  if (row.durationDays <= 0) return row.hoursPerDay ?? DEFAULT_HOURS_PER_DAY;
  const work = row.workHours ?? deriveWorkHours(row);
  return Math.max(0.25, Math.round((work / row.durationDays) * 100) / 100);
}

export function withAutoEffort(row: GanttRow): GanttRow {
  const effortMode = row.effortMode ?? "auto";
  if (effortMode === "custom") {
    return {
      ...row,
      workHours: row.workHours ?? deriveWorkHours(row),
      hoursPerDay: deriveHoursPerDay(row)
    };
  }
  const hoursPerDay = DEFAULT_HOURS_PER_DAY;
  return {
    ...row,
    effortMode: "auto",
    hoursPerDay,
    workHours: deriveWorkHours({ ...row, hoursPerDay })
  };
}

export function updateTaskDuration(row: GanttRow, durationDays: number): GanttRow {
  const next: GanttRow = {
    ...row,
    durationDays: row.kind === "milestone" ? 0 : Math.max(1, durationDays)
  };
  return withAutoEffort(next);
}

export function updateTaskStartDate(row: GanttRow, startLabel: string): GanttRow | null {
  const day = dateLabelToDayIndex(startLabel);
  if (day === null) return null;
  const finish = finishDayIndex(row);
  const duration = Math.max(finish - day + 1, row.kind === "milestone" ? 0 : 1);
  const next: GanttRow = {
    ...row,
    startDay: day,
    durationDays: row.kind === "milestone" ? 0 : duration
  };
  return withAutoEffort(next);
}

export function updateTaskFinishDate(row: GanttRow, finishLabel: string): GanttRow | null {
  const finish = dateLabelToDayIndex(finishLabel);
  if (finish === null) return null;
  if (row.kind === "milestone") {
    return withAutoEffort({ ...row, startDay: finish, durationDays: 0 });
  }
  const duration = Math.max(finish - row.startDay + 1, 1);
  const next: GanttRow = { ...row, durationDays: duration };
  if ((row.effortMode ?? "auto") === "auto") {
    return withAutoEffort(next);
  }
  const work = row.workHours ?? deriveWorkHours(next);
  return {
    ...next,
    workHours: work,
    hoursPerDay: deriveHoursPerDay({ ...next, workHours: work })
  };
}

export function updateTaskWorkHours(row: GanttRow, workHours: number): GanttRow {
  const work = Math.max(0, workHours);
  return {
    ...row,
    effortMode: "custom" as EffortMode,
    workHours: work,
    hoursPerDay: deriveHoursPerDay({ ...row, workHours: work })
  };
}

export function parseWorkHoursInput(value: string): number | null {
  const n = Number(value.replace(",", ".").replace(/\s*ч\s*/i, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10) / 10;
}

export function workHoursLabel(row: GanttRow): string {
  const h = row.workHours ?? deriveWorkHours(row);
  return row.kind === "task" ? `${h}ч` : "—";
}
