import type { PlanCalendar } from "@kiss-pm/domain";

type ProjectCalendarSource = {
  project: { calendarId?: string | null };
  calendars?: readonly PlanCalendar[] | null;
};

export function resolveProjectCalendar(source: ProjectCalendarSource): PlanCalendar | null {
  const calendarId = source.project.calendarId;
  if (typeof calendarId !== "string" || calendarId.length === 0) return null;
  return source.calendars?.find((calendar) => calendar.id === calendarId) ?? null;
}

export function isCalendarWorkingWeekday(
  calendar: PlanCalendar,
  utcWeekday: number
): boolean {
  return calendar.workingWeekdays.includes(utcWeekday);
}

export function isProjectWorkingDate(
  calendar: PlanCalendar,
  dateIso: string,
  projectHolidayDates: ReadonlySet<string> = new Set()
): boolean {
  const utcWeekday = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  return isCalendarWorkingWeekday(calendar, utcWeekday) && !projectHolidayDates.has(dateIso);
}