import {
  canManageProjectResources,
  canReadProjectResources,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { OccupancyWindow, ResourceCalendarEvent, TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "./apiTypes";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "./jsonBody";
import { parseUserIdParam } from "./routeParamParsers";

type OccupancyRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

type EventBody = {
  title: string | null;
  startsAt: Date;
  finishesAt: Date;
  workMinutes: number | null;
  capacityImpact: "busy" | "unavailable" | "tentative";
  visibility: "public" | "busy_only" | "private";
  metadata: Record<string, unknown>;
};

const maxOccupancyRangeDays = 370;
const maxTitleLength = 200;

export function registerOccupancyRoutes(app: Hono, deps: OccupancyRouteDeps): void {
  app.get("/api/workspace/resources/:resourceId/personal-calendar", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resourceId = parseUserIdParam(context.req.param("resourceId"));
    if (!resourceId.ok) return context.json({ error: "occupancy_invalid_query" }, 400);

    const profile = await deps.getActorProfile(actor);
    const decision = readCalendarDecision(actor, profile, resourceId.value);
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    if (!deps.dataSource.findPersonalCalendar || !deps.dataSource.listPersonalCalendarEvents) {
      return context.json({ error: "occupancy_not_configured" }, 501);
    }

    const range = parseRange(context.req.query("from"), context.req.query("to"));
    if (!range.ok) return context.json({ error: range.error }, 400);

    const calendar = await deps.dataSource.findPersonalCalendar({
      tenantId: actor.tenantId,
      userId: resourceId.value
    });
    const events = await deps.dataSource.listPersonalCalendarEvents({
      tenantId: actor.tenantId,
      userId: resourceId.value,
      from: range.value.from,
      to: range.value.to
    });

    return context.json({
      calendar: calendar ?? null,
      events: events.map((event) => serializeCalendarEvent(event, actor.id === resourceId.value))
    });
  });

  app.post("/api/workspace/resources/:resourceId/personal-calendar/events", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resourceId = parseUserIdParam(context.req.param("resourceId"));
    if (!resourceId.ok) return context.json({ error: "occupancy_invalid_query" }, 400);

    const profile = await deps.getActorProfile(actor);
    const decision = writeCalendarDecision(actor, profile, resourceId.value);
    if (!decision.allowed) {
      await appendDeniedAudit(deps, actor, resourceId.value, decision, "event.create");
      return context.json({ error: decision.reason }, 403);
    }
    if (!deps.dataSource.ensureManualPersonalCalendar || !deps.dataSource.createPersonalCalendarEvent) {
      return context.json({ error: "occupancy_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseEventBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const created = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.ensureManualPersonalCalendar || !transactionDataSource.createPersonalCalendarEvent) {
        throw new Error("occupancy_not_configured");
      }
      const existingCalendar = transactionDataSource.findPersonalCalendar
        ? await transactionDataSource.findPersonalCalendar({
            tenantId: actor.tenantId,
            userId: resourceId.value
          })
        : undefined;
      const calendar = await transactionDataSource.ensureManualPersonalCalendar({
        tenantId: actor.tenantId,
        userId: resourceId.value,
        createdByUserId: actor.id
      });
      if (!existingCalendar) {
        await deps.appendManagementAuditEvent(occupancyAudit({
          actor,
          actionType: "occupancy.calendar_created",
          resourceId: resourceId.value,
          commandInput: { id: calendar.id, userId: calendar.userId, sourceProvider: calendar.sourceProvider },
          afterState: {
            id: calendar.id,
            userId: calendar.userId,
            sourceProvider: calendar.sourceProvider,
            syncStatus: calendar.syncStatus
          },
          permissionResult: decision
        }), transactionDataSource);
      }
      const event = await transactionDataSource.createPersonalCalendarEvent({
        id: `calendar-event-${randomUUID()}`,
        tenantId: actor.tenantId,
        calendarId: calendar.id,
        userId: resourceId.value,
        ...parsed.value,
        createdByUserId: actor.id
      });
      await deps.appendManagementAuditEvent(occupancyAudit({
        actor,
        actionType: "occupancy.event_created",
        resourceId: resourceId.value,
        commandInput: safeEventAuditInput(event),
        afterState: safeEventAuditInput(event),
        permissionResult: decision
      }), transactionDataSource);
      return event;
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ event: serializeCalendarEvent(created, true) }, 201);
  });

  app.patch("/api/workspace/resources/:resourceId/personal-calendar/events/:eventId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resourceId = parseUserIdParam(context.req.param("resourceId"));
    const eventId = parseCalendarEventIdParam(context.req.param("eventId"));
    if (!resourceId.ok || !eventId.ok) return context.json({ error: "occupancy_invalid_query" }, 400);

    const profile = await deps.getActorProfile(actor);
    const decision = writeCalendarDecision(actor, profile, resourceId.value);
    if (!decision.allowed) {
      await appendDeniedAudit(deps, actor, resourceId.value, decision, "event.update");
      return context.json({ error: decision.reason }, 403);
    }
    if (!deps.dataSource.updatePersonalCalendarEvent) {
      return context.json({ error: "occupancy_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseEventBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const updated = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updatePersonalCalendarEvent) {
        throw new Error("occupancy_not_configured");
      }
      const event = await transactionDataSource.updatePersonalCalendarEvent({
        tenantId: actor.tenantId,
        eventId: eventId.value,
        userId: resourceId.value,
        ...parsed.value
      });
      if (!event) return null;
      await deps.appendManagementAuditEvent(occupancyAudit({
        actor,
        actionType: "occupancy.event_updated",
        resourceId: resourceId.value,
        commandInput: safeEventAuditInput(event),
        afterState: safeEventAuditInput(event),
        permissionResult: decision
      }), transactionDataSource);
      return event;
    });
    if (!updated) return context.json({ error: "occupancy_event_not_found" }, 404);

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ event: serializeCalendarEvent(updated, true) });
  });

  app.delete("/api/workspace/resources/:resourceId/personal-calendar/events/:eventId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const resourceId = parseUserIdParam(context.req.param("resourceId"));
    const eventId = parseCalendarEventIdParam(context.req.param("eventId"));
    if (!resourceId.ok || !eventId.ok) return context.json({ error: "occupancy_invalid_query" }, 400);

    const profile = await deps.getActorProfile(actor);
    const decision = writeCalendarDecision(actor, profile, resourceId.value);
    if (!decision.allowed) {
      await appendDeniedAudit(deps, actor, resourceId.value, decision, "event.remove");
      return context.json({ error: decision.reason }, 403);
    }
    if (!deps.dataSource.archivePersonalCalendarEvent) {
      return context.json({ error: "occupancy_not_configured" }, 501);
    }

    const removed = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.archivePersonalCalendarEvent) {
        throw new Error("occupancy_not_configured");
      }
      const event = await transactionDataSource.archivePersonalCalendarEvent({
        tenantId: actor.tenantId,
        eventId: eventId.value,
        userId: resourceId.value
      });
      if (!event) return null;
      await deps.appendManagementAuditEvent(occupancyAudit({
        actor,
        actionType: "occupancy.event_removed",
        resourceId: resourceId.value,
        commandInput: { id: event.id, userId: event.userId },
        afterState: null,
        permissionResult: decision
      }), transactionDataSource);
      return event;
    });
    if (!removed) return context.json({ error: "occupancy_event_not_found" }, 404);

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ ok: true });
  });

  app.get("/api/workspace/occupancy", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listOccupancyWindows) {
      return context.json({ error: "occupancy_not_configured" }, 501);
    }

    const rawResourceId = context.req.query("resourceId")?.trim();
    const resourceId = rawResourceId ? parseUserIdParam(rawResourceId) : undefined;
    if (resourceId && !resourceId.ok) return context.json({ error: "occupancy_invalid_query" }, 400);
    const profile = await deps.getActorProfile(actor);
    const effectiveResourceId = resourceId?.value ?? actor.id;
    const canReadOwn = effectiveResourceId === actor.id;
    const decision = canReadOwn
      ? { allowed: true as const, reason: "same_tenant_permission_granted" }
      : canReadProjectResources({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const range = parseRange(context.req.query("from"), context.req.query("to"));
    if (!range.ok) return context.json({ error: range.error }, 400);

    const windows = await deps.dataSource.listOccupancyWindows({
      tenantId: actor.tenantId,
      resourceId: effectiveResourceId,
      from: range.value.from,
      to: range.value.to
    });

    return context.json({
      occupancy: windows.map((window) => serializeOccupancyWindow(window, window.resourceId === actor.id))
    });
  });
}

function readCalendarDecision(actor: TenantUser, profile: AccessProfile, resourceId: string): PolicyDecision {
  if (actor.id === resourceId) return { allowed: true, reason: "same_tenant_permission_granted" };
  return canReadProjectResources({ actor, profile, targetTenantId: actor.tenantId });
}

function writeCalendarDecision(actor: TenantUser, profile: AccessProfile, resourceId: string): PolicyDecision {
  if (actor.id === resourceId) return { allowed: true, reason: "same_tenant_permission_granted" };
  return canManageProjectResources({ actor, profile, targetTenantId: actor.tenantId });
}

function parseRange(fromRaw: string | undefined, toRaw: string | undefined):
  | { ok: true; value: { from: Date; to: Date } }
  | { ok: false; error: string } {
  const from = parseDateTime(fromRaw);
  const to = parseDateTime(toRaw);
  if (!from || !to || to <= from) return { ok: false, error: "occupancy_invalid_query" };
  if ((to.getTime() - from.getTime()) / 86_400_000 > maxOccupancyRangeDays) {
    return { ok: false, error: "occupancy_invalid_query" };
  }
  return { ok: true, value: { from, to } };
}

function parseEventBody(input: unknown): { ok: true; value: EventBody } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "occupancy_event_invalid" };
  }
  const record = input as Record<string, unknown>;
  const startsAt = parseDateTime(record.startsAt);
  const finishesAt = parseDateTime(record.finishesAt);
  if (!startsAt || !finishesAt || finishesAt <= startsAt) {
    return { ok: false, error: "occupancy_event_invalid_range" };
  }
  const title = record.title === null || record.title === undefined
    ? null
    : typeof record.title === "string"
      ? record.title.trim()
      : undefined;
  if (title === undefined || (title && (title.length > maxTitleLength || hasControlChars(title)))) {
    return { ok: false, error: "occupancy_event_invalid" };
  }
  const capacityImpact = parseEnum(record.capacityImpact, ["busy", "unavailable", "tentative"] as const) ?? "busy";
  const visibility = parseEnum(record.visibility, ["public", "busy_only", "private"] as const) ?? "busy_only";
  const workMinutes = record.workMinutes === null || record.workMinutes === undefined
    ? null
    : typeof record.workMinutes === "number" && Number.isInteger(record.workMinutes) && record.workMinutes >= 0
      ? record.workMinutes
      : undefined;
  if (workMinutes === undefined) return { ok: false, error: "occupancy_event_invalid" };
  return {
    ok: true,
    value: {
      title: title || null,
      startsAt,
      finishesAt,
      workMinutes,
      capacityImpact,
      visibility,
      metadata: {}
    }
  };
}

function parseDateTime(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? value as T[number]
    : undefined;
}

function parseCalendarEventIdParam(value: unknown): { ok: true; value: string } | { ok: false } {
  if (typeof value !== "string") return { ok: false };
  const normalized = value.trim();
  if (!/^calendar-event-[a-f0-9-]{36}$/.test(normalized)) return { ok: false };
  return { ok: true, value: normalized };
}

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function serializeCalendarEvent(event: ResourceCalendarEvent, canSeeDetails: boolean) {
  return {
    id: event.id,
    calendarId: event.calendarId,
    userId: event.userId,
    title: canSeeDetails ? event.title : "Занято",
    startsAt: event.startsAt.toISOString(),
    finishesAt: event.finishesAt.toISOString(),
    workMinutes: event.workMinutes,
    capacityImpact: event.capacityImpact,
    visibility: event.visibility,
    sourceProvider: event.sourceProvider
  };
}

function serializeOccupancyWindow(window: OccupancyWindow, canSeeDetails: boolean) {
  const showDetails = canSeeDetails || window.visibility === "public";
  return {
    id: window.id,
    resourceId: window.resourceId,
    sourceType: window.sourceType,
    sourceId: showDetails ? window.sourceId : null,
    startsAt: window.startsAt,
    finishesAt: window.finishesAt,
    workMinutes: window.workMinutes ?? null,
    capacityImpact: window.capacityImpact,
    visibility: window.visibility,
    title: showDetails ? window.title : "Занято",
    entityType: showDetails ? window.entityType : null,
    entityId: showDetails ? window.entityId : null
  };
}

function occupancyAudit(input: {
  actor: TenantUser;
  actionType: string;
  resourceId: string;
  commandInput: Record<string, unknown>;
  afterState?: Record<string, unknown> | null;
  permissionResult: PolicyDecision;
}): ManagementAuditEventInput {
  return {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "calendar_occupancy_v2",
    sourceEntity: { type: "resource_calendar", id: input.resourceId },
    commandInput: input.commandInput,
    beforeState: null,
    afterState: input.afterState ?? null,
    permissionResult: input.permissionResult
  };
}

async function appendDeniedAudit(
  deps: OccupancyRouteDeps,
  actor: TenantUser,
  resourceId: string,
  decision: PolicyDecision,
  command: string
): Promise<void> {
  await deps.appendManagementAuditEvent(occupancyAudit({
    actor,
    actionType: "occupancy.denied",
    resourceId,
    commandInput: { command, resourceId },
    permissionResult: decision
  }));
}

function safeEventAuditInput(event: ResourceCalendarEvent): Record<string, unknown> {
  return {
    id: event.id,
    userId: event.userId,
    sourceProvider: event.sourceProvider,
    startsAt: event.startsAt.toISOString(),
    finishesAt: event.finishesAt.toISOString(),
    workMinutes: event.workMinutes,
    capacityImpact: event.capacityImpact,
    visibility: event.visibility
  };
}
