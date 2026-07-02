import type { PlanDate } from "./types";

export type OccupancySourceType =
  | "planning_assignment"
  | "reservation"
  | "absence"
  | "personal_calendar_event"
  | "meeting"
  | "call_session";

export type OccupancyCapacityImpact = "busy" | "unavailable" | "tentative";
export type OccupancyVisibility = "public" | "busy_only" | "private";
export type PersonalCalendarSourceProvider = "manual" | "google" | "microsoft" | "caldav";

export type ResourcePersonalCalendar = {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  timezone: string;
  sourceProvider: PersonalCalendarSourceProvider;
  syncStatus: "manual" | "connected" | "sync_failed" | "disabled";
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type ResourceCalendarEvent = {
  id: string;
  tenantId: string;
  calendarId: string;
  userId: string;
  sourceProvider: PersonalCalendarSourceProvider;
  externalId: string | null;
  title: string | null;
  startsAt: Date;
  finishesAt: Date;
  workMinutes: number | null;
  capacityImpact: OccupancyCapacityImpact;
  visibility: OccupancyVisibility;
  metadata: Record<string, unknown>;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type OccupancyWindow = {
  id: string;
  tenantId: string;
  resourceId: string;
  sourceType: OccupancySourceType;
  sourceId: string;
  startsAt: string;
  finishesAt: string;
  workMinutes?: number | null;
  capacityImpact: OccupancyCapacityImpact;
  visibility: OccupancyVisibility;
  title?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export type OccupancyContribution = {
  occupancyId: string;
  sourceType: OccupancySourceType;
  sourceId: string;
  workMinutes: number;
};

export type OccupancyMaskPolicy = "full" | "busy_only";

export function occupancyMinutesForDate(window: OccupancyWindow, date: PlanDate): number {
  const start = parseInstant(window.startsAt);
  const finish = parseInstant(window.finishesAt);
  if (!start || !finish || finish.getTime() <= start.getTime()) return 0;

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayFinish = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const overlapStart = Math.max(start.getTime(), dayStart.getTime());
  const overlapFinish = Math.min(finish.getTime(), dayFinish.getTime());
  if (overlapFinish <= overlapStart) return 0;

  const overlapMinutes = Math.ceil((overlapFinish - overlapStart) / 60_000);
  if (window.workMinutes === undefined || window.workMinutes === null) return overlapMinutes;

  const totalMinutes = Math.ceil((finish.getTime() - start.getTime()) / 60_000);
  if (totalMinutes <= 0) return 0;
  return Math.min(overlapMinutes, Math.round((window.workMinutes * overlapMinutes) / totalMinutes));
}

export function aggregateOccupancyContributions(
  contributions: OccupancyContribution[]
): OccupancyContribution[] {
  const grouped = new Map<string, OccupancyContribution>();
  for (const contribution of contributions) {
    const key = `${contribution.occupancyId}:${contribution.sourceType}:${contribution.sourceId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.workMinutes += contribution.workMinutes;
      continue;
    }
    grouped.set(key, { ...contribution });
  }
  return [...grouped.values()].sort(
    (left, right) =>
      left.occupancyId.localeCompare(right.occupancyId) ||
      left.sourceType.localeCompare(right.sourceType) ||
      left.sourceId.localeCompare(right.sourceId)
  );
}

export function maskOccupancyWindow(
  window: OccupancyWindow,
  policy: OccupancyMaskPolicy
): OccupancyWindow {
  if (policy === "full" && window.visibility === "public") return { ...window };
  return {
    ...window,
    title: "Занято",
    entityType: null,
    entityId: null
  };
}

function parseInstant(value: string): Date | undefined {
  // ISO-строку без явного оффсета new Date() трактует как локальное время сервера, а бакеты дней
  // строятся в UTC — минуты бы съезжали на соседний день на не-UTC хосте. Нормализуем к UTC.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value) ? `${value}Z` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
