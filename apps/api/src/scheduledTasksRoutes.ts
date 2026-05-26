import { canReadProjects, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type { ApiTenantDataSource } from "./apiTypes";
import { parseUserIdParam } from "./routeParamParsers";

type ScheduledTasksRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
};

export function registerScheduledTasksRoutes(app: Hono, deps: ScheduledTasksRouteDeps) {
  app.get("/api/tenant/current/scheduled-tasks", async (context) => {
    const query = parseScheduledTasksQuery({
      assigneeUserId: context.req.query("assigneeUserId"),
      fromDate: context.req.query("fromDate"),
      toDate: context.req.query("toDate")
    });
    if (!query.ok) return context.json({ error: "scheduled_tasks_invalid" }, 400);

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

    const tasks = await deps.dataSource.listScheduledTasks({
      tenantId: actor.tenantId,
      assigneeUserId: query.value.assigneeUserId,
      fromDate: query.value.fromDate,
      toDate: query.value.toDate,
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

function parseScheduledTasksQuery(input: {
  assigneeUserId: string | undefined;
  fromDate: string | undefined;
  toDate: string | undefined;
}):
  | { ok: true; value: { assigneeUserId: string; fromDate: string; toDate: string } }
  | { ok: false } {
  const parsedAssignee = parseUserIdParam(input.assigneeUserId?.trim());
  if (!parsedAssignee.ok) return { ok: false };
  const fromDate = parseScheduledDate(input.fromDate);
  const toDate = parseScheduledDate(input.toDate);
  if (!fromDate || !toDate) return { ok: false };

  const fromTime = Date.parse(`${fromDate}T00:00:00.000Z`);
  const toTime = Date.parse(`${toDate}T00:00:00.000Z`);
  if (toTime < fromTime) return { ok: false };
  const rangeDays = Math.floor((toTime - fromTime) / 86_400_000) + 1;
  if (rangeDays > 370) return { ok: false };

  return {
    ok: true,
    value: {
      assigneeUserId: parsedAssignee.value,
      fromDate,
      toDate
    }
  };
}

function parseScheduledDate(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}
