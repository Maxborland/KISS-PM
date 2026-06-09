import { canReadProjectPlan } from "@kiss-pm/access-control";
import type { Hono } from "hono";

import { parseProjectRouteParam, requireReadablePlanningProject, type PlanningRouteDeps } from "./planningRouteHelpers";

export function registerPlanningSavedViewListRoute(app: Hono, deps: PlanningRouteDeps) {
  app.get("/api/workspace/projects/:projectId/planning/saved-views", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listSavedViews) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const readDecision = canReadProjectPlan({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);

    const projectId = parsedProjectId.value;
    const readableProject = await requireReadablePlanningProject(
      deps.dataSource,
      actor.tenantId,
      projectId
    );
    if (!readableProject.ok) return context.json({ error: readableProject.error }, readableProject.status);
    const views = await deps.dataSource.listSavedViews(actor.tenantId, projectId, actor.id);
    return context.json({ savedViews: views });
  });
}
