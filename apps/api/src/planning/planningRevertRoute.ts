import type { Hono } from "hono";
import type { PlanningCommand } from "@kiss-pm/domain";

import { invalidateCapacityCacheForTenant } from "../capacity/registerCapacityRoutes";
import { notifyPlanVersionChanged } from "../planningEventBus";
import { executeApplyPlanningCommand } from "./applyPlanningCommandHandler";
import { errorResponseBody, parseProjectRouteParam, type PlanningRouteDeps } from "./planningRouteHelpers";

// BUG-PROJ-24: откат последнего обратимого коммита плана. Проигрывает сохранённые
// компенсирующие команды как НОВЫЕ коммиты (PM-as-code: откат = компенсирующий коммит).
export function registerPlanningRevertRoute(app: Hono, deps: PlanningRouteDeps) {
  app.post("/api/workspace/projects/:projectId/planning/revert-last", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listAuditEventsByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const projectId = parsedProjectId.value;

    // Ищем последнее planning-событие проекта с непустыми компенсирующими командами.
    const events = await deps.dataSource.listAuditEventsByTenantId(actor.tenantId, { projectId, limit: 50 });
    const revertible = events.find((event) => {
      if (event.sourceWorkflow !== "planning") return false;
      const cc = (event.afterState as { compensatingCommands?: unknown } | null)?.compensatingCommands;
      return Array.isArray(cc) && cc.length > 0;
    });
    if (!revertible) {
      return context.json({ error: "nothing_to_revert" }, 409);
    }
    const compensating = (revertible.afterState as { compensatingCommands: PlanningCommand[] }).compensatingCommands;

    // Проигрываем компенсирующие команды последовательно (каждая — новый коммит).
    let lastBody: unknown = null;
    for (const command of compensating) {
      const snapshot = await deps.dataSource.getPlanSnapshot?.(actor.tenantId, projectId);
      if (!snapshot) return context.json({ error: "project_not_found" }, 404);
      const result = await executeApplyPlanningCommand({
        deps: {
          auditDataSource: deps.dataSource,
          runDataSourceTransaction: deps.runDataSourceTransaction,
          appendManagementAuditEvent: deps.appendManagementAuditEvent
        },
        actor,
        profile: await deps.getActorProfile(actor),
        projectId,
        envelope: { command, clientPlanVersion: snapshot.planVersion }
      });
      if (!result.ok) {
        if (result.status === 409) return context.json(errorResponseBody(result), 409);
        return context.json({ error: result.error }, result.status);
      }
      lastBody = result.body;
    }

    const newPlanVersion = (lastBody as { newPlanVersion?: number } | null)?.newPlanVersion;
    if (typeof newPlanVersion === "number") {
      invalidateCapacityCacheForTenant(actor.tenantId);
      notifyPlanVersionChanged(actor.tenantId, projectId, newPlanVersion);
    }
    return context.json({ reverted: revertible.id, ...(lastBody as object) });
  });
}
