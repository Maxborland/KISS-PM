import {
  canCreateTasks,
  canDeleteTasks,
  canEditTasks,
  canManageProjects,
  canManageTaskStatuses,
  canReadProjects,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type {
  TaskRecord,
  TaskStatusCategory,
  TaskStatusRecord
} from "@kiss-pm/persistence";
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
  parseCreateTaskStatusBody,
  parseTaskCommentBody,
  parseUpdateTaskBody,
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

  app.get("/api/workspace/task-statuses", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listTaskStatuses) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      taskStatuses: await dataSource.listTaskStatuses(actor.tenantId)
    });
  });

  app.post("/api/workspace/task-statuses", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.createTaskStatus) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canManageTaskStatuses({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateTaskStatusBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const taskStatus = await dataSource.createTaskStatus({
      ...parsed.value,
      tenantId: actor.tenantId
    });
    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "task_status.created",
      sourceWorkflow: "project_work",
      sourceEntity: { type: "TaskStatus", id: taskStatus.id },
      commandInput: parsed.value,
      beforeState: null,
      afterState: { id: taskStatus.id, category: taskStatus.category },
      permissionResult: {
        allowed: true,
        reason: decision.reason,
        permission: "tenant.task_statuses.manage"
      }
    });

    return context.json({ taskStatus }, 201);
  });

  app.patch("/api/workspace/task-statuses/:statusId", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.updateTaskStatusDefinition || !dataSource.listTaskStatuses) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canManageTaskStatuses({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateTaskStatusBody({
      ...(body.value && typeof body.value === "object" ? body.value : {}),
      id: context.req.param("statusId")
    });
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const before = (await dataSource.listTaskStatuses(actor.tenantId)).find(
      (status) => status.id === context.req.param("statusId")
    );
    if (!before) return context.json({ error: "task_status_not_found" }, 404);
    if (before.isSystem && parsed.value.status === "archived") {
      return context.json({ error: "system_task_status_required" }, 409);
    }
    if (before.isSystem && before.category !== parsed.value.category) {
      return context.json({ error: "system_task_status_category_locked" }, 409);
    }

    const taskStatus = await dataSource.updateTaskStatusDefinition({
      ...parsed.value,
      tenantId: actor.tenantId
    });
    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "task_status.updated",
      sourceWorkflow: "project_work",
      sourceEntity: { type: "TaskStatus", id: taskStatus.id },
      commandInput: parsed.value,
      beforeState: {
        id: before.id,
        name: before.name,
        category: before.category,
        sortOrder: before.sortOrder,
        status: before.status
      },
      afterState: {
        id: taskStatus.id,
        name: taskStatus.name,
        category: taskStatus.category,
        sortOrder: taskStatus.sortOrder,
        status: taskStatus.status
      },
      permissionResult: {
        allowed: true,
        reason: decision.reason,
        permission: "tenant.task_statuses.manage"
      }
    });

    return context.json({ taskStatus });
  });

  app.delete("/api/workspace/task-statuses/:statusId", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.archiveTaskStatus || !dataSource.listTaskStatuses) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canManageTaskStatuses({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const before = (await dataSource.listTaskStatuses(actor.tenantId)).find(
      (status) => status.id === context.req.param("statusId")
    );
    if (!before) return context.json({ error: "task_status_not_found" }, 404);
    if (before.isSystem) {
      return context.json({ error: "system_task_status_required" }, 409);
    }

    const taskStatus = await dataSource.archiveTaskStatus(
      actor.tenantId,
      context.req.param("statusId")
    );
    if (!taskStatus) return context.json({ error: "task_status_not_found" }, 404);

    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "task_status.archived",
      sourceWorkflow: "project_work",
      sourceEntity: { type: "TaskStatus", id: taskStatus.id },
      commandInput: { id: taskStatus.id },
      beforeState: { id: before.id, status: before.status },
      afterState: { id: taskStatus.id, status: taskStatus.status },
      permissionResult: {
        allowed: true,
        reason: decision.reason,
        permission: "tenant.task_statuses.manage"
      }
    });

    return context.json({ taskStatus });
  });

  app.get("/api/workspace/projects/:projectId", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listProjects || !dataSource.listProjectTasks) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
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

    const profile = await getActorProfile(actor);
    const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
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

    const profile = await getActorProfile(actor);
    const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      tasks: await dataSource.listMyWorkTasks(actor.tenantId, actor.id)
    });
  });

  app.get("/api/workspace/tasks/:taskId", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.findTaskById || !dataSource.listTaskActivities) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const task = await dataSource.findTaskById(actor.tenantId, context.req.param("taskId"));
    if (!task) return context.json({ error: "task_not_found" }, 404);

    return context.json({
      task,
      activities: await dataSource.listTaskActivities(actor.tenantId, task.id)
    });
  });

  app.post("/api/workspace/projects/:projectId/tasks", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.listProjects ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.listTaskStatuses ||
      !dataSource.createTask ||
      !dataSource.createTaskActivity ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canCreateTasks({ actor, profile, targetTenantId: actor.tenantId });
    const legacyManageDecision = canManageProjects({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed && !legacyManageDecision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

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

    const statuses = await dataSource.listTaskStatuses(actor.tenantId);
    const taskStatus =
      statuses.find((status) => status.id === parsed.value.statusId) ??
      getRequiredStatusByCategory(statuses, "new");
    if (!taskStatus || taskStatus.status !== "active") {
      return context.json({ error: "task_status_not_found" }, 400);
    }

    const participants = normalizeTaskParticipants(actor.id, parsed.value.participants);
    const ownerUserId = getParticipantUserId(participants, "executor");
    const requesterUserId = getParticipantUserId(participants, "requester");
    if (!ownerUserId || !requesterUserId) {
      return context.json({ error: "task_executor_required" }, 400);
    }
    const ownerUserName =
      workspaceUsers.find((user) => user.id === ownerUserId)?.name ?? ownerUserId;

    const taskId = parsed.value.id ?? `task-${randomUUID()}`;
    const task = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createTask || !transactionDataSource.createTaskActivity) {
        throw new Error("persistence_not_configured");
      }

      const createdTask = await transactionDataSource.createTask({
        id: taskId,
        tenantId: actor.tenantId,
        projectId: project.id,
        stageId: null,
        title: parsed.value.title,
        description: parsed.value.description,
        status: taskStatus.category,
        statusId: taskStatus.id,
        statusName: taskStatus.name,
        statusCategory: taskStatus.category,
        priority: parsed.value.priority,
        requesterUserId,
        ownerUserId,
        plannedStart: parsed.value.plannedStart,
        plannedFinish: parsed.value.plannedFinish,
        durationWorkingDays: parsed.value.durationWorkingDays,
        plannedWork: parsed.value.plannedWork,
        actualWork: 0,
        progress: 0,
        requiresAcceptance: parsed.value.requiresAcceptance,
        source: "manual",
        participants
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
            statusId: createdTask.statusId,
            participants: createdTask.participants
          },
          permissionResult: {
            allowed: true,
            reason: decision.allowed ? decision.reason : legacyManageDecision.reason,
            permission: decision.allowed
              ? "tenant.tasks.create"
              : "tenant.projects.manage"
          }
        },
        transactionDataSource
      );
      await createTaskSystemActivity(transactionDataSource, {
        tenantId: actor.tenantId,
        taskId: createdTask.id,
        actorUserId: actor.id,
        title: "Задача создана",
        body: `Статус: ${taskStatus.name}. Ответственный: ${ownerUserName}.`
      });

      return createdTask;
    });

    return context.json({ task }, 201);
  });

  app.patch("/api/workspace/tasks/:taskId", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findTaskById ||
      !dataSource.updateTask ||
      !dataSource.listTaskStatuses ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.createTaskActivity
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const task = await dataSource.findTaskById(actor.tenantId, context.req.param("taskId"));
    if (!task) return context.json({ error: "task_not_found" }, 404);
    const editDecision = canEditTaskFields(actor, profile, task);
    if (!editDecision.allowed) return context.json({ error: editDecision.reason }, 403);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseUpdateTaskBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const activeUserIds = new Set(
      (await dataSource.listWorkspaceUsers(actor.tenantId))
        .filter((user) => user.status !== "inactive")
        .map((user) => user.id)
    );
    const participants = normalizeTaskParticipants(actor.id, parsed.value.participants);
    if (participants.some((participant) => !activeUserIds.has(participant.userId))) {
      return context.json({ error: "invalid_task_participant" }, 400);
    }
    const ownerUserId = getParticipantUserId(participants, "executor");
    const requesterUserId = getParticipantUserId(participants, "requester");
    if (!ownerUserId || !requesterUserId) {
      return context.json({ error: "task_executor_required" }, 400);
    }

    const nextStatus = (await dataSource.listTaskStatuses(actor.tenantId)).find(
      (status) => status.id === parsed.value.statusId && status.status === "active"
    );
    if (!nextStatus) return context.json({ error: "task_status_not_found" }, 400);

    const updated = await dataSource.updateTask({
      id: task.id,
      tenantId: actor.tenantId,
      projectId: task.projectId,
      stageId: task.stageId,
      title: parsed.value.title,
      description: parsed.value.description,
      status: nextStatus.category,
      statusId: nextStatus.id,
      statusName: nextStatus.name,
      statusCategory: nextStatus.category,
      priority: parsed.value.priority,
      requesterUserId,
      ownerUserId,
      plannedStart: parsed.value.plannedStart,
      plannedFinish: parsed.value.plannedFinish,
      durationWorkingDays: parsed.value.durationWorkingDays,
      plannedWork: parsed.value.plannedWork,
      actualWork: task.actualWork,
      progress: task.progress,
      requiresAcceptance: parsed.value.requiresAcceptance,
      source: task.source,
      participants
    });
    if (!updated) return context.json({ error: "task_not_found" }, 404);

    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "task.updated",
      sourceWorkflow: "project_work",
      sourceEntity: { type: "Task", id: updated.id },
      commandInput: { title: updated.title, statusId: updated.statusId },
      beforeState: summarizeTask(task),
      afterState: summarizeTask(updated),
      permissionResult: editDecision
    });
    await createTaskSystemActivity(dataSource, {
      tenantId: actor.tenantId,
      taskId: updated.id,
      actorUserId: actor.id,
      title: "Задача обновлена",
      body: "Поля задачи изменены через карточку задачи."
    });

    return context.json({ task: updated });
  });

  app.delete("/api/workspace/tasks/:taskId", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.findTaskById || !dataSource.archiveTask) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const task = await dataSource.findTaskById(actor.tenantId, context.req.param("taskId"));
    if (!task) return context.json({ error: "task_not_found" }, 404);
    const deleteDecision = canDeleteTask(actor, profile, task);
    if (!deleteDecision.allowed) return context.json({ error: deleteDecision.reason }, 403);

    const archived = await dataSource.archiveTask(actor.tenantId, task.id);
    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "task.archived",
      sourceWorkflow: "project_work",
      sourceEntity: { type: "Task", id: task.id },
      commandInput: { id: task.id },
      beforeState: summarizeTask(task),
      afterState: archived ? summarizeTask(archived) : null,
      permissionResult: deleteDecision
    });

    return context.json({ task: archived });
  });

  app.patch(
    "/api/workspace/projects/:projectId/tasks/:taskId/status",
    async (context) => {
      const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (
        !dataSource.listProjects ||
        !dataSource.listProjectTasks ||
        !dataSource.listTaskStatuses ||
        !dataSource.updateTaskStatus ||
        !dataSource.createTaskActivity ||
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
      const initialManageDecision = canManageProjects({
        actor,
        profile,
        targetTenantId: actor.tenantId
      });
      if (!readDecision.allowed && !initialManageDecision.allowed) {
        return context.json({ error: readDecision.reason }, 403);
      }

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
            !transactionDataSource.listTaskStatuses ||
            !transactionDataSource.updateTaskStatus ||
            !transactionDataSource.createTaskActivity
          ) {
            throw new Error("persistence_not_configured");
          }

          const project = await findActiveProject(
            transactionDataSource,
            actor.tenantId,
            initialProject.id
          );
          if (!project) return { ok: false as const, status: 404, error: "project_not_found" };

          const task = (await transactionDataSource.listProjectTasks(
            actor.tenantId,
            project.id
          )).find((candidate) => candidate.id === context.req.param("taskId"));
          if (!task) return { ok: false as const, status: 404, error: "task_not_found" };

          const targetStatus = (await transactionDataSource.listTaskStatuses(
            actor.tenantId
          )).find(
            (candidate) =>
              candidate.id === parsed.value.statusId && candidate.status === "active"
          );
          if (!targetStatus) {
            return { ok: false as const, status: 400, error: "task_status_not_found" };
          }

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

          if (!isTaskStatusTransitionAllowed(task.status, targetStatus.category)) {
            return {
              ok: false as const,
              status: 409,
              error: "task_status_transition_not_allowed"
            };
          }
          if (
            task.requiresAcceptance &&
            targetStatus.category === "done" &&
            !canAcceptTaskResult(actor, profile, task)
          ) {
            return {
              ok: false as const,
              status: 409,
              error: "task_acceptance_required"
            };
          }

          const nextProgress = deriveTaskProgress(targetStatus.category, task.progress);
          const updated = await transactionDataSource.updateTaskStatus({
            tenantId: actor.tenantId,
            projectId: project.id,
            taskId: task.id,
            expectedStatus: task.status,
            status: targetStatus.category,
            statusId: targetStatus.id,
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
                statusId: targetStatus.id,
                status: targetStatus.category
              },
              beforeState: {
                id: task.id,
                projectId: task.projectId,
                status: task.status,
                statusId: task.statusId,
                progress: task.progress
              },
              afterState: {
                id: updated.id,
                projectId: updated.projectId,
                status: updated.status,
                statusId: updated.statusId,
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
          await createTaskSystemActivity(transactionDataSource, {
            tenantId: actor.tenantId,
            taskId: updated.id,
            actorUserId: actor.id,
            title: "Статус задачи изменен",
            body: `${task.statusName} -> ${targetStatus.name}`
          });

          return { ok: true as const, task: updated };
        }
      );

      if (!transition.ok) {
        if (transition.status === 400) return context.json({ error: transition.error }, 400);
        if (transition.status === 403) return context.json({ error: transition.error }, 403);
        if (transition.status === 404) return context.json({ error: transition.error }, 404);
        return context.json({ error: transition.error }, 409);
      }
      return context.json({ task: transition.task });
    }
  );

  app.get("/api/workspace/tasks/:taskId/activity", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.findTaskById || !dataSource.listTaskActivities) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    const task = await dataSource.findTaskById(actor.tenantId, context.req.param("taskId"));
    if (!task) return context.json({ error: "task_not_found" }, 404);

    return context.json({
      activities: await dataSource.listTaskActivities(actor.tenantId, task.id)
    });
  });

  app.post("/api/workspace/tasks/:taskId/comments", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.findTaskById || !dataSource.createTaskActivity) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const readDecision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);
    const task = await dataSource.findTaskById(actor.tenantId, context.req.param("taskId"));
    if (!task) return context.json({ error: "task_not_found" }, 404);
    if (!canParticipateInTaskActivity(actor.id, task) && !canEditTaskFields(actor, profile, task).allowed) {
      return context.json({ error: "task_participant_required" }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseTaskCommentBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const activity = await dataSource.createTaskActivity({
      id: `task-activity-${randomUUID()}`,
      tenantId: actor.tenantId,
      taskId: task.id,
      type: "comment",
      body: parsed.value.body,
      title: null,
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null,
      authorUserId: actor.id
    });
    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "task.comment_created",
      sourceWorkflow: "project_work",
      sourceEntity: { type: "Task", id: task.id },
      commandInput: { activityId: activity.id },
      beforeState: null,
      afterState: { id: activity.id, type: activity.type },
      permissionResult: {
        allowed: true,
        reason: "task_participant",
        authorizationBasis: "task_participant_role",
        participantRole: getActorTaskParticipantRole(actor.id, task)
      }
    });

    return context.json({ activity }, 201);
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

function canParticipantTransitionTask(
  actorUserId: string,
  task: TaskRecord
): boolean {
  const transitionRoles = new Set(["requester", "executor", "co_executor", "controller"]);
  const participantRole = getActorTaskParticipantRole(actorUserId, task);
  return participantRole ? transitionRoles.has(participantRole) : false;
}

function canParticipateInTaskActivity(actorUserId: string, task: TaskRecord): boolean {
  return task.participants.some((participant) => participant.userId === actorUserId);
}

function getActorTaskParticipantRole(
  actorUserId: string,
  task: TaskRecord
): string | undefined {
  return task.participants.find((participant) => participant.userId === actorUserId)
    ?.role;
}

function isTaskStatusTransitionAllowed(
  from: TaskStatusCategory,
  to: TaskStatusCategory
): boolean {
  const allowedTransitions: Record<TaskStatusCategory, TaskStatusCategory[]> = {
    new: ["waiting", "in_progress"],
    waiting: ["in_progress"],
    in_progress: ["waiting", "review", "done"],
    review: ["in_progress", "done"],
    done: []
  };
  return allowedTransitions[from].includes(to);
}

function deriveTaskProgress(status: TaskStatusCategory, currentProgress: number): number {
  if (status === "done") return 100;
  if (status === "new") return 0;
  if (status === "in_progress") return Math.max(currentProgress, 10);
  if (status === "review") return Math.max(currentProgress, 80);
  return currentProgress;
}

function normalizeTaskParticipants(
  actorUserId: string,
  participants: TaskRecord["participants"]
): TaskRecord["participants"] {
  const result = [...participants];
  if (!result.some((participant) => participant.role === "requester")) {
    result.push({ userId: actorUserId, role: "requester" });
  }
  return result;
}

function getParticipantUserId(
  participants: TaskRecord["participants"],
  role: string
): string | undefined {
  return participants.find((participant) => participant.role === role)?.userId;
}

function getRequiredStatusByCategory(
  statuses: TaskStatusRecord[],
  category: TaskStatusCategory
): TaskStatusRecord | undefined {
  return statuses.find(
    (status) => status.category === category && status.status === "active"
  );
}

function canEditTaskFields(
  actor: TenantUser,
  profile: AccessProfile,
  task: TaskRecord
): PolicyDecision & Record<string, unknown> {
  const editDecision = canEditTasks({ actor, profile, targetTenantId: actor.tenantId });
  const manageDecision = canManageProjects({ actor, profile, targetTenantId: actor.tenantId });
  if (editDecision.allowed) {
    return {
      ...editDecision,
      permission: "tenant.tasks.edit",
      authorizationBasis: "permission"
    };
  }
  if (manageDecision.allowed) {
    return {
      ...manageDecision,
      permission: "tenant.projects.manage",
      authorizationBasis: "permission"
    };
  }
  if (task.requesterUserId === actor.id) {
    return {
      allowed: true,
      reason: "same_tenant_permission_granted",
      authorizationBasis: "task_requester_role",
      participantRole: "requester"
    };
  }
  return editDecision;
}

function canDeleteTask(
  actor: TenantUser,
  profile: AccessProfile,
  task: TaskRecord
): PolicyDecision & Record<string, unknown> {
  const deleteDecision = canDeleteTasks({ actor, profile, targetTenantId: actor.tenantId });
  if (deleteDecision.allowed) {
    return {
      ...deleteDecision,
      permission: "tenant.tasks.delete",
      authorizationBasis: "permission"
    };
  }
  return deleteDecision;
}

function canAcceptTaskResult(
  actor: TenantUser,
  profile: AccessProfile,
  task: TaskRecord
): boolean {
  return canEditTaskFields(actor, profile, task).allowed;
}

function summarizeTask(task: TaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
    statusId: task.statusId,
    requesterUserId: task.requesterUserId,
    ownerUserId: task.ownerUserId,
    plannedStart: task.plannedStart,
    plannedFinish: task.plannedFinish,
    plannedWork: task.plannedWork,
    requiresAcceptance: task.requiresAcceptance
  };
}

async function createTaskSystemActivity(
  dataSource: ApiTenantDataSource,
  input: {
    tenantId: string;
    taskId: string;
    actorUserId: string;
    title: string;
    body: string;
  }
) {
  if (!dataSource.createTaskActivity) {
    throw new Error("persistence_not_configured");
  }

  await dataSource.createTaskActivity({
    id: `task-activity-${randomUUID()}`,
    tenantId: input.tenantId,
    taskId: input.taskId,
    type: "system",
    body: input.body,
    title: input.title,
    fileUrl: null,
    fileSizeBytes: null,
    mimeType: null,
    authorUserId: input.actorUserId
  });
}
