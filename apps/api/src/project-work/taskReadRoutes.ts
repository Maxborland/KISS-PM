import type { Hono } from "hono";

import type { ProjectWorkRouteDeps } from "../projectWorkRoutes";
import { parseProjectIdParam, parseTaskIdParam } from "../routeParamParsers";
import { createTaskReadWorkspace } from "./taskReadWorkspace";

export function registerTaskReadRoutes(app: Hono, deps: ProjectWorkRouteDeps) {
  const { getSessionActorFromHeaders, getActorProfile } = deps;
  const taskReadWorkspace = createTaskReadWorkspace(deps);

  app.get("/api/workspace/projects/:projectId", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const result = await taskReadWorkspace.getProjectDetail({
      actor,
      profile,
      projectId: projectId.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({
      project: result.project,
      tasks: result.tasks
    });
  });

  app.get("/api/workspace/projects/:projectId/tasks", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const result = await taskReadWorkspace.listProjectTasks({
      actor,
      profile,
      projectId: projectId.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({
      tasks: result.tasks
    });
  });

  app.get("/api/workspace/my-work", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const result = await taskReadWorkspace.listMyWorkTasks({ actor, profile });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({
      tasks: result.tasks
    });
  });

  app.get("/api/workspace/tasks/:taskId", async (context) => {
    const taskId = parseTaskIdParam(context.req.param("taskId"));
    if (!taskId.ok) return context.json({ error: taskId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const result = await taskReadWorkspace.getTaskDetail({
      actor,
      profile,
      taskId: taskId.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({
      task: result.task,
      activities: result.activities,
      attachmentItems: result.attachmentItems
    });
  });

}
