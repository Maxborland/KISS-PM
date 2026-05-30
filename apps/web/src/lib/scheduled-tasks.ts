import type { ScheduledTask } from "@/lib/api-types";

export function getRuntimeTodayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getScheduledTaskDailyWorkMinutes(
  task: Pick<ScheduledTask, "plannedStart" | "plannedFinish" | "workMinutes">,
  targetDate: string = getRuntimeTodayIsoDate()
): number {
  const start = task.plannedStart.slice(0, 10);
  const finish = task.plannedFinish.slice(0, 10);

  if (targetDate < start || targetDate > finish) return 0;

  const days = inclusiveCalendarDays(start, finish);
  if (days <= 1) return task.workMinutes;

  return Math.round(task.workMinutes / days);
}

function inclusiveCalendarDays(start: string, finish: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const finishMs = Date.parse(`${finish}T00:00:00.000Z`);

  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs) || finishMs <= startMs) {
    return 1;
  }

  return Math.floor((finishMs - startMs) / 86_400_000) + 1;
}
