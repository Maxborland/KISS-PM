import type { PlanDate } from "./types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(date: PlanDate, days: number): PlanDate {
  const parsed = parsePlanDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatPlanDate(parsed);
}

export function diffCalendarDays(start: PlanDate, finish: PlanDate): number {
  const startTime = parsePlanDate(start).getTime();
  const finishTime = parsePlanDate(finish).getTime();
  return Math.round((finishTime - startTime) / 86_400_000);
}

export function comparePlanDates(left: PlanDate, right: PlanDate): number {
  return parsePlanDate(left).getTime() - parsePlanDate(right).getTime();
}

export function minPlanDate(left: PlanDate, right: PlanDate): PlanDate {
  return comparePlanDates(left, right) <= 0 ? left : right;
}

export function maxPlanDate(left: PlanDate, right: PlanDate): PlanDate {
  return comparePlanDates(left, right) >= 0 ? left : right;
}

export function parsePlanDate(date: PlanDate): Date {
  if (!datePattern.test(date)) {
    throw new Error("invalid_plan_date");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || formatPlanDate(parsed) !== date) {
    throw new Error("invalid_plan_date");
  }
  return parsed;
}

export function formatPlanDate(date: Date): PlanDate {
  return date.toISOString().slice(0, 10);
}
