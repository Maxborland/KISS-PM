import { canReadProjects, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource } from "./apiTypes";

type ScheduledTasksRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
};

function parseDateParam(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export function registerScheduledTasksRoutes(app: Hono, deps: ScheduledTasksRouteDeps) {
  app.get("/api/tenant/current/scheduled-tasks", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listScheduledTasks) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await deps.getActorProfile(actor);
    const decision = canReadProjects({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const assigneeUserId = context.req.query("assigneeUserId")?.trim();
    const fromDate = parseDateParam(context.req.query("fromDate"));
    const toDate = parseDateParam(context.req.query("toDate"));
    if (!assigneeUserId || !fromDate || !toDate) {
      return context.json({ error: "scheduled_tasks_invalid" }, 400);
    }

    const tasks = await deps.dataSource.listScheduledTasks({
      tenantId: actor.tenantId,
      assigneeUserId,
      fromDate,
      toDate,
      limit: 50
    });

    return context.json({
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        projectId: task.projectId,
        projectTitle: task.projectTitle,
        plannedStart: task.plannedStart.toISOString().slice(0, 10),
        plannedFinish: task.plannedFinish.toISOString().slice(0, 10),
        workMinutes: task.workMinutes,
        createdAt: task.createdAt.toISOString(),
        statusId: task.statusId
      }))
    });
  });
}
