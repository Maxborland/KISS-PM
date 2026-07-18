import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "./jsonBody";
import {
  parseCreateTaskBody,
  parseTaskCommentBody,
  parseUpdateTaskBody,
  parseUpdateTaskStatusBody
} from "./projectWorkParsers";
import { parseProjectIdParam, parseTaskIdParam } from "./routeParamParsers";
import { createTaskCommandWorkspace } from "./project-work/taskCommandWorkspace";
import { createTaskReadWorkspace } from "./project-work/taskReadWorkspace";
import { registerTaskStatusRoutes } from "./project-work/taskStatusRoutes";

export type ProjectWorkRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export function registerProjectWorkRoutes(app: Hono, deps: ProjectWorkRouteDeps) {
  const {
    getActorProfile,
    getSessionActorFromHeaders
  } = deps;
  const taskCommandWorkspace = createTaskCommandWorkspace(deps);
  const taskReadWorkspace = createTaskReadWorkspace(deps);

  registerTaskStatusRoutes(app, deps);

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

  app.post("/api/workspace/tasks", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await getActorProfile(actor);
    const preflight = await taskCommandWorkspace.preflightCreateWorkspaceInboxTask({
      actor,
      profile
    });
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

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
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

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
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

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
      // currentVersions при 409 — версия для честного refresh/retry клиента.
      return context.json({
        error: updateResult.error,
        ...("currentVersions" in updateResult && updateResult.currentVersions ? { currentVersions: updateResult.currentVersions } : {})
      }, updateResult.status);
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
      if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

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
        // Симметрично PATCH-задаче: 409 несёт currentVersions для refresh/retry.
        return context.json({
          error: transition.error,
          ...("currentVersions" in transition && transition.currentVersions ? { currentVersions: transition.currentVersions } : {})
        }, transition.status);
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
    if (!preflight.ok) return context.json({ error: preflight.error }, preflight.status);

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
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ activity: result.activity }, 201);
  });
}
