import { canReadAuditEvents } from "@kiss-pm/access-control";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import { parseProjectIdParam } from "./routeParamParsers";

const defaultAuditReadLimit = 100;
const maxAuditReadLimit = 100;

export function registerAuditRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const { dataSource, getActorProfile, getSessionActorFromHeaders } = deps;

  app.get("/api/tenant/current/audit-events", async (context) => {
    const projectId = parseAuditProjectFilter(context.req.query("projectId"));
    if (projectId === false) {
      return context.json({ error: "invalid_project_id" }, 400);
    }
    const limit = parseAuditLimit(context.req.query("limit"));
    if (limit === null) {
      return context.json({ error: "invalid_audit_limit" }, 400);
    }

    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    if (!dataSource.listAuditEventsByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canReadAuditEvents({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const filtered = await dataSource.listAuditEventsByTenantId(actor.tenantId, {
      limit,
      projectId
    });

    return context.json({
      auditEvents: filtered.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString()
      }))
    });
  });

  // Точечная выборка события: адресуемые квитанции агента (auditEventId/correlationId)
  // не должны зависеть от окна limit ленты. Тот же RBAC, что и у списка.
  app.get("/api/tenant/current/audit-events/:auditEventId", async (context) => {
    const auditEventId = context.req.param("auditEventId").trim();
    if (auditEventId.length === 0 || auditEventId.length > 128) {
      return context.json({ error: "invalid_audit_event_id" }, 400);
    }

    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }
    if (!dataSource.getAuditEventById) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canReadAuditEvents({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const event = await dataSource.getAuditEventById(actor.tenantId, auditEventId);
    if (!event) return context.json({ error: "audit_event_not_found" }, 404);
    return context.json({
      auditEvent: { ...event, createdAt: event.createdAt.toISOString() }
    });
  });
}

function parseAuditProjectFilter(value: string | undefined): string | null | false {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = parseProjectIdParam(normalized);
  return parsed.ok ? parsed.value : false;
}

function parseAuditLimit(value: string | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) return defaultAuditReadLimit;
  if (!/^(0|[1-9]\d*)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxAuditReadLimit) {
    return null;
  }
  return parsed;
}
