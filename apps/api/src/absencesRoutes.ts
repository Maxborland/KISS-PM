import {
  canManageAbsences,
  canReadAbsences,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import {
  createResourceAbsencesRepository,
  RESOURCE_ABSENCE_TYPES,
  type KissPmDatabase,
  type ResourceAbsenceType
} from "@kiss-pm/persistence";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "./apiTypes";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "./jsonBody";

type AbsencesRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  appendManagementAuditEvent(input: ManagementAuditEventInput): Promise<string>;
};

function resolveDb(dataSource: ApiTenantDataSource): KissPmDatabase | null {
  if ("db" in dataSource && dataSource.db) {
    return dataSource.db as KissPmDatabase;
  }
  return null;
}

function parseIsoDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  return value.trim();
}

function isAbsenceType(value: string): value is ResourceAbsenceType {
  return (RESOURCE_ABSENCE_TYPES as readonly string[]).includes(value);
}

function parseCreateBody(input: unknown):
  | {
      ok: true;
      value: {
        userId: string;
        type: ResourceAbsenceType;
        dateFrom: string;
        dateTo: string;
        reason: string | null;
      };
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "resource_absence_invalid" };
  }
  const row = input as Record<string, unknown>;
  const userId = typeof row.userId === "string" ? row.userId.trim() : "";
  const type = typeof row.type === "string" ? row.type.trim() : "";
  const dateFrom = typeof row.dateFrom === "string" ? row.dateFrom.trim() : "";
  const dateTo = typeof row.dateTo === "string" ? row.dateTo.trim() : "";
  const reason =
    row.reason === null || row.reason === undefined
      ? null
      : typeof row.reason === "string"
        ? row.reason.trim() || null
        : null;
  if (!userId || !isAbsenceType(type) || !parseIsoDate(dateFrom) || !parseIsoDate(dateTo)) {
    return { ok: false, error: "resource_absence_invalid" };
  }
  if (dateTo < dateFrom) {
    return { ok: false, error: "resource_absence_invalid_range" };
  }
  return {
    ok: true,
    value: { userId, type, dateFrom, dateTo, reason }
  };
}

export function registerAbsencesRoutes(app: Hono, deps: AbsencesRouteDeps) {
  app.get("/api/tenant/current/absences", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);

    const profile = await deps.getActorProfile(actor);
    const decision = canReadAbsences({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const fromDate = parseIsoDate(context.req.query("fromDate"));
    const toDate = parseIsoDate(context.req.query("toDate"));
    if (!fromDate || !toDate) {
      return context.json({ error: "resource_absence_invalid_range" }, 400);
    }

    const userId = context.req.query("userId")?.trim() || undefined;
    const repository = createResourceAbsencesRepository(db);
    const absences = await repository.listAbsences(actor.tenantId, fromDate, toDate, userId);
    return context.json({ absences });
  });

  app.post("/api/tenant/current/absences", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);

    const profile = await deps.getActorProfile(actor);
    const decision = canManageAbsences({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const repository = createResourceAbsencesRepository(db);
    const absence = await repository.createAbsence({
      id: randomUUID(),
      tenantId: actor.tenantId,
      userId: parsed.value.userId,
      type: parsed.value.type,
      dateFrom: parsed.value.dateFrom,
      dateTo: parsed.value.dateTo,
      reason: parsed.value.reason,
      createdBy: actor.id
    });

    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "tenant.absence.created",
      sourceWorkflow: "tenant.absences",
      sourceEntity: { type: "resource_absence", id: absence.id },
      commandInput: parsed.value,
      beforeState: null,
      afterState: absence,
      permissionResult: decision
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ absence }, 201);
  });

  app.delete("/api/tenant/current/absences/:id", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);

    const profile = await deps.getActorProfile(actor);
    const decision = canManageAbsences({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const absenceId = context.req.param("id")?.trim();
    if (!absenceId) return context.json({ error: "resource_absence_invalid" }, 400);

    const repository = createResourceAbsencesRepository(db);
    const existing = (
      await repository.listAbsences(actor.tenantId, "1970-01-01", "2999-12-31")
    ).find((item) => item.id === absenceId);
    const deleted = await repository.deleteAbsence(actor.tenantId, absenceId);
    if (!deleted) return context.json({ error: "resource_absence_not_found" }, 404);

    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "tenant.absence.deleted",
      sourceWorkflow: "tenant.absences",
      sourceEntity: { type: "resource_absence", id: absenceId },
      commandInput: { id: absenceId },
      beforeState: existing ?? null,
      afterState: null,
      permissionResult: decision
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ ok: true });
  });
}
