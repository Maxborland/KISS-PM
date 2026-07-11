import {
  addDays,
  addWorkingMinutesToInstant,
  diffWorkingMinutes,
  endOfWorkingDate,
  startOfWorkingDate,
  type PlanCalendar,
  type PlanCalendarException,
  type PlanDate
} from "@kiss-pm/domain";

export type ScheduleCalendarSource = {
  project?: { calendarId?: string | null };
  calendars?: readonly PlanCalendar[];
  calendarExceptions?: readonly PlanCalendarException[];
};

export type ScheduleWorkingTime = {
  calendar: PlanCalendar;
  exceptions: PlanCalendarException[];
  workingMinutesPerDay: number;
};

// Matches the scheduling engine's fallback when a read model has no configured calendar.
const DEFAULT_CALENDAR: PlanCalendar = {
  id: "default-calendar",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 8 * 60
};

export function resolveScheduleWorkingTime(
  source: ScheduleCalendarSource,
  taskCalendarId: string | null | undefined
): ScheduleWorkingTime {
  const calendars = source.calendars ?? [];
  const calendar =
    calendars.find((candidate) => candidate.id === taskCalendarId) ??
    calendars.find((candidate) => candidate.id === source.project?.calendarId) ??
    calendars[0] ??
    DEFAULT_CALENDAR;
  const exceptions = (source.calendarExceptions ?? []).filter(
    (exception) => exception.calendarId === calendar.id && exception.resourceId === null
  );
  const exceptionWorkingMinutes = exceptions.reduce(
    (maximum, exception) => Math.max(maximum, exception.workingMinutes),
    0
  );
  const workingMinutesPerDay = calendar.workingMinutesPerDay > 0
    ? calendar.workingMinutesPerDay
    : exceptionWorkingMinutes;

  if (workingMinutesPerDay <= 0) throw new Error("calendar_has_no_working_time");
  return { calendar, exceptions, workingMinutesPerDay };
}

export function scheduleWorkingDays(
  minutes: number,
  workingTime: ScheduleWorkingTime
): number {
  return minutes / workingTime.workingMinutesPerDay;
}

export function scheduleWorkingDateOnOrAfter(
  date: PlanDate,
  workingTime: ScheduleWorkingTime
): PlanDate {
  return startOfWorkingDate(
    date,
    workingTime.calendar,
    workingTime.exceptions
  ).date;
}

export function nextScheduleWorkingDate(
  date: PlanDate,
  workingTime: ScheduleWorkingTime
): PlanDate {
  return scheduleWorkingDateOnOrAfter(addDays(date, 1), workingTime);
}

export function scheduleWorkingMinutesThroughDate(
  startDate: PlanDate,
  finishDate: PlanDate,
  workingTime: ScheduleWorkingTime
): number {
  return diffWorkingMinutes(
    startOfWorkingDate(startDate, workingTime.calendar, workingTime.exceptions),
    endOfWorkingDate(finishDate, workingTime.calendar, workingTime.exceptions),
    workingTime.calendar,
    workingTime.exceptions
  );
}

export function scheduleFinishDateForDuration(
  startDate: PlanDate,
  durationMinutes: number,
  workingTime: ScheduleWorkingTime
): PlanDate {
  return addWorkingMinutesToInstant(
    startOfWorkingDate(startDate, workingTime.calendar, workingTime.exceptions),
    durationMinutes,
    workingTime.calendar,
    workingTime.exceptions
  ).date;
}
