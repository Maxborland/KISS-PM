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

    const projectId = context.req.query("projectId");
    const auditEvents = await dataSource.listAuditEventsByTenantId(actor.tenantId);
    const filtered = projectId
      ? await filterAuditEventsByProject(dataSource, actor.tenantId, projectId, auditEvents)
      : auditEvents;

    return context.json({
      auditEvents: filtered.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString()
      }))
    });
  });
}

async function filterAuditEventsByProject(
  dataSource: ApiRouteDeps["dataSource"],
  tenantId: string,
  projectId: string,
  auditEvents: Awaited<ReturnType<NonNullable<ApiRouteDeps["dataSource"]["listAuditEventsByTenantId"]>>>
) {
  const projectTasks = (await dataSource.listProjectTasks?.(tenantId, projectId)) ?? [];
  const projectTaskIds = new Set(projectTasks.map((task) => task.id));
  return auditEvents.filter((event) => {
    if (event.sourceEntity?.type === "Project" && event.sourceEntity.id === projectId) {
      return true;
    }
    return event.sourceEntity?.type === "Task" && projectTaskIds.has(String(event.sourceEntity.id));
  });
}
