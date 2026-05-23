import { canReadProjectPlan } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { AccessProfile } from "@kiss-pm/access-control";
import { subscribePlanningEvents, type PlanRealtimeEvent } from "./planningEventBus";

type PlanningEventsRouteDeps = {
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
};

export function registerPlanningEventsRoute(app: Hono, deps: PlanningEventsRouteDeps) {
  app.get("/api/workspace/projects/:projectId/planning/events", async (context) => {
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

    const projectId = context.req.param("projectId");

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
