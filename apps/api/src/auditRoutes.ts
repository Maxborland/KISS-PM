import { canReadAuditEvents } from "@kiss-pm/access-control";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";

export function registerAuditRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const { dataSource, getActorProfile, getSessionActorFromHeaders } = deps;

  app.get("/api/tenant/current/audit-events", async (context) => {
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

    const auditEvents = await dataSource.listAuditEventsByTenantId(actor.tenantId);

    return context.json({
      auditEvents: auditEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString()
      }))
    });
  });
}
