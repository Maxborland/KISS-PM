import { hashSessionToken } from "@kiss-pm/persistence";
import { describe, expect, it } from "vitest";

import { createApp } from "./app";
import type { ApiTenantDataSource, AuditEventListItem } from "./apiTypes";

const sessionToken = "a".repeat(64);
const tenantId = "tenant-alpha";
const admin = {
  id: "user-alpha-admin",
  tenantId,
  name: "Анна Администратор",
  accessProfileId: "profile-admin"
};
const engineer = {
  id: "user-alpha-engineer",
  tenantId,
  name: "Игорь Инженер",
  accessProfileId: "profile-engineer"
};

function createTestDataSource() {
  const events: Array<{
    id: string;
    tenantId: string;
    calendarId: string;
    userId: string;
    sourceProvider: "manual";
    externalId: null;
    title: string | null;
    startsAt: Date;
    finishesAt: Date;
    workMinutes: number | null;
    capacityImpact: "busy" | "unavailable" | "tentative";
    visibility: "public" | "busy_only" | "private";
    metadata: Record<string, unknown>;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }> = [];
  const calendars = new Set<string>();
  const auditEvents: AuditEventListItem[] = [];
  const dataSource: Partial<ApiTenantDataSource> = {
    async findSessionByTokenHash(tokenHash) {
      if (tokenHash !== hashSessionToken(sessionToken)) return undefined;
      return {
        id: "session-1",
        tenantId,
        userId: admin.id,
        tokenHash,
        createdAt: new Date("2026-05-26T00:00:00.000Z"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      };
    },
    async findUserById(userId) {
      return [admin, engineer].find((user) => user.id === userId);
    },
    async listWorkspaceUsers() {
      return [
        {
          ...admin,
          email: "admin@kiss-pm.local",
          status: "active",
          positionId: null,
          positionName: null,
          phone: null,
          telegram: null,
          theme: "system",
          accentColor: "teal"
        },
        {
          ...engineer,
          email: "engineer@kiss-pm.local",
          status: "active",
          positionId: null,
          positionName: null,
          phone: null,
          telegram: null,
          theme: "system",
          accentColor: "teal"
        }
      ];
    },
    async findAccessProfileById(_tenantId, profileId) {
      if (profileId === "profile-admin") {
        return {
          id: profileId,
          tenantId,
          name: "Администратор",
          permissions: ["tenant.project_resources.read", "tenant.project_resources.manage"]
        };
      }
      return {
        id: profileId,
        tenantId,
        name: "Инженер",
        permissions: []
      };
    },
    async withTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    },
    async appendAuditEvent(input) {
      auditEvents.push({
        ...input,
        sourceWorkflow: input.sourceWorkflow ?? null,
        sourceSurfaceId: input.sourceSurfaceId ?? null
      });
    },
    async ensureManualPersonalCalendar(input) {
      calendars.add(input.userId);
      return {
        id: `personal-calendar-${input.userId}`,
        tenantId: input.tenantId,
        userId: input.userId,
        name: "Личный календарь",
        timezone: "UTC",
        sourceProvider: "manual",
        syncStatus: "manual",
        createdByUserId: input.createdByUserId,
        createdAt: new Date("2026-05-26T00:00:00.000Z"),
        updatedAt: new Date("2026-05-26T00:00:00.000Z"),
        archivedAt: null
      };
    },
    async findPersonalCalendar(input) {
      if (!calendars.has(input.userId)) return undefined;
      return {
        id: `personal-calendar-${input.userId}`,
        tenantId: input.tenantId,
        userId: input.userId,
        name: "Личный календарь",
        timezone: "UTC",
        sourceProvider: "manual",
        syncStatus: "manual",
        createdByUserId: admin.id,
        createdAt: new Date("2026-05-26T00:00:00.000Z"),
        updatedAt: new Date("2026-05-26T00:00:00.000Z"),
        archivedAt: null
      };
    },
    async createPersonalCalendarEvent(input) {
      const event = {
        id: input.id,
        tenantId: input.tenantId,
        calendarId: input.calendarId,
        userId: input.userId,
        sourceProvider: "manual" as const,
        externalId: null,
        title: input.title ?? null,
        startsAt: input.startsAt,
        finishesAt: input.finishesAt,
        workMinutes: input.workMinutes ?? null,
        capacityImpact: input.capacityImpact ?? "busy",
        visibility: input.visibility ?? "busy_only",
        metadata: input.metadata ?? {},
        createdByUserId: input.createdByUserId,
        createdAt: new Date("2026-05-26T00:00:00.000Z"),
        updatedAt: new Date("2026-05-26T00:00:00.000Z"),
        archivedAt: null
      };
      events.push(event);
      return event;
    },
    async updatePersonalCalendarEvent(input) {
      const event = events.find((item) =>
        item.tenantId === input.tenantId &&
        item.id === input.eventId &&
        item.userId === input.userId &&
        item.archivedAt === null
      );
      if (!event) return undefined;
      Object.assign(event, {
        title: input.title ?? null,
        startsAt: input.startsAt,
        finishesAt: input.finishesAt,
        workMinutes: input.workMinutes ?? null,
        capacityImpact: input.capacityImpact,
        visibility: input.visibility,
        metadata: input.metadata ?? {},
        updatedAt: new Date("2026-05-26T01:00:00.000Z")
      });
      return event;
    },
    async archivePersonalCalendarEvent(input) {
      const event = events.find((item) =>
        item.tenantId === input.tenantId &&
        item.id === input.eventId &&
        item.userId === input.userId &&
        item.archivedAt === null
      );
      if (!event) return undefined;
      event.archivedAt = new Date("2026-05-26T02:00:00.000Z");
      return event;
    },
    async listPersonalCalendarEvents(input) {
      return events.filter((event) =>
        event.tenantId === input.tenantId &&
        event.userId === input.userId &&
        event.startsAt < input.to &&
        event.finishesAt > input.from &&
        event.archivedAt === null
      );
    },
    async listOccupancyWindows(input) {
      return events
        .filter((event) =>
          event.tenantId === input.tenantId &&
          (!input.resourceId || event.userId === input.resourceId) &&
          event.startsAt < input.to &&
          event.finishesAt > input.from &&
          event.archivedAt === null
        )
        .map((event) => ({
          id: `calendar-event:${event.id}`,
          tenantId: event.tenantId,
          resourceId: event.userId,
          sourceType: "personal_calendar_event" as const,
          sourceId: event.id,
          startsAt: event.startsAt.toISOString(),
          finishesAt: event.finishesAt.toISOString(),
          workMinutes: event.workMinutes,
          capacityImpact: event.capacityImpact,
          visibility: event.visibility,
          title: event.title,
          entityType: "personal_calendar_event",
          entityId: event.id
        }));
    }
  };
  return { dataSource: dataSource as ApiTenantDataSource, auditEvents };
}

function mutationHeaders() {
  return {
    cookie: `kiss_pm_session=${sessionToken}`,
    "content-type": "application/json",
    "x-kiss-pm-action": "same-origin"
  };
}

describe("occupancy API routes", () => {
  it("creates, updates, masks and archives personal calendar events", async () => {
    const { dataSource, auditEvents } = createTestDataSource();
    const app = createApp({ dataSource });

    const create = await app.request(
      `/api/workspace/resources/${engineer.id}/personal-calendar/events`,
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({
          title: "Архитектурная сессия",
          startsAt: "2026-06-02T09:30:00.000Z",
          finishesAt: "2026-06-02T10:45:00.000Z",
          capacityImpact: "busy",
          visibility: "private"
        })
      }
    );
    expect(create.status).toBe(201);
    const created = await create.json() as { event: { id: string; title: string } };
    expect(created.event.title).toBe("Архитектурная сессия");

    const occupancy = await app.request(
      `/api/workspace/occupancy?resourceId=${engineer.id}&from=2026-06-02T00:00:00.000Z&to=2026-06-03T00:00:00.000Z`,
      { headers: { cookie: `kiss_pm_session=${sessionToken}` } }
    );
    expect(occupancy.status).toBe(200);
    const body = await occupancy.json() as { occupancy: Array<{ title: string; entityId: string | null }> };
    expect(body.occupancy).toEqual([
      expect.objectContaining({ title: "Занято", entityId: null })
    ]);

    const update = await app.request(
      `/api/workspace/resources/${engineer.id}/personal-calendar/events/${created.event.id}`,
      {
        method: "PATCH",
        headers: mutationHeaders(),
        body: JSON.stringify({
          title: "Созвон по плану",
          startsAt: "2026-06-02T11:00:00.000Z",
          finishesAt: "2026-06-02T12:00:00.000Z",
          capacityImpact: "busy",
          visibility: "busy_only",
          workMinutes: 60
        })
      }
    );
    expect(update.status).toBe(200);

    const remove = await app.request(
      `/api/workspace/resources/${engineer.id}/personal-calendar/events/${created.event.id}`,
      {
        method: "DELETE",
        headers: {
          cookie: `kiss_pm_session=${sessionToken}`,
          "x-kiss-pm-action": "same-origin"
        }
      }
    );
    expect(remove.status).toBe(200);

    expect(auditEvents.map((event) => event.actionType)).toEqual([
      "occupancy.calendar_created",
      "occupancy.event_created",
      "occupancy.event_updated",
      "occupancy.event_removed"
    ]);
  });

  it("rejects invalid event ranges with a stable error", async () => {
    const { dataSource } = createTestDataSource();
    const app = createApp({ dataSource });

    const response = await app.request(
      `/api/workspace/resources/${engineer.id}/personal-calendar/events`,
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({
          title: "bad",
          startsAt: "2026-06-02T11:00:00.000Z",
          finishesAt: "2026-06-02T10:00:00.000Z"
        })
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "occupancy_event_invalid_range"
    });
  });

  it("defaults occupancy reads without resourceId to the actor instead of tenant-wide windows", async () => {
    const { dataSource } = createTestDataSource();
    const app = createApp({ dataSource });

    const adminEvent = await app.request(
      `/api/workspace/resources/${admin.id}/personal-calendar/events`,
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({
          title: "Админское окно",
          startsAt: "2026-06-02T09:00:00.000Z",
          finishesAt: "2026-06-02T10:00:00.000Z",
          visibility: "private"
        })
      }
    );
    expect(adminEvent.status).toBe(201);

    const engineerEvent = await app.request(
      `/api/workspace/resources/${engineer.id}/personal-calendar/events`,
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({
          title: "Инженерное окно",
          startsAt: "2026-06-02T11:00:00.000Z",
          finishesAt: "2026-06-02T12:00:00.000Z",
          visibility: "private"
        })
      }
    );
    expect(engineerEvent.status).toBe(201);

    const response = await app.request(
      "/api/workspace/occupancy?from=2026-06-02T00:00:00.000Z&to=2026-06-03T00:00:00.000Z",
      { headers: { cookie: `kiss_pm_session=${sessionToken}` } }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { occupancy: Array<{ resourceId: string; title: string }> };
    expect(body.occupancy).toEqual([
      expect.objectContaining({ resourceId: admin.id, title: "Админское окно" })
    ]);
  });
});
