import type { PlanningGanttTaskRow } from "../types/viewModel";

export type PlanningGanttScale = "hour" | "day" | "week" | "month";

export type TimelineTierCell = {
  label: string;
  x: number;
  width: number;
  isWeekend?: boolean;
};

export type TimelineTiers = {
  top: TimelineTierCell[];
  bottom: TimelineTierCell[];
  todayX: number;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const paddingBeforeDays = 7;
const paddingAfterDays = 14;

export function getDayWidth(scale: PlanningGanttScale): number {
  switch (scale) {
    case "hour":
      return 120;
    case "day":
      return 30;
    case "week":
      return 8;
    case "month":
      return 3;
  }
}

export function dateToX(date: string, rangeStart: string, dayWidth: number): number {
  return diffCalendarDays(rangeStart, date) * dayWidth;
}

export function xToDate(x: number, rangeStart: string, dayWidth: number): string {
  return formatPlanDate(addDays(rangeStart, Math.round(x / dayWidth)));
}

export function getProjectDateRange(
  tasks: readonly PlanningGanttTaskRow[],
  fallbackToday: string = formatPlanDate(new Date())
): { start: string; finish: string } {
  const dates = tasks.flatMap((task) => [
    task.plannedStart,
    task.plannedFinish,
    task.baselineStart,
    task.baselineFinish
  ]).filter((date): date is string => date !== null);

  if (dates.length === 0) {
    return {
      start: formatPlanDate(addDays(fallbackToday, -paddingBeforeDays)),
      finish: formatPlanDate(addDays(fallbackToday, 30))
    };
  }

  const sorted = [...dates].sort();
  return {
    start: formatPlanDate(addDays(sorted[0] ?? fallbackToday, -paddingBeforeDays)),
    finish: formatPlanDate(addDays(sorted.at(-1) ?? fallbackToday, paddingAfterDays))
  };
}

export function generateTimelineTiers(
  rangeStart: string,
  rangeFinish: string,
  dayWidth: number,
  today: string = formatPlanDate(new Date())
): TimelineTiers {
  const totalDays = Math.max(0, diffCalendarDays(rangeStart, rangeFinish));
  const top: TimelineTierCell[] = [];
  const bottom: TimelineTierCell[] = [];
  let monthCursor = startOfMonth(rangeStart);

  while (comparePlanDates(monthCursor, rangeFinish) < 0) {
    const nextMonth = addMonths(monthCursor, 1);
    const cellStart = comparePlanDates(monthCursor, rangeStart) < 0 ? rangeStart : monthCursor;
    const cellEnd = comparePlanDates(nextMonth, rangeFinish) > 0 ? rangeFinish : nextMonth;
    const daysInCell = diffCalendarDays(cellStart, cellEnd);

    if (daysInCell > 0) {
      top.push({
        label: formatMonthLabel(monthCursor),
        x: diffCalendarDays(rangeStart, cellStart) * dayWidth,
        width: daysInCell * dayWidth
      });
    }

    monthCursor = nextMonth;
  }

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const date = formatPlanDate(addDays(rangeStart, dayIndex));
    bottom.push({
      label: String(parsePlanDate(date).getUTCDate()),
      x: dayIndex * dayWidth,
      width: dayWidth,
      isWeekend: isWeekend(date)
    });
  }

  return {
    top,
    bottom,
    todayX: diffCalendarDays(rangeStart, today) * dayWidth
  };
}

export function getTimelineWidth(rangeStart: string, rangeFinish: string, dayWidth: number): number {
  return Math.max(0, diffCalendarDays(rangeStart, rangeFinish)) * dayWidth;
}

function diffCalendarDays(start: string, finish: string): number {
  return Math.round((parsePlanDate(finish).getTime() - parsePlanDate(start).getTime()) / millisecondsPerDay);
}

function comparePlanDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function addDays(date: string | Date, days: number): Date {
  const parsed = date instanceof Date ? date : parsePlanDate(date);
  return new Date(parsed.getTime() + days * millisecondsPerDay);
}

function addMonths(date: string, months: number): string {
  const parsed = parsePlanDate(date);
  return formatPlanDate(new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + months, 1)));
}

function startOfMonth(date: string): string {
  const parsed = parsePlanDate(date);
  return formatPlanDate(new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1)));
}

function isWeekend(date: string): boolean {
  const weekday = parsePlanDate(date).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function formatMonthLabel(date: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(parsePlanDate(date));
}

function parsePlanDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`invalid_plan_date:${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatPlanDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
