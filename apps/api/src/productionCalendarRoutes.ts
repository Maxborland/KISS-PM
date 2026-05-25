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
import { readLimitedJsonBody } from "./jsonBody";

type ProductionCalendarRouteDeps = {
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

function parseYear(value: string | undefined): number | null {
  if (!value) return new Date().getUTCFullYear();
  const year = Number.parseInt(value, 10);
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
  const items: TenantProductionCalendarBulkItem[] = [];
  for (const entry of exceptions) {
    if (!entry || typeof entry !== "object") return { ok: false, error: "production_calendar_invalid" };
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : randomUUID();
    const date = typeof row.date === "string" ? row.date.trim() : "";
    const workingMinutes = typeof row.workingMinutes === "number" ? row.workingMinutes : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || workingMinutes === null || workingMinutes < 0) {
      return { ok: false, error: "production_calendar_invalid" };
    }
    items.push({
      id,
      date,
      workingMinutes,
      reason: typeof row.reason === "string" ? row.reason : null,
      resourceId:
        row.resourceId === null || row.resourceId === undefined
          ? null
          : typeof row.resourceId === "string"
            ? row.resourceId
            : null
    });
  }
  return { ok: true, value: items };
}

export function registerProductionCalendarRoutes(
  app: Hono,
  deps: ProductionCalendarRouteDeps
) {
  app.get("/api/tenant/current/production-calendar", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const db = resolveDb(deps.dataSource);
    if (!db) return context.json({ error: "persistence_not_configured" }, 501);

    const profile = await deps.getActorProfile(actor);
    const decision = canReadWorkspaceConfig({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const year = parseYear(context.req.query("year"));
    if (year === null) return context.json({ error: "production_calendar_invalid" }, 400);

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

    const repository = createTenantProductionCalendarRepository(db);
    await repository.bulkUpsertExceptions(actor.tenantId, parsed.value);

    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "tenant.production_calendar.updated",
      sourceWorkflow: "workspace_config",
      sourceEntity: { type: "tenant_production_calendar", id: "tenant-default" },
      commandInput: { exceptionCount: parsed.value.length },
      beforeState: null,
      afterState: { exceptionCount: parsed.value.length },
      permissionResult: decision
    });

    const year = new Date().getUTCFullYear();
    return context.json(await repository.getProductionCalendar(actor.tenantId, year));
  });
}
