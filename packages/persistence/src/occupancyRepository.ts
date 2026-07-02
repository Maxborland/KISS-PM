import { and, asc, eq, gt, inArray, isNull, lt } from "drizzle-orm";

import type {
  OccupancyWindow,
  PersonalCalendarSourceProvider,
  ResourceCalendarEvent,
  ResourcePersonalCalendar,
  TenantId,
  UserId
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  callParticipantStates,
  callRooms,
  callSessions,
  meetingParticipants,
  meetings,
  resourceCalendarEvents,
  resourcePersonalCalendars
} from "./schema";

export type PersonalCalendarEventInput = {
  id: string;
  tenantId: TenantId;
  calendarId: string;
  userId: UserId;
  sourceProvider?: PersonalCalendarSourceProvider;
  externalId?: string | null;
  title?: string | null;
  startsAt: Date;
  finishesAt: Date;
  workMinutes?: number | null;
  capacityImpact?: "busy" | "unavailable" | "tentative";
  visibility?: "public" | "busy_only" | "private";
  metadata?: Record<string, unknown>;
  createdByUserId: UserId;
};

export type OccupancyRepository = {
  ensureManualPersonalCalendar(input: {
    tenantId: TenantId;
    userId: UserId;
    createdByUserId: UserId;
  }): Promise<ResourcePersonalCalendar>;
  findPersonalCalendar(input: {
    tenantId: TenantId;
    userId: UserId;
  }): Promise<ResourcePersonalCalendar | undefined>;
  createPersonalCalendarEvent(input: PersonalCalendarEventInput): Promise<ResourceCalendarEvent>;
  updatePersonalCalendarEvent(input: {
    tenantId: TenantId;
    eventId: string;
    userId: UserId;
    title?: string | null;
    startsAt: Date;
    finishesAt: Date;
    workMinutes?: number | null;
    capacityImpact: "busy" | "unavailable" | "tentative";
    visibility: "public" | "busy_only" | "private";
    metadata?: Record<string, unknown>;
  }): Promise<ResourceCalendarEvent | undefined>;
  archivePersonalCalendarEvent(input: {
    tenantId: TenantId;
    eventId: string;
    userId: UserId;
  }): Promise<ResourceCalendarEvent | undefined>;
  listPersonalCalendarEvents(input: {
    tenantId: TenantId;
    userId: UserId;
    from: Date;
    to: Date;
  }): Promise<ResourceCalendarEvent[]>;
  listOccupancyWindows(input: {
    tenantId: TenantId;
    resourceId?: UserId | undefined;
    from: Date;
    to: Date;
  }): Promise<OccupancyWindow[]>;
};

export function createOccupancyRepository(db: KissPmDatabase): OccupancyRepository {
  return {
    async ensureManualPersonalCalendar(input) {
      const existing = await findManualCalendar(db, input.tenantId, input.userId);
      if (existing) return existing;

      const now = new Date();
      const [row] = await db
        .insert(resourcePersonalCalendars)
        .values({
          id: `personal-calendar-${input.userId}`,
          tenantId: input.tenantId,
          userId: input.userId,
          name: "Личный календарь",
          timezone: "UTC",
          sourceProvider: "manual",
          syncStatus: "manual",
          createdByUserId: input.createdByUserId,
          createdAt: now,
          updatedAt: now,
          archivedAt: null
        })
        .onConflictDoNothing()
        .returning();
      if (row) return mapPersonalCalendar(row);
      // Гонка: параллельный первый запрос уже вставил календарь (PK personal-calendar-<userId>).
      // onConflictDoNothing вернул пусто — идемпотентно перечитываем существующий вместо 500.
      const raced = await findManualCalendar(db, input.tenantId, input.userId);
      if (!raced) throw new Error("occupancy_calendar_insert_failed");
      return raced;
    },

    async findPersonalCalendar(input) {
      return findManualCalendar(db, input.tenantId, input.userId);
    },

    async createPersonalCalendarEvent(input) {
      if (input.finishesAt <= input.startsAt) throw new Error("occupancy_event_invalid_range");
      const now = new Date();
      const [row] = await db
        .insert(resourceCalendarEvents)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          calendarId: input.calendarId,
          userId: input.userId,
          sourceProvider: input.sourceProvider ?? "manual",
          externalId: input.externalId ?? null,
          title: input.title ?? null,
          startsAt: input.startsAt,
          finishesAt: input.finishesAt,
          workMinutes: input.workMinutes ?? null,
          capacityImpact: input.capacityImpact ?? "busy",
          visibility: input.visibility ?? "busy_only",
          metadata: input.metadata ?? {},
          createdByUserId: input.createdByUserId,
          createdAt: now,
          updatedAt: now,
          archivedAt: null
        })
        .returning();
      if (!row) throw new Error("occupancy_event_insert_failed");
      return mapCalendarEvent(row);
    },

    async updatePersonalCalendarEvent(input) {
      if (input.finishesAt <= input.startsAt) throw new Error("occupancy_event_invalid_range");
      const [row] = await db
        .update(resourceCalendarEvents)
        .set({
          title: input.title ?? null,
          startsAt: input.startsAt,
          finishesAt: input.finishesAt,
          workMinutes: input.workMinutes ?? null,
          capacityImpact: input.capacityImpact,
          visibility: input.visibility,
          metadata: input.metadata ?? {},
          updatedAt: new Date()
        })
        .where(
          and(
            eq(resourceCalendarEvents.tenantId, input.tenantId),
            eq(resourceCalendarEvents.id, input.eventId),
            eq(resourceCalendarEvents.userId, input.userId),
            isNull(resourceCalendarEvents.archivedAt)
          )
        )
        .returning();
      return row ? mapCalendarEvent(row) : undefined;
    },

    async archivePersonalCalendarEvent(input) {
      const [row] = await db
        .update(resourceCalendarEvents)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(resourceCalendarEvents.tenantId, input.tenantId),
            eq(resourceCalendarEvents.id, input.eventId),
            eq(resourceCalendarEvents.userId, input.userId),
            isNull(resourceCalendarEvents.archivedAt)
          )
        )
        .returning();
      return row ? mapCalendarEvent(row) : undefined;
    },

    async listPersonalCalendarEvents(input) {
      const rows = await db
        .select()
        .from(resourceCalendarEvents)
        .where(
          and(
            eq(resourceCalendarEvents.tenantId, input.tenantId),
            eq(resourceCalendarEvents.userId, input.userId),
            lt(resourceCalendarEvents.startsAt, input.to),
            gt(resourceCalendarEvents.finishesAt, input.from),
            isNull(resourceCalendarEvents.archivedAt)
          )
        )
        .orderBy(asc(resourceCalendarEvents.startsAt), asc(resourceCalendarEvents.id));
      return rows.map(mapCalendarEvent);
    },

    async listOccupancyWindows(input) {
      const windows = [
        ...(await listPersonalEventWindows(db, input)),
        ...(await listMeetingWindows(db, input)),
        ...(await listCallSessionWindows(db, input))
      ];
      return windows.sort(
        (left, right) =>
          left.resourceId.localeCompare(right.resourceId) ||
          left.startsAt.localeCompare(right.startsAt) ||
          left.id.localeCompare(right.id)
      );
    }
  };
}

async function findManualCalendar(
  db: KissPmDatabase,
  tenantId: TenantId,
  userId: UserId
): Promise<ResourcePersonalCalendar | undefined> {
  const [row] = await db
    .select()
    .from(resourcePersonalCalendars)
    .where(
      and(
        eq(resourcePersonalCalendars.tenantId, tenantId),
        eq(resourcePersonalCalendars.userId, userId),
        eq(resourcePersonalCalendars.sourceProvider, "manual"),
        isNull(resourcePersonalCalendars.archivedAt)
      )
    )
    .limit(1);
  return row ? mapPersonalCalendar(row) : undefined;
}

async function listPersonalEventWindows(
  db: KissPmDatabase,
  input: { tenantId: TenantId; resourceId?: UserId | undefined; from: Date; to: Date }
): Promise<OccupancyWindow[]> {
  const filters = [
    eq(resourceCalendarEvents.tenantId, input.tenantId),
    lt(resourceCalendarEvents.startsAt, input.to),
    gt(resourceCalendarEvents.finishesAt, input.from),
    isNull(resourceCalendarEvents.archivedAt)
  ];
  if (input.resourceId) filters.push(eq(resourceCalendarEvents.userId, input.resourceId));
  const rows = await db.select().from(resourceCalendarEvents).where(and(...filters));
  return rows.map((row) => ({
    id: `calendar-event:${row.id}`,
    tenantId: row.tenantId,
    resourceId: row.userId,
    sourceType: "personal_calendar_event",
    sourceId: row.id,
    startsAt: row.startsAt.toISOString(),
    finishesAt: row.finishesAt.toISOString(),
    workMinutes: row.workMinutes,
    capacityImpact: row.capacityImpact as OccupancyWindow["capacityImpact"],
    visibility: row.visibility as OccupancyWindow["visibility"],
    title: row.title,
    entityType: "personal_calendar_event",
    entityId: row.id
  }));
}

async function listMeetingWindows(
  db: KissPmDatabase,
  input: { tenantId: TenantId; resourceId?: UserId | undefined; from: Date; to: Date }
): Promise<OccupancyWindow[]> {
  const filters = [
    eq(meetings.tenantId, input.tenantId),
    lt(meetings.scheduledStart, input.to),
    gt(meetings.scheduledFinish, input.from),
    inArray(meetings.status, ["scheduled", "completed"]),
    inArray(meetingParticipants.response, ["pending", "accepted"])
  ];
  if (input.resourceId) filters.push(eq(meetingParticipants.userId, input.resourceId));
  const rows = await db
    .select({ meeting: meetings, participant: meetingParticipants })
    .from(meetingParticipants)
    .innerJoin(
      meetings,
      and(
        eq(meetings.tenantId, meetingParticipants.tenantId),
        eq(meetings.id, meetingParticipants.meetingId)
      )
    )
    .where(and(...filters));
  return rows.map(({ meeting, participant }) => ({
    id: `meeting:${meeting.id}:${participant.userId}`,
    tenantId: meeting.tenantId,
    resourceId: participant.userId,
    sourceType: "meeting",
    sourceId: meeting.id,
    startsAt: meeting.scheduledStart.toISOString(),
    finishesAt: meeting.scheduledFinish.toISOString(),
    workMinutes: null,
    capacityImpact: "busy",
    visibility: "busy_only",
    title: meeting.title,
    entityType: meeting.entityType,
    entityId: meeting.entityId
  }));
}

async function listCallSessionWindows(
  db: KissPmDatabase,
  input: { tenantId: TenantId; resourceId?: UserId | undefined; from: Date; to: Date }
): Promise<OccupancyWindow[]> {
  const filters = [
    eq(callSessions.tenantId, input.tenantId),
    lt(callSessions.startedAt, input.to),
    inArray(callParticipantStates.state, ["joining", "joined", "left"])
  ];
  if (input.resourceId) filters.push(eq(callParticipantStates.userId, input.resourceId));
  const rows = await db
    .select({ session: callSessions, room: callRooms, participant: callParticipantStates })
    .from(callParticipantStates)
    .innerJoin(
      callSessions,
      and(
        eq(callSessions.tenantId, callParticipantStates.tenantId),
        eq(callSessions.roomId, callParticipantStates.roomId),
        eq(callSessions.id, callParticipantStates.sessionId)
      )
    )
    .innerJoin(
      callRooms,
      and(eq(callRooms.tenantId, callSessions.tenantId), eq(callRooms.id, callSessions.roomId))
    )
    .where(and(...filters));
  return rows
    .map(({ session, room, participant }): OccupancyWindow | null => {
      const startsAt = participant.joinedAt ?? session.startedAt;
      const finishesAt = participant.leftAt ?? session.endedAt ?? input.to;
      if (finishesAt <= startsAt || finishesAt <= input.from) return null;
      return {
        id: `call-session:${session.id}:${participant.userId}`,
        tenantId: session.tenantId,
        resourceId: participant.userId,
        sourceType: "call_session" as const,
        sourceId: session.id,
        startsAt: startsAt.toISOString(),
        finishesAt: finishesAt.toISOString(),
        workMinutes: null,
        capacityImpact: "busy" as const,
        visibility: "busy_only" as const,
        title: room.title,
        entityType: room.entityType,
        entityId: room.entityId
      };
    })
    .filter((window): window is OccupancyWindow => window !== null);
}

function mapPersonalCalendar(row: typeof resourcePersonalCalendars.$inferSelect): ResourcePersonalCalendar {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    name: row.name,
    timezone: row.timezone,
    sourceProvider: row.sourceProvider as PersonalCalendarSourceProvider,
    syncStatus: row.syncStatus as ResourcePersonalCalendar["syncStatus"],
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  };
}

function mapCalendarEvent(row: typeof resourceCalendarEvents.$inferSelect): ResourceCalendarEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    calendarId: row.calendarId,
    userId: row.userId,
    sourceProvider: row.sourceProvider as PersonalCalendarSourceProvider,
    externalId: row.externalId,
    title: row.title,
    startsAt: row.startsAt,
    finishesAt: row.finishesAt,
    workMinutes: row.workMinutes,
    capacityImpact: row.capacityImpact as ResourceCalendarEvent["capacityImpact"],
    visibility: row.visibility as ResourceCalendarEvent["visibility"],
    metadata: row.metadata,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  };
}
