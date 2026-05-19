import {
  canManageProjects,
  canReadProjects,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  ProjectRecord
} from "./apiTypes";
import { readLimitedJsonBody } from "./jsonBody";
import { parseCreateTaskBody } from "./projectWorkParsers";

type ProjectWorkRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<void>;
};

export function registerProjectWorkRoutes(app: Hono, deps: ProjectWorkRouteDeps) {
  const {
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders
  } = deps;

  app.get("/api/workspace/projects/:projectId", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listProjects || !dataSource.listProjectTasks) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadProjects({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const project = await findActiveProject(
      dataSource,
      actor.tenantId,
      context.req.param("projectId")
    );
    if (!project) return context.json({ error: "project_not_found" }, 404);

    return context.json({
      project,
      tasks: await dataSource.listProjectTasks(actor.tenantId, project.id)
    });
  });

  app.get("/api/workspace/projects/:projectId/tasks", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listProjects || !dataSource.listProjectTasks) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadProjects({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const project = await findActiveProject(
      dataSource,
      actor.tenantId,
      context.req.param("projectId")
    );
    if (!project) return context.json({ error: "project_not_found" }, 404);

    return context.json({
      tasks: await dataSource.listProjectTasks(actor.tenantId, project.id)
    });
  });

  app.get("/api/workspace/my-work", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listMyWorkTasks) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadProjects({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      tasks: await dataSource.listMyWorkTasks(actor.tenantId, actor.id)
    });
  });

  app.post("/api/workspace/projects/:projectId/tasks", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.listProjects ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.createTask ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canManageProjects({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const project = await findActiveProject(
      dataSource,
      actor.tenantId,
      context.req.param("projectId")
    );
    if (!project) return context.json({ error: "project_not_found" }, 404);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateTaskBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const workspaceUsers = await dataSource.listWorkspaceUsers(actor.tenantId);
    const activeUserIds = new Set(
      workspaceUsers
        .filter((user) => user.status !== "inactive")
        .map((user) => user.id)
    );
    if (
      parsed.value.participants.some(
        (participant) => !activeUserIds.has(participant.userId)
      )
    ) {
      return context.json({ error: "invalid_task_participant" }, 400);
    }

    const taskId = parsed.value.id ?? `task-${randomUUID()}`;
    const task = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createTask) {
        throw new Error("persistence_not_configured");
      }

      const createdTask = await transactionDataSource.createTask({
        id: taskId,
        tenantId: actor.tenantId,
        projectId: project.id,
        stageId: null,
        title: parsed.value.title,
        description: parsed.value.description,
        status: "todo",
        priority: parsed.value.priority,
        plannedStart: parsed.value.plannedStart,
        plannedFinish: parsed.value.plannedFinish,
        plannedWork: parsed.value.plannedWork,
        actualWork: 0,
        progress: 0,
        source: "manual",
        participants: parsed.value.participants
      });

      await deps.appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "task.created",
          sourceWorkflow: "project_work",
          sourceEntity: { type: "Task", id: createdTask.id },
          commandInput: {
            projectId: project.id,
            title: createdTask.title,
            participants: createdTask.participants
          },
          beforeState: null,
          afterState: {
            id: createdTask.id,
            projectId: createdTask.projectId,
            status: createdTask.status,
            participants: createdTask.participants
          },
          permissionResult: {
            allowed: true,
            reason: decision.reason,
            permission: "tenant.projects.manage"
          }
        },
        transactionDataSource
      );

      return createdTask;
    });

    return context.json({ task }, 201);
  });
}

async function findActiveProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  const projects = await dataSource.listProjects?.(tenantId);
  return projects?.find((project) => project.id === projectId && project.status === "active");
}
