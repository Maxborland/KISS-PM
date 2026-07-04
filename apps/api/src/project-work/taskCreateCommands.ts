import { randomUUID } from "node:crypto";

import { permissionForCommand } from "../planning/planningCommandPermissions";
import { buildCreateTaskPlanningCommand } from "../planningTaskCompatibility";
import {
  appendCreatedTaskActivity,
  authorizeCreateTask,
  createPermissionResult,
  hasProjectCreateTaskDeps,
  hasWorkspaceInboxCreateTaskDeps,
  prepareCreateTaskParticipants,
  resolveCreateTaskStatus,
  validateCreateTaskParticipants
} from "./taskCreateSupport";
import {
  findActiveProject
} from "./taskCommandGuards";
import type {
  CreateProjectTaskInput,
  CreateWorkspaceInboxTaskInput,
  TaskCommandWorkspaceDeps,
  TaskResult
} from "./taskCommandTypes";

export async function createWorkspaceInboxTask(
  deps: TaskCommandWorkspaceDeps,
  input: CreateWorkspaceInboxTaskInput
): Promise<TaskResult> {
  if (!hasWorkspaceInboxCreateTaskDeps(deps)) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const createPermission = authorizeCreateTask(input);
  if (!createPermission.allowed) {
    return { ok: false, status: createPermission.status, error: createPermission.error };
  }

  const participantResult = prepareCreateTaskParticipants(input.actor.id, input.body.participants);
  if (!participantResult.ok) return participantResult;
  const { participants, ownerUserId, requesterUserId } = participantResult;
  const taskId = input.body.id ?? `task-${randomUUID()}`;

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.ensureWorkspaceInboxProject ||
      !transactionDataSource.listWorkspaceUsers ||
      !transactionDataSource.listTaskStatuses ||
      !transactionDataSource.applyPlanningCommand ||
      !transactionDataSource.updateTaskMetadata ||
      !transactionDataSource.findTaskById ||
      !transactionDataSource.incrementPlanVersion ||
      !transactionDataSource.createTaskActivity
    ) {
      throw new Error("persistence_not_configured");
    }

    await transactionDataSource.lockTenantResourcePlanning?.(input.actor.tenantId);
    const users = await transactionDataSource.listWorkspaceUsers(input.actor.tenantId);
    if (!validateCreateTaskParticipants(participants, users)) {
      return { ok: false as const, status: 400, error: "invalid_task_participant" };
    }

    const statuses = await transactionDataSource.listTaskStatuses(input.actor.tenantId);
    const currentTaskStatus = resolveCreateTaskStatus(statuses, input.body.statusId);
    if (!currentTaskStatus) {
      return { ok: false as const, status: 400, error: "task_status_not_found" };
    }

    const inboxProject = await transactionDataSource.ensureWorkspaceInboxProject({
      tenantId: input.actor.tenantId,
      plannedStart: input.body.plannedStart,
      plannedFinish: input.body.plannedFinish
    });
    const planningCommand = buildCreateTaskPlanningCommand({
      taskId,
      projectId: inboxProject.id,
      statusId: currentTaskStatus.id,
      body: input.body,
      participants
    });
    const planningPermission = permissionForCommand(planningCommand, input.actor, input.profile);
    if (!planningPermission.allowed) {
      return { ok: false as const, status: 403, error: planningPermission.reason };
    }
    await transactionDataSource.applyPlanningCommand({
      tenantId: input.actor.tenantId,
      projectId: inboxProject.id,
      actorUserId: input.actor.id,
      command: planningCommand
    });
    const metadataTask = await transactionDataSource.updateTaskMetadata({
      tenantId: input.actor.tenantId,
      taskId,
      description: input.body.description,
      priority: input.body.priority,
      requesterUserId,
      ownerUserId,
      requiresAcceptance: input.body.requiresAcceptance,
      participants
    });
    if (!metadataTask) throw new Error("task_create_metadata_failed");
    const createdTask =
      (await transactionDataSource.findTaskById(input.actor.tenantId, taskId)) ?? metadataTask;
    const planVersion = await transactionDataSource.incrementPlanVersion(
      input.actor.tenantId,
      inboxProject.id
    );

    await deps.appendManagementAuditEvent(
      {
        tenantId: input.actor.tenantId,
        actorUserId: input.actor.id,
        actionType: "task.created",
        sourceWorkflow: "project_work",
        sourceEntity: { type: "Task", id: createdTask.id },
        commandInput: {
          projectId: inboxProject.id,
          sourceType: inboxProject.sourceType,
          title: createdTask.title,
          participants: createdTask.participants,
          planningCommands: [planningCommand]
        },
        beforeState: null,
        afterState: {
          id: createdTask.id,
          projectId: createdTask.projectId,
          status: createdTask.status,
          statusId: createdTask.statusId,
          participants: createdTask.participants,
          planVersion
        },
        permissionResult: createPermissionResult(createPermission)
      },
      transactionDataSource
    );
    await appendCreatedTaskActivity(transactionDataSource, {
      tenantId: input.actor.tenantId,
      taskId: createdTask.id,
      actorUserId: input.actor.id,
      statusName: currentTaskStatus.name,
      ownerUserId
    });

    return {
      ok: true as const,
      task: createdTask,
      project: inboxProject,
      planVersion
    };
  });
}

export async function createProjectTask(
  deps: TaskCommandWorkspaceDeps,
  input: CreateProjectTaskInput
): Promise<TaskResult> {
  if (!hasProjectCreateTaskDeps(deps)) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const createPermission = authorizeCreateTask(input);
  if (!createPermission.allowed) {
    return { ok: false, status: createPermission.status, error: createPermission.error };
  }

  const project = await findActiveProject(
    deps.dataSource,
    input.actor.tenantId,
    input.projectId
  );
  if (!project) return { ok: false, status: 404, error: "project_not_found" };

  const participantResult = prepareCreateTaskParticipants(input.actor.id, input.body.participants);
  if (!participantResult.ok) return participantResult;
  const { participants, ownerUserId, requesterUserId } = participantResult;
  const taskId = input.body.id ?? `task-${randomUUID()}`;

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.listProjects ||
      !transactionDataSource.listWorkspaceUsers ||
      !transactionDataSource.listTaskStatuses ||
      !transactionDataSource.applyPlanningCommand ||
      !transactionDataSource.updateTaskMetadata ||
      !transactionDataSource.findTaskById ||
      !transactionDataSource.incrementPlanVersion ||
      !transactionDataSource.createTaskActivity
    ) {
      throw new Error("persistence_not_configured");
    }

    await transactionDataSource.lockTenantResourcePlanning?.(input.actor.tenantId);
    const currentProject = await findActiveProject(
      transactionDataSource,
      input.actor.tenantId,
      project.id
    );
    if (!currentProject) {
      return { ok: false as const, status: 404, error: "project_not_found" };
    }

    const users = await transactionDataSource.listWorkspaceUsers(input.actor.tenantId);
    if (!validateCreateTaskParticipants(participants, users)) {
      return { ok: false as const, status: 400, error: "invalid_task_participant" };
    }

    const statuses = await transactionDataSource.listTaskStatuses(input.actor.tenantId);
    const currentTaskStatus = resolveCreateTaskStatus(statuses, input.body.statusId);
    if (!currentTaskStatus) {
      return { ok: false as const, status: 400, error: "task_status_not_found" };
    }

    const currentPlanningCommand = buildCreateTaskPlanningCommand({
      taskId,
      projectId: currentProject.id,
      statusId: currentTaskStatus.id,
      body: input.body,
      participants
    });
    const planningPermission = permissionForCommand(
      currentPlanningCommand,
      input.actor,
      input.profile
    );
    if (!planningPermission.allowed) {
      return { ok: false as const, status: 403, error: planningPermission.reason };
    }
    await transactionDataSource.applyPlanningCommand({
      tenantId: input.actor.tenantId,
      projectId: currentProject.id,
      actorUserId: input.actor.id,
      command: currentPlanningCommand
    });
    const metadataTask = await transactionDataSource.updateTaskMetadata({
      tenantId: input.actor.tenantId,
      taskId,
      description: input.body.description,
      priority: input.body.priority,
      requesterUserId,
      ownerUserId,
      requiresAcceptance: input.body.requiresAcceptance,
      participants
    });
    if (!metadataTask) throw new Error("task_create_metadata_failed");
    const createdTask =
      (await transactionDataSource.findTaskById(input.actor.tenantId, taskId)) ?? metadataTask;
    const planVersion = await transactionDataSource.incrementPlanVersion(
      input.actor.tenantId,
      currentProject.id
    );

    await deps.appendManagementAuditEvent(
      {
        tenantId: input.actor.tenantId,
        actorUserId: input.actor.id,
        actionType: "task.created",
        sourceWorkflow: "project_work",
        sourceEntity: { type: "Task", id: createdTask.id },
        commandInput: {
          projectId: currentProject.id,
          title: createdTask.title,
          participants: createdTask.participants,
          planningCommands: [currentPlanningCommand]
        },
        beforeState: null,
        afterState: {
          id: createdTask.id,
          projectId: createdTask.projectId,
          status: createdTask.status,
          statusId: createdTask.statusId,
          participants: createdTask.participants,
          planVersion
        },
        permissionResult: createPermissionResult(createPermission)
      },
      transactionDataSource
    );
    await appendCreatedTaskActivity(transactionDataSource, {
      tenantId: input.actor.tenantId,
      taskId: createdTask.id,
      actorUserId: input.actor.id,
      statusName: currentTaskStatus.name,
      ownerUserId
    });

    return { ok: true as const, task: createdTask };
  });
}
