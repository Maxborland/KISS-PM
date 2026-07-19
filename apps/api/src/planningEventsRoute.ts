import { canReadProjectPlan } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { AccessProfile } from "@kiss-pm/access-control";
import { subscribePlanningEvents, type PlanRealtimeEvent } from "./planningEventBus";
import { parseProjectIdParam } from "./routeParamParsers";

type PlanningEventsRouteDeps = {
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  /** Принадлежит ли проект тенанту актора. Без подтверждения подписку не открываем (SEC-001). */
  projectExistsInTenant(tenantId: string, projectId: string): Promise<boolean>;
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

    // SEC-001: событийная шина ключуется только по projectId (без тенанта), поэтому проверяем,
    // что проект принадлежит тенанту актора — иначе получили бы события чужого тенанта.
    const belongsToTenant = await deps.projectExistsInTenant(actor.tenantId, projectId);
    if (!belongsToTenant) return context.json({ error: "project_not_found" }, 404);

    const response = streamSSE(context, async (stream) => {
      const send = async (event: PlanRealtimeEvent) => {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event)
        });
      };

      const unsubscribe = subscribePlanningEvents(actor.tenantId, projectId, (event) => {
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
    // no-transform ОБЯЗАТЕЛЕН: web-прокси (Next compress и любой gzip-посредник)
    // иначе сжимает бесконечный event-stream и буферизует кадры до закрытия
    // соединения — браузер не получает события вовсе. Ставим на готовом Response:
    // hono streamSSE сам пишет "Cache-Control: no-cache" поверх c.header().
    response.headers.set("Cache-Control", "no-cache, no-transform");
    return response;
  });
}
