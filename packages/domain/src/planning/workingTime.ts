import { addDays, comparePlanDates } from "./calendar";
import type {
  PlanCalendar,
  PlanCalendarException,
  PlanDate,
  ValidationIssue,
  WorkingInstant
} from "./types";

export function addWorkingMinutesToInstant(
  start: WorkingInstant,
  minutes: number,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): WorkingInstant {
  assertHasWorkingTime(calendar, exceptions);
  if (minutes === 0) return normalizeWorkingInstant(start, calendar, exceptions, "forward");

  return minutes > 0
    ? addForward(start, minutes, calendar, exceptions)
    : addBackward(start, Math.abs(minutes), calendar, exceptions);
}

export function diffWorkingMinutes(
  start: WorkingInstant,
  finish: WorkingInstant,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): number {
  if (compareWorkingInstants(start, finish) === 0) return 0;
  if (compareWorkingInstants(start, finish) > 0) {
    return -diffWorkingMinutes(finish, start, calendar, exceptions);
  }

  let cursor = normalizeWorkingInstant(start, calendar, exceptions, "forward");
  let total = 0;
  let guard = 0;

  while (compareWorkingInstants(cursor, finish) < 0) {
    if (guard++ > 20_000) throw new Error("calendar_has_no_working_time");
    const capacity = workingMinutesForDate(cursor.date, calendar, exceptions);
    const chunk = cursor.date === finish.date
      ? Math.max(0, Math.min(finish.minuteOfDay, capacity) - cursor.minuteOfDay)
      : capacity - cursor.minuteOfDay;
    total += chunk;
    cursor = normalizeWorkingInstant(
      { date: addDays(cursor.date, 1), minuteOfDay: 0 },
      calendar,
      exceptions,
      "forward"
    );
  }

  return total;
}

export function compareWorkingInstants(left: WorkingInstant, right: WorkingInstant): number {
  const dateComparison = comparePlanDates(left.date, right.date);
  if (dateComparison !== 0) return dateComparison;
  return left.minuteOfDay - right.minuteOfDay;
}

export function maxWorkingInstant(left: WorkingInstant, right: WorkingInstant): WorkingInstant {
  return compareWorkingInstants(left, right) >= 0 ? left : right;
}

export function minWorkingInstant(left: WorkingInstant, right: WorkingInstant): WorkingInstant {
  return compareWorkingInstants(left, right) <= 0 ? left : right;
}

export function startOfWorkingDate(
  date: PlanDate,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): WorkingInstant {
  return normalizeWorkingInstant({ date, minuteOfDay: 0 }, calendar, exceptions, "forward");
}

export function endOfWorkingDate(
  date: PlanDate,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): WorkingInstant {
  const normalized = normalizeWorkingInstant(
    { date, minuteOfDay: Number.MAX_SAFE_INTEGER },
    calendar,
    exceptions,
    "backward"
  );
  return {
    date: normalized.date,
    minuteOfDay: workingMinutesForDate(normalized.date, calendar, exceptions)
  };
}

export function workingMinutesForDate(
  date: PlanDate,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): number {
  const exception = exceptions.find(
    (candidate) => candidate.calendarId === calendar.id && candidate.date === date
  );
  if (exception) return Math.max(0, exception.workingMinutes);

  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return calendar.workingWeekdays.includes(day) ? Math.max(0, calendar.workingMinutesPerDay) : 0;
}

export function calendarIssue(message: string): ValidationIssue {
  return {
    code: "calendar_has_no_working_time",
    severity: "error",
    message,
    entity: null
  };
}

function addForward(
  start: WorkingInstant,
  minutes: number,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): WorkingInstant {
  let cursor = normalizeWorkingInstant(start, calendar, exceptions, "forward");
  let remaining = minutes;
  let guard = 0;

  while (remaining > 0) {
    if (guard++ > 20_000) throw new Error("calendar_has_no_working_time");
    const capacity = workingMinutesForDate(cursor.date, calendar, exceptions);
    const available = capacity - cursor.minuteOfDay;
    if (remaining <= available) {
      return { date: cursor.date, minuteOfDay: cursor.minuteOfDay + remaining };
    }
    remaining -= available;
    cursor = normalizeWorkingInstant(
      { date: addDays(cursor.date, 1), minuteOfDay: 0 },
      calendar,
      exceptions,
      "forward"
    );
  }

  return cursor;
}

function addBackward(
  start: WorkingInstant,
  minutes: number,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): WorkingInstant {
  let cursor = normalizeWorkingInstant(start, calendar, exceptions, "backward");
  let remaining = minutes;
  let guard = 0;

  while (remaining > 0) {
    if (guard++ > 20_000) throw new Error("calendar_has_no_working_time");
    if (cursor.minuteOfDay === 0) {
      const previousDate = addDays(cursor.date, -1);
      cursor = normalizeWorkingInstant(
        {
          date: previousDate,
          minuteOfDay: Number.MAX_SAFE_INTEGER
        },
        calendar,
        exceptions,
        "backward"
      );
      continue;
    }
    if (remaining <= cursor.minuteOfDay) {
      return { date: cursor.date, minuteOfDay: cursor.minuteOfDay - remaining };
    }
    remaining -= cursor.minuteOfDay;
    const previousDate = addDays(cursor.date, -1);
    cursor = normalizeWorkingInstant(
      {
        date: previousDate,
        minuteOfDay: workingMinutesForDate(previousDate, calendar, exceptions)
      },
      calendar,
      exceptions,
      "backward"
    );
  }

  return cursor;
}

function normalizeWorkingInstant(
  instant: WorkingInstant,
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[],
  direction: "forward" | "backward"
): WorkingInstant {
  let date = instant.date;
  let guard = 0;

  while (guard++ < 20_000) {
    const capacity = workingMinutesForDate(date, calendar, exceptions);
    if (capacity > 0) {
      const minute = direction === "forward"
        ? Math.max(0, Math.min(instant.minuteOfDay, capacity))
        : Math.max(0, Math.min(instant.minuteOfDay, capacity));
      return { date, minuteOfDay: minute };
    }
    date = addDays(date, direction === "forward" ? 1 : -1);
  }

  throw new Error("calendar_has_no_working_time");
}

function assertHasWorkingTime(
  calendar: PlanCalendar,
  exceptions: PlanCalendarException[]
): void {
  const hasRegularTime = calendar.workingWeekdays.length > 0 && calendar.workingMinutesPerDay > 0;
  const hasExceptionTime = exceptions.some(
    (exception) => exception.calendarId === calendar.id && exception.workingMinutes > 0
  );
  if (!hasRegularTime && !hasExceptionTime) {
    throw new Error("calendar_has_no_working_time");
  }
}
