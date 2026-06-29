import type { ApiApp, ApiRouteDeps } from "../routeTypes";
import { listToolAvailability } from "./toolRegistry";

/**
 * Маршруты агента (P-agent). Slice 1: каталог инструментов под права актора.
 * Slice 2 добавит POST /propose (LLM-цикл), slice 3 — POST /execute (governed apply).
 */
export function registerAgentRoutes(app: ApiApp, deps: ApiRouteDeps) {
  // Набор инструментов агента с разметкой доступности под права текущего сотрудника.
  app.get("/api/workspace/agent/tools", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    return context.json({ tools: listToolAvailability(actor, profile) });
  });
}
