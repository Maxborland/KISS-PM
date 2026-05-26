import {
  canManageWorkspaceConfig,
  canReadWorkspaceConfig,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import {
  createTenantProductionCalendarRepository,
  type KissPmDatabase,
  type TenantProductionCalendarBulkItem
} from "@kiss-pm/persistence";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "./apiTypes";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "./jsonBody";
import { parseUserIdParam } from "./routeParamParsers";

type ProductionCalendarRouteDeps = {
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

function resolveDb(dataSource: ApiTenantDataSource): KissPmDatabase | null {
  if ("db" in dataSource && dataSource.db) {
    return dataSource.db as KissPmDatabase;
  }
  return null;
}

function parseYear(value: string | undefined): number | null {
  if (!value) return new Date().getUTCFullYear();
  const normalized = value.trim();
  if (!/^\d{4}$/.test(normalized)) return null;
  const year = Number.parseInt(normalized, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return year;
}

function parseBulkBody(input: unknown):
  | { ok: true; value: TenantProductionCalendarBulkItem[] }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || !Array.isArray((input as { exceptions?: unknown }).exceptions)) {
    return { ok: false, error: "production_calendar_invalid" };
  }
  const exceptions = (input as { exceptions: unknown[] }).exceptions;
  if (exceptions.length > 500) return { ok: false, error: "production_calendar_invalid" };
  const items: TenantProductionCalendarBulkItem[] = [];
  for (const entry of exceptions) {
    if (!entry || typeof entry !== "object") return { ok: false, error: "production_calendar_invalid" };
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : randomUUID();
    const date = typeof row.date === "string" ? row.date.trim() : "";
    const workingMinutes = typeof row.workingMinutes === "number" ? row.workingMinutes : null;
    if (
      !isSafeCalendarIdentifier(id) ||
      !isValidCalendarDate(date) ||
      workingMinutes === null ||
      !Number.isInteger(workingMinutes) ||
      workingMinutes < 0 ||
      workingMinutes > 1_440
    ) {
      return { ok: false, error: "production_calendar_invalid" };
    }
    const resourceId = parseOptionalResourceId(row.resourceId);
    if (resourceId === false) return { ok: false, error: "production_calendar_invalid" };
    const reason = parseOptionalReason(row.reason);
    if (reason === false) return { ok: false, error: "production_calendar_invalid" };
    items.push({
      id,
      date,
      workingMinutes,
      reason,
      resourceId
    });
  }
  return { ok: true, value: items };
}

function isSafeCalendarIdentifier(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{2,119}$/.test(value);
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseOptionalResourceId(value: unknown): string | null | false {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return false;
  const parsed = parseUserIdParam(value.trim());
  return parsed.ok ? parsed.value : false;
}

function parseOptionalReason(value: unknown): string | null | false {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (normalized.length > 240 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    return false;
  }
  return normalized || null;
}

export function registerProductionCalendarRoutes(
  app: Hono,
  deps: ProductionCalendarRouteDeps
) {
  app.get("/api/tenant/current/production-calendar", async (context) => {
    const year = parseYear(context.req.query("year"));
    if (year === null) return context.json({ error: "production_calendar_invalid" }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);
    if (!deps.dataSource.withTransaction || !deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await deps.getActorProfile(actor);
    const decision = canReadWorkspaceConfig({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const repository = createTenantProductionCalendarRepository(db);
    return context.json(await repository.getProductionCalendar(actor.tenantId, year));
  });

  app.post("/api/tenant/current/production-calendar/bulk", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);

    const profile = await deps.getActorProfile(actor);
    const decision = canManageWorkspaceConfig({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseBulkBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    await deps.runDataSourceTransaction(async (transactionDataSource) => {
      const transactionDb = resolveDb(transactionDataSource);
      if (!transactionDb) {
        throw new Error("transactional_production_calendar_not_configured");
      }
      const repository = createTenantProductionCalendarRepository(transactionDb);
      await repository.bulkUpsertExceptions(actor.tenantId, parsed.value);

      await deps.appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "tenant.production_calendar.updated",
          sourceWorkflow: "workspace_config",
          sourceEntity: { type: "tenant_production_calendar", id: "tenant-default" },
          commandInput: { exceptionCount: parsed.value.length },
          beforeState: null,
          afterState: { exceptionCount: parsed.value.length },
          permissionResult: decision
        },
        transactionDataSource
      );
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    const repository = createTenantProductionCalendarRepository(db);
    const year = new Date().getUTCFullYear();
    return context.json(await repository.getProductionCalendar(actor.tenantId, year));
  });
}
