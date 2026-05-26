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
import { parseAbsenceIdParam, parseUserIdParam } from "./routeParamParsers";

type AbsencesRouteDeps = {
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

const maxAbsenceReasonLength = 500;
const maxAbsenceRangeDays = 370;

function resolveDb(dataSource: ApiTenantDataSource): KissPmDatabase | null {
  if ("db" in dataSource && dataSource.db) {
    return dataSource.db as KissPmDatabase;
  }
  return null;
}

function parseIsoDate(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const timestamp = isoDateToUtcDay(normalized);
  if (timestamp === null) return null;
  return normalized;
}

function isoDateToUtcDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(timestamp / 86_400_000);
}

function isValidAbsenceRange(fromDate: string, toDate: string): boolean {
  const fromDay = isoDateToUtcDay(fromDate);
  const toDay = isoDateToUtcDay(toDate);
  if (fromDay === null || toDay === null || toDay < fromDay) return false;
  return toDay - fromDay + 1 <= maxAbsenceRangeDays;
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
  const userId = parseUserIdParam(row.userId);
  const type = typeof row.type === "string" ? row.type.trim() : "";
  const dateFrom = typeof row.dateFrom === "string" ? row.dateFrom.trim() : "";
  const dateTo = typeof row.dateTo === "string" ? row.dateTo.trim() : "";
  const reason =
    row.reason === null || row.reason === undefined
      ? null
      : typeof row.reason === "string"
        ? row.reason.trim() || null
        : null;
  if (!userId.ok) {
    return { ok: false, error: "invalid_user_id" };
  }
  if (!isAbsenceType(type) || !parseIsoDate(dateFrom) || !parseIsoDate(dateTo)) {
    return { ok: false, error: "resource_absence_invalid" };
  }
  if (!isValidAbsenceRange(dateFrom, dateTo)) {
    return { ok: false, error: "resource_absence_invalid_range" };
  }
  if (reason && (reason.length > maxAbsenceReasonLength || /[\u0000-\u001f\u007f]/.test(reason))) {
    return { ok: false, error: "resource_absence_invalid" };
  }
  if (row.reason !== null && row.reason !== undefined && typeof row.reason !== "string") {
    return { ok: false, error: "resource_absence_invalid" };
  }
  return {
    ok: true,
    value: { userId: userId.value, type, dateFrom, dateTo, reason }
  };
}

export function registerAbsencesRoutes(app: Hono, deps: AbsencesRouteDeps) {
  app.get("/api/tenant/current/absences", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);
    if (!deps.dataSource.withTransaction || !deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

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
    if (!isValidAbsenceRange(fromDate, toDate)) {
      return context.json({ error: "resource_absence_invalid_range" }, 400);
    }

    const rawUserId = context.req.query("userId")?.trim() || undefined;
    const userId = rawUserId ? parseUserIdParam(rawUserId) : undefined;
    if (userId && !userId.ok) {
      return context.json({ error: userId.error }, 400);
    }
    const repository = createResourceAbsencesRepository(db);
    const absences = await repository.listAbsences(
      actor.tenantId,
      fromDate,
      toDate,
      userId?.value
    );
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

    const absence = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const transactionDb = resolveDb(transactionDataSource);
      if (!transactionDb) {
        throw new Error("transactional_absence_create_not_configured");
      }
      const repository = createResourceAbsencesRepository(transactionDb);
      const created = await repository.createAbsence({
        id: randomUUID(),
        tenantId: actor.tenantId,
        userId: parsed.value.userId,
        type: parsed.value.type,
        dateFrom: parsed.value.dateFrom,
        dateTo: parsed.value.dateTo,
        reason: parsed.value.reason,
        createdBy: actor.id
      });

      await deps.appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "tenant.absence.created",
          sourceWorkflow: "tenant.absences",
          sourceEntity: { type: "resource_absence", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        },
        transactionDataSource
      );

      return created;
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ absence }, 201);
  });

  app.delete("/api/tenant/current/absences/:id", async (context) => {
    const parsedAbsenceId = parseAbsenceIdParam(context.req.param("id"));
    if (!parsedAbsenceId.ok) {
      return context.json({ error: parsedAbsenceId.error }, 400);
    }

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);
    if (!deps.dataSource.withTransaction || !deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await deps.getActorProfile(actor);
    const decision = canManageAbsences({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const absenceId = parsedAbsenceId.value;

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const transactionDb = resolveDb(transactionDataSource);
      if (!transactionDb) {
        throw new Error("transactional_absence_delete_not_configured");
      }
      const repository = createResourceAbsencesRepository(transactionDb);
      const existing = (
        await repository.listAbsences(actor.tenantId, "1970-01-01", "2999-12-31")
      ).find((item) => item.id === absenceId);
      const deleted = await repository.deleteAbsence(actor.tenantId, absenceId);
      if (!deleted) return { deleted: false };

      await deps.appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "tenant.absence.deleted",
          sourceWorkflow: "tenant.absences",
          sourceEntity: { type: "resource_absence", id: absenceId },
          commandInput: { id: absenceId },
          beforeState: existing ?? null,
          afterState: null,
          permissionResult: decision
        },
        transactionDataSource
      );

      return { deleted: true };
    });
    if (!result.deleted) return context.json({ error: "resource_absence_not_found" }, 404);

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ ok: true });
  });
}
