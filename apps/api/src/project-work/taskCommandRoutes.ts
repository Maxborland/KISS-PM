import type { Hono } from "hono";

import { invalidateCapacityCacheForTenant } from "../capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "../jsonBody";
import {
  parseCreateTaskBody,
  parseTaskCommentBody,
  parseUpdateTaskBody,
  parseUpdateTaskStatusBody
} from "../projectWorkParsers";
import type { ProjectWorkRouteDeps } from "../projectWorkRoutes";
import { parseProjectIdParam, parseTaskIdParam } from "../routeParamParsers";
import { appendProjectWorkDeniedAudit } from "./projectWorkAudit";
import { createTaskCommandWorkspace } from "./taskCommandWorkspace";
import { createTaskReadWorkspace } from "./taskReadWorkspace";

export function registerTaskCommandRoutes(app: Hono, deps: ProjectWorkRouteDeps) {
  const { getSessionActorFromHeaders, getActorProfile } = deps;
  const taskCommandWorkspace = createTaskCommandWorkspace(deps);
  const taskReadWorkspace = createTaskReadWorkspace(deps);

  app.post("/api/workspace/tasks", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await getActorProfile(actor);
    const preflight = await taskCommandWorkspace.preflightCreateWorkspaceInboxTask({
      actor,
      profile
    });
    if (!preflight.ok) {
      await appendProjectWorkDeniedAudit(deps, {
        actor,
        actionType: "task.create_denied",
        status: preflight.status,
        error: preflight.error,
        commandInput: { scope: "workspace_inbox" }
      });
      return context.json({ error: preflight.error }, preflight.status);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateTaskBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const createResult = await taskCommandWorkspace.createWorkspaceInboxTask({
      actor,
      profile,
      body: parsed.value
    });
    if (!createResult.ok) {
      await appendProjectWorkDeniedAudit(deps, {
        actor,
        actionType: "task.create_denied",
        status: createResult.status,
        error: createResult.error,
        commandInput: { scope: "workspace_inbox", taskId: parsed.value.id ?? null }
      });
      return context.json({ error: createResult.error }, createResult.status);
    }

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({
      task: createResult.task,
      project: createResult.project,
      planVersion: createResult.planVersion
    }, 201);
  });

  app.post("/api/workspace/projects/:projectId/tasks", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await getActorProfile(actor);
    const preflight = await taskCommandWorkspace.preflightCreateProjectTask({
      actor,
      profile,
      projectId: projectId.value
    });
    if (!preflight.ok) {
      await appendProjectWorkDeniedAudit(deps, {
        actor,
        actionType: "task.create_denied",
        status: preflight.status,
        error: preflight.error,
        projectId: projectId.value,
        commandInput: { projectId: projectId.value }
      });
      return context.json({ error: preflight.error }, preflight.status);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateTaskBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const createResult = await taskCommandWorkspace.createProjectTask({
      actor,
      profile,
      projectId: projectId.value,
      body: parsed.value
    });
    if (!createResult.ok) {
      await appendProjectWorkDeniedAudit(deps, {
        actor,
        actionType: "task.create_denied",
        status: createResult.status,
        error: createResult.error,
        projectId: projectId.value,
        commandInput: { projectId: projectId.value, taskId: parsed.value.id ?? null }
      });
      return context.json({ error: createResult.error }, createResult.status);
    }

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ task: createResult.task }, 201);
  });

  app.patch("/api/workspace/tasks/:taskId", async (context) => {
    const taskId = parseTaskIdParam(context.req.param("taskId"));
    if (!taskId.ok) return context.json({ error: taskId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await getActorProfile(actor);
    const preflight = await taskCommandWorkspace.preflightUpdateTask({
      actor,
      profile,
      taskId: taskId.value
    });
    if (!preflight.ok) {
      await appendProjectWorkDeniedAudit(deps, {
        actor,
        actionType: "task.update_denied",
        status: preflight.status,
        error: preflight.error,
        taskId: taskId.value,
        commandInput: { taskId: taskId.value }
      });
      return context.json({ error: preflight.error }, preflight.status);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseUpdateTaskBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const updateResult = await taskCommandWorkspace.updateTask({
      actor,
      profile,
      taskId: taskId.value,
      body: parsed.value
    });
    if (!updateResult.ok) {
      await appendProjectWorkDeniedAudit(deps, {
        actor,
        actionType: "task.update_denied",
        status: updateResult.status,
        error: updateResult.error,
        taskId: taskId.value,
        commandInput: { taskId: taskId.value }
      });
      return context.json({ error: updateResult.error }, updateResult.status);
    }

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ task: updateResult.task });
  });

  app.delete("/api/workspace/tasks/:taskId", async (context) => {
    const taskId = parseTaskIdParam(context.req.param("taskId"));
    if (!taskId.ok) return context.json({ error: taskId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await getActorProfile(actor);
    const archiveResult = await taskCommandWorkspace.archiveTask({
      actor,
      profile,
      taskId: taskId.value
    });
    if (!archiveResult.ok) {
      await appendProjectWorkDeniedAudit(deps, {
        actor,
        actionType: "task.archive_denied",
        status: archiveResult.status,
        error: archiveResult.error,
        taskId: taskId.value,
        commandInput: { taskId: taskId.value }
      });
      return context.json({ error: archiveResult.error }, archiveResult.status);
    }

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ task: archiveResult.task });
  });

  app.patch(
    "/api/workspace/projects/:projectId/tasks/:taskId/status",
    async (context) => {
      const projectId = parseProjectIdParam(context.req.param("projectId"));
      if (!projectId.ok) return context.json({ error: projectId.error }, 400);
      const taskId = parseTaskIdParam(context.req.param("taskId"));
      if (!taskId.ok) return context.json({ error: taskId.error }, 400);

      const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      const profile = await getActorProfile(actor);
      const preflight = await taskCommandWorkspace.preflightTransitionTaskStatus({
        actor,
        profile,
        projectId: projectId.value
      });
      if (!preflight.ok) {
        await appendProjectWorkDeniedAudit(deps, {
          actor,
          actionType: "task.status_change_denied",
          status: preflight.status,
          error: preflight.error,
          projectId: projectId.value,
          taskId: taskId.value,
          commandInput: { projectId: projectId.value, taskId: taskId.value }
        });
        return context.json({ error: preflight.error }, preflight.status);
      }

      const body = await readLimitedJsonBody(context);
      if (!body.ok) return context.json({ error: body.error }, body.status);
      const parsed = parseUpdateTaskStatusBody(body.value);
      if (!parsed.ok) return context.json({ error: parsed.error }, 400);

      const transition = await taskCommandWorkspace.transitionTaskStatus({
        actor,
        profile,
        projectId: projectId.value,
        taskId: taskId.value,
        body: parsed.value
      });

      if (!transition.ok) {
        await appendProjectWorkDeniedAudit(deps, {
          actor,
          actionType: "task.status_change_denied",
          status: transition.status,
          error: transition.error,
          projectId: projectId.value,
          taskId: taskId.value,
          commandInput: { projectId: projectId.value, taskId: taskId.value, statusId: parsed.value.statusId }
        });
        return context.json({ error: transition.error }, transition.status);
      }
      invalidateCapacityCacheForTenant(actor.tenantId);
      return context.json({ task: transition.task });
    }
  );

  app.get("/api/workspace/tasks/:taskId/activity", async (context) => {
    const taskId = parseTaskIdParam(context.req.param("taskId"));
    if (!taskId.ok) return context.json({ error: taskId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const result = await taskReadWorkspace.listTaskActivity({
      actor,
      profile,
      taskId: taskId.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({
      activities: result.activities,
      attachmentItems: result.attachmentItems
    });
  });

  app.post("/api/workspace/tasks/:taskId/comments", async (context) => {
    const taskId = parseTaskIdParam(context.req.param("taskId"));
    if (!taskId.ok) return context.json({ error: taskId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await getActorProfile(actor);
    const preflight = await taskCommandWorkspace.preflightCreateTaskComment({
      actor,
      profile,
      taskId: taskId.value
    });
    if (!preflight.ok) {
      await appendProjectWorkDeniedAudit(deps, {
        actor,
        actionType: "task.comment_create_denied",
        status: preflight.status,
        error: preflight.error,
        taskId: taskId.value,
        commandInput: { taskId: taskId.value }
      });
      return context.json({ error: preflight.error }, preflight.status);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseTaskCommentBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await taskCommandWorkspace.createTaskComment({
      actor,
      profile,
      taskId: taskId.value,
      body: parsed.value
    });
    if (!result.ok) {
      await appendProjectWorkDeniedAudit(deps, {
        actor,
        actionType: "task.comment_create_denied",
        status: result.status,
        error: result.error,
        taskId: taskId.value,
        commandInput: { taskId: taskId.value }
      });
      return context.json({ error: result.error }, result.status);
    }

    return context.json({ activity: result.activity }, 201);
  });
}
