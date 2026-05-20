import {
  canManageProjects,
  canReadProjects,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { TaskRecord, TaskStatus } from "@kiss-pm/persistence";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  ProjectRecord
} from "./apiTypes";
import { readLimitedJsonBody } from "./jsonBody";
import {
  parseCreateTaskBody,
  parseUpdateTaskStatusBody
} from "./projectWorkParsers";

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

  app.patch(
    "/api/workspace/projects/:projectId/tasks/:taskId/status",
    async (context) => {
      const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (
        !dataSource.listProjects ||
        !dataSource.listProjectTasks ||
        !dataSource.updateTaskStatus ||
        !dataSource.withTransaction
      ) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }

      const profile = await getActorProfile(actor);
      const readDecision = canReadProjects({
        actor,
        profile,
        targetTenantId: actor.tenantId
      });
      if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);

      const initialProject = await findActiveProject(
        dataSource,
        actor.tenantId,
        context.req.param("projectId")
      );
      if (!initialProject) return context.json({ error: "project_not_found" }, 404);

      const body = await readLimitedJsonBody(context);
      if (!body.ok) return context.json({ error: body.error }, body.status);
      const parsed = parseUpdateTaskStatusBody(body.value);
      if (!parsed.ok) return context.json({ error: parsed.error }, 400);

      const transition = await deps.runDataSourceTransaction(
        async (transactionDataSource) => {
          if (
            !transactionDataSource.listProjects ||
            !transactionDataSource.listProjectTasks ||
            !transactionDataSource.updateTaskStatus
          ) {
            throw new Error("persistence_not_configured");
          }

          const project = await findActiveProject(
            transactionDataSource,
            actor.tenantId,
            initialProject.id
          );
          if (!project) return { ok: false as const, status: 404, error: "project_not_found" };

          const tasks = await transactionDataSource.listProjectTasks(
            actor.tenantId,
            project.id
          );
          const task = tasks.find(
            (candidate) => candidate.id === context.req.param("taskId")
          );
          if (!task) return { ok: false as const, status: 404, error: "task_not_found" };

          const manageDecision = canManageProjects({
            actor,
            profile,
            targetTenantId: actor.tenantId
          });
          if (!manageDecision.allowed && !canParticipantTransitionTask(actor.id, task)) {
            return {
              ok: false as const,
              status: 403,
              error: "task_participant_role_required"
            };
          }

          if (!isTaskStatusTransitionAllowed(task.status, parsed.value.status)) {
            return {
              ok: false as const,
              status: 409,
              error: "task_status_transition_not_allowed"
            };
          }

          const nextProgress = deriveTaskProgress(parsed.value.status, task.progress);
          const updated = await transactionDataSource.updateTaskStatus({
            tenantId: actor.tenantId,
            projectId: project.id,
            taskId: task.id,
            expectedStatus: task.status,
            status: parsed.value.status,
            progress: nextProgress
          });
          if (!updated) {
            return {
              ok: false as const,
              status: 409,
              error: "task_status_transition_conflict"
            };
          }

          await deps.appendManagementAuditEvent(
            {
              tenantId: actor.tenantId,
              actorUserId: actor.id,
              actionType: "task.status_changed",
              sourceWorkflow: "project_work",
              sourceEntity: { type: "Task", id: updated.id },
              commandInput: {
                projectId: project.id,
                title: task.title,
                status: parsed.value.status
              },
              beforeState: {
                id: task.id,
                projectId: task.projectId,
                status: task.status,
                progress: task.progress
              },
              afterState: {
                id: updated.id,
                projectId: updated.projectId,
                status: updated.status,
                progress: updated.progress
              },
              permissionResult: {
                allowed: true,
                reason: manageDecision.allowed ? manageDecision.reason : "task_participant",
                authorizationBasis: manageDecision.allowed
                  ? "permission"
                  : "task_participant_role",
                permission: manageDecision.allowed ? "tenant.projects.manage" : null,
                participantRole: getActorTaskParticipantRole(actor.id, task)
              }
            },
            transactionDataSource
          );

          return { ok: true as const, task: updated };
        }
      );

      if (!transition.ok) {
        if (transition.status === 403) {
          return context.json({ error: transition.error }, 403);
        }
        if (transition.status === 404) {
          return context.json({ error: transition.error }, 404);
        }
        return context.json({ error: transition.error }, 409);
      }
      return context.json({ task: transition.task });
    }
  );
}

async function findActiveProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  const projects = await dataSource.listProjects?.(tenantId);
  return projects?.find((project) => project.id === projectId && project.status === "active");
}

function canParticipantTransitionTask(
  actorUserId: string,
  task: TaskRecord
): boolean {
  const transitionRoles = new Set(["executor", "co_executor", "controller"]);
  const participantRole = getActorTaskParticipantRole(actorUserId, task);
  return participantRole ? transitionRoles.has(participantRole) : false;
}

function getActorTaskParticipantRole(
  actorUserId: string,
  task: TaskRecord
): string | undefined {
  return task.participants.find((participant) => participant.userId === actorUserId)
    ?.role;
}

function isTaskStatusTransitionAllowed(from: TaskStatus, to: TaskStatus): boolean {
  const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
    todo: ["in_progress", "blocked"],
    in_progress: ["blocked", "done"],
    blocked: ["in_progress", "done"],
    done: []
  };
  return allowedTransitions[from].includes(to);
}

function deriveTaskProgress(
  status: TaskStatus,
  currentProgress: number
): number {
  if (status === "done") return 100;
  if (status === "todo") return 0;
  if (status === "in_progress") return Math.max(currentProgress, 10);
  return currentProgress;
}
