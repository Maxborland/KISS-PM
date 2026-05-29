import type { GanttRow } from "./types";

const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/** Демо-календарь: май 2026, day 1 = 01.05.2026. */
export function dayIndexToDateLabel(dayIndex: number): string {
  const day = Math.min(Math.max(dayIndex + 1, 1), 31);
  return `${String(day).padStart(2, "0")}.05.2026`;
}

export function dateLabelToDayIndex(label: string): number | null {
  const match = DATE_RE.exec(label.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month !== 5 || day < 1 || day > 31) return null;
  return day - 1;
}

export function finishDayIndex(row: GanttRow): number {
  if (row.kind === "milestone") return row.startDay;
  return row.startDay + Math.max(row.durationDays, 1) - 1;
}

export function clampDayIndex(day: number, maxDay: number) {
  return Math.min(Math.max(Math.round(day), 0), Math.max(maxDay - 1, 0));
}

export function snapDayFromPointer(clientX: number, rectLeft: number, dayW: number, maxDays: number) {
  const raw = (clientX - rectLeft) / dayW;
  return clampDayIndex(raw, maxDays);
}
