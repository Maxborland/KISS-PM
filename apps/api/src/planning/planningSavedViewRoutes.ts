import {
  canManageProjectPlan,
  canReadProjectPlan
} from "@kiss-pm/access-control";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import { readLimitedJsonBody } from "../jsonBody";
import {
  parseProjectRouteParam,
  parseSavedViewRouteParam,
  requireActivePlanningProject,
  requireReadablePlanningProject,
  type PlanningRouteDeps
} from "./planningRouteHelpers";
import { registerPlanningSavedViewListRoute } from "./planningSavedViewListRoute";
import { parsePlanningSavedViewPayload } from "./planningSavedViewPayload";

export function registerPlanningSavedViewRoutes(
  app: Hono,
  deps: PlanningRouteDeps
) {
  registerPlanningSavedViewListRoute(app, deps);

  app.post("/api/workspace/projects/:projectId/planning/saved-views", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.createSavedView) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = canManageProjectPlan({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const projectId = parsedProjectId.value;
    const activeProject = await requireActivePlanningProject(
      deps.dataSource,
      actor.tenantId,
      projectId
    );
    if (!activeProject.ok) return context.json({ error: activeProject.error }, activeProject.status);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const record = body.value as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const scope = record.scope === "project" ? "project" : "user";
    const rawPayload =
      record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
        ? (record.payload as Record<string, unknown>)
        : null;
    const payload = parsePlanningSavedViewPayload(rawPayload);
    if (!name || !payload) return context.json({ error: "saved_view_invalid" }, 400);

    const view = await deps.dataSource.createSavedView({
      id: `saved-view-${randomUUID()}`,
      tenantId: actor.tenantId,
      projectId,
      ownerUserId: actor.id,
      scope,
      name,
      payload
    });
    return context.json({ savedView: view }, 201);
  });

  app.delete(
    "/api/workspace/projects/:projectId/planning/saved-views/:viewId",
    async (context) => {
      const parsedProjectId = parseProjectRouteParam(context);
      if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);
      const parsedViewId = parseSavedViewRouteParam(context);
      if (!parsedViewId.ok) return context.json({ error: parsedViewId.error }, 400);

      const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (!deps.dataSource.deleteSavedView) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }
      const profile = await deps.getActorProfile(actor);
      const decision = canManageProjectPlan({
        actor,
        profile,
        targetTenantId: actor.tenantId
      });
      if (!decision.allowed) return context.json({ error: decision.reason }, 403);

      const activeProject = await requireActivePlanningProject(
        deps.dataSource,
        actor.tenantId,
        parsedProjectId.value
      );
      if (!activeProject.ok) return context.json({ error: activeProject.error }, activeProject.status);
      const deleted = await deps.dataSource.deleteSavedView(
        actor.tenantId,
        parsedProjectId.value,
        parsedViewId.value,
        actor.id
      );
      if (!deleted) return context.json({ error: "saved_view_not_found" }, 404);
      return context.json({ ok: true });
    }
  );
}
