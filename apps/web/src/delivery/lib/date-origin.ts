import { dayToIso, isoToDay } from "@/delivery/lib/planning-demo-data";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function currentPlanDate(now = new Date()): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

export function planDateFromDay(day: number): Date {
  return new Date(`${dayToIso(day)}T00:00:00Z`);
}

export function utcDayOfWeek(day: number): number {
  return planDateFromDay(day).getUTCDay();
}

export function isoDayOfWeek(day: number): number {
  const dow = utcDayOfWeek(day);
  return dow === 0 ? 7 : dow;
}

export function startOfIsoWeekDay(day: number): number {
  return day - (isoDayOfWeek(day) - 1);
}

export function formatWeekLabel(weekIndex: number, originDay: number): string {
  const day = originDay + weekIndex * 7;
  const d = planDateFromDay(day);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS[d.getUTCMonth()] ?? "";
  const prev = planDateFromDay(day - 7);
  const newMonth = weekIndex === 0 || prev.getUTCMonth() !== d.getUTCMonth();
  return newMonth ? `${mon[0]?.toUpperCase()}${mon.slice(1)} ${dd}` : dd;
}

export function deriveScheduleTimeline(input: {
  projectStartIso?: string | null;
  projectFinishDay?: number | null;
  rowStartDays: number[];
  rowFinishDays: number[];
  deadlineDay?: number | null;
  todayIso?: string;
}): { originDay: number; totalDays: number; todayDay: number; todayOffsetDays: number } {
  const todayDay = isoToDay(input.todayIso ?? currentPlanDate());
  const projectStartDay = input.projectStartIso ? isoToDay(input.projectStartIso) : null;
  const startCandidates = [
    todayDay,
    ...(projectStartDay != null ? [projectStartDay] : []),
    ...input.rowStartDays
  ].filter(Number.isFinite);
  const originDay = startOfIsoWeekDay(startCandidates.length ? Math.min(...startCandidates) : todayDay);
  const finishCandidates = [
    todayDay,
    ...(input.projectFinishDay != null ? [input.projectFinishDay] : []),
    ...(input.deadlineDay != null ? [input.deadlineDay] : []),
    ...input.rowFinishDays
  ].filter(Number.isFinite);
  const finishDay = finishCandidates.length ? Math.max(...finishCandidates) : originDay + 7;
  const totalDays = Math.max(7, Math.ceil((finishDay - originDay + 6) / 7) * 7);
  return { originDay, totalDays, todayDay, todayOffsetDays: todayDay - originDay };
}

export function buildProjectMonthKeys(input: {
  projectStartIso?: string | null;
  projectFinishIso?: string | null;
  calculatedStarts: Array<string | null | undefined>;
  calculatedFinishes: Array<string | null | undefined>;
  fallbackIso?: string;
}): string[] {
  const dates = [
    input.projectStartIso,
    input.projectFinishIso,
    ...input.calculatedStarts,
    ...input.calculatedFinishes
  ].filter((date): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date));
  if (dates.length === 0) return [(input.fallbackIso ?? currentPlanDate()).slice(0, 7)];

  const sorted = [...dates].sort();
  const firstMonth = `${sorted[0]!.slice(0, 7)}-01`;
  const lastMonth = `${sorted.at(-1)!.slice(0, 7)}-01`;
  const months: string[] = [];
  let cursor = parsePlanDate(firstMonth);
  const end = parsePlanDate(lastMonth);
  while (cursor.getTime() <= end.getTime()) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return months;
}

export function monthGridDays(monthKey: string): number[] {
  const first = isoToDay(`${monthKey}-01`);
  const start = first - (isoDayOfWeek(first) - 1);
  return Array.from({ length: 42 }, (_, i) => start + i);
}

export function isPlanItemOverdue(finishIso: string | null | undefined, todayIso: string = currentPlanDate()): boolean {
  return finishIso != null && isoToDay(finishIso) < isoToDay(todayIso);
}

function parsePlanDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}
