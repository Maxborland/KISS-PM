import type { Hono } from "hono";

import { readLimitedJsonBody } from "../jsonBody";
import { parseCreateTaskStatusBody } from "../projectWorkParsers";
import { parseTaskStatusIdParam } from "../routeParamParsers";
import type { ProjectWorkRouteDeps } from "../projectWorkRoutes";
import { createTaskStatusWorkspace } from "./taskStatusWorkspace";

export function registerTaskStatusRoutes(app: Hono, deps: ProjectWorkRouteDeps) {
  const { getActorProfile, getSessionActorFromHeaders } = deps;
  const taskStatusWorkspace = createTaskStatusWorkspace(deps);

  app.get("/api/workspace/task-statuses", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const result = await taskStatusWorkspace.listTaskStatuses({ actor, profile });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ taskStatuses: result.taskStatuses });
  });

  app.post("/api/workspace/task-statuses", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateTaskStatusBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await taskStatusWorkspace.createTaskStatus({
      actor,
      profile,
      value: parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ taskStatus: result.taskStatus }, 201);
  });

  app.patch("/api/workspace/task-statuses/:statusId", async (context) => {
    const statusId = parseTaskStatusIdParam(context.req.param("statusId"));
    if (!statusId.ok) return context.json({ error: statusId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateTaskStatusBody({
      ...(body.value && typeof body.value === "object" ? body.value : {}),
      id: statusId.value
    });
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await taskStatusWorkspace.updateTaskStatus({
      actor,
      profile,
      statusId: statusId.value,
      value: parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ taskStatus: result.taskStatus });
  });

  app.delete("/api/workspace/task-statuses/:statusId", async (context) => {
    const statusId = parseTaskStatusIdParam(context.req.param("statusId"));
    if (!statusId.ok) return context.json({ error: statusId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const result = await taskStatusWorkspace.archiveTaskStatus({
      actor,
      profile,
      statusId: statusId.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ taskStatus: result.taskStatus });
  });
}
