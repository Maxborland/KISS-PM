import { canReadProjectPlan } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { AccessProfile } from "@kiss-pm/access-control";
import type { ApiTenantDataSource } from "./apiTypes";
import { requireReadablePlanningProject } from "./planning/planningRouteHelpers";
import { subscribePlanningEvents, type PlanRealtimeEvent } from "./planningEventBus";
import { parseProjectIdParam } from "./routeParamParsers";

type PlanningEventsRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
};

export function registerPlanningEventsRoute(app: Hono, deps: PlanningEventsRouteDeps) {
  app.get("/api/workspace/projects/:projectId/planning/events", async (context) => {
    const parsedProjectId = parseProjectIdParam(context.req.param("projectId"));
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const planDecision = canReadProjectPlan({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!planDecision.allowed) {
      return context.json({ error: planDecision.reason }, 403);
    }

    const projectId = parsedProjectId.value;
    const readableProject = await requireReadablePlanningProject(
      deps.dataSource,
      actor.tenantId,
      projectId
    );
    if (!readableProject.ok) return context.json({ error: readableProject.error }, readableProject.status);

    return streamSSE(context, async (stream) => {
      const send = async (event: PlanRealtimeEvent) => {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event)
        });
      };

      const unsubscribe = subscribePlanningEvents(projectId, (event) => {
        void send(event);
      });

      const heartbeat = setInterval(() => {
        void stream.writeSSE({ event: "heartbeat", data: "{}" });
      }, 15_000);

      try {
        await stream.sleep(60 * 60 * 1000);
      } finally {
        clearInterval(heartbeat);
        unsubscribe();
      }
    });
  });
}
