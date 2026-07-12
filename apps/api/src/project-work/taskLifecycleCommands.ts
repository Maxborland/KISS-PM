import { canManageProjects } from "@kiss-pm/access-control";

import {
  buildArchiveTaskPlanningCommand,
  buildStatusTransitionPlanningCommand
} from "../planningTaskCompatibility";
import { createTaskSystemActivity, summarizeTask } from "./taskCommandActivities";
import {
  canAcceptTaskResult,
  canDeleteTask,
  canManageOrReadProjects,
  canParticipantTransitionTask,
  findActiveProject,
  getActorTaskParticipantRole,
  isTaskStatusTransitionAllowed
} from "./taskCommandGuards";
import type {
  ArchiveTaskInput,
  TaskCommandWorkspaceDeps,
  TaskResult,
  TransitionTaskStatusInput
} from "./taskCommandTypes";

export async function archiveTask(
  deps: TaskCommandWorkspaceDeps,
  input: ArchiveTaskInput
): Promise<TaskResult> {
  if (
    !deps.dataSource.findTaskByIdIncludingArchived ||
    !deps.dataSource.lockTenantResourcePlanning ||
    !deps.dataSource.applyPlanningCommand ||
    !deps.dataSource.incrementPlanVersion ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const task = await deps.dataSource.findTaskByIdIncludingArchived(
    input.actor.tenantId,
    input.taskId
  );
  if (!task) return { ok: false, status: 404, error: "task_not_found" };
  const deleteDecision = canDeleteTask(input.actor, input.profile, task);
  if (!deleteDecision.allowed) return { ok: false, status: 403, error: deleteDecision.reason };
  if (task.archivedAt) return { ok: true as const, task };

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.findTaskByIdIncludingArchived ||
      !transactionDataSource.lockTenantResourcePlanning ||
      !transactionDataSource.applyPlanningCommand ||
      !transactionDataSource.incrementPlanVersion
    ) {
      throw new Error("persistence_not_configured");
    }
    await transactionDataSource.lockTenantResourcePlanning(input.actor.tenantId);
    const currentTask = await transactionDataSource.findTaskByIdIncludingArchived(
      input.actor.tenantId,
      task.id
    );
    if (!currentTask) {
      return { ok: false as const, status: 404, error: "task_not_found" };
    }

    const currentDeleteDecision = canDeleteTask(input.actor, input.profile, currentTask);
    if (!currentDeleteDecision.allowed) {
      return { ok: false as const, status: 403, error: currentDeleteDecision.reason };
    }

    if (currentTask.archivedAt) {
      return { ok: true as const, task: currentTask };
    }
    const currentPlanningCommand = buildArchiveTaskPlanningCommand(currentTask.id);
    await transactionDataSource.applyPlanningCommand({
      tenantId: input.actor.tenantId,
      projectId: currentTask.projectId,
      actorUserId: input.actor.id,
      command: currentPlanningCommand
    });
    const archived = { ...currentTask, archivedAt: new Date() };
    const planVersion = await transactionDataSource.incrementPlanVersion(
      input.actor.tenantId,
      currentTask.projectId
    );
    await deps.appendManagementAuditEvent({
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: "task.archived",
      sourceWorkflow: "project_work",
      sourceEntity: { type: "Task", id: currentTask.id },
      commandInput: { id: currentTask.id, planningCommands: [currentPlanningCommand] },
      beforeState: summarizeTask(currentTask),
      afterState: { ...summarizeTask(archived), planVersion },
      permissionResult: currentDeleteDecision
    }, transactionDataSource);
    return { ok: true as const, task: archived, planVersion };
  });
}

export async function transitionTaskStatus(
  deps: TaskCommandWorkspaceDeps,
  input: TransitionTaskStatusInput
): Promise<TaskResult> {
  if (
    !deps.dataSource.listProjects ||
    !deps.dataSource.listProjectTasks ||
    !deps.dataSource.listTaskStatuses ||
    !deps.dataSource.lockTenantResourcePlanning ||
    !deps.dataSource.applyPlanningCommand ||
    !deps.dataSource.findTaskById ||
    !deps.dataSource.incrementPlanVersion ||
    !deps.dataSource.createTaskActivity ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const readDecision = canManageOrReadProjects(input.actor, input.profile);
  if (!readDecision.allowed) return { ok: false, status: 403, error: readDecision.reason };

  const initialProject = await findActiveProject(
    deps.dataSource,
    input.actor.tenantId,
    input.projectId
  );
  if (!initialProject) return { ok: false, status: 404, error: "project_not_found" };

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.listProjects ||
      !transactionDataSource.listProjectTasks ||
      !transactionDataSource.listTaskStatuses ||
      !transactionDataSource.lockTenantResourcePlanning ||
      !transactionDataSource.applyPlanningCommand ||
      !transactionDataSource.findTaskById ||
      !transactionDataSource.incrementPlanVersion ||
      !transactionDataSource.createTaskActivity
    ) {
      throw new Error("persistence_not_configured");
    }

    await transactionDataSource.lockTenantResourcePlanning(input.actor.tenantId);
    const project = await findActiveProject(
      transactionDataSource,
      input.actor.tenantId,
      initialProject.id
    );
    if (!project) return { ok: false as const, status: 404, error: "project_not_found" };

    const task = (await transactionDataSource.listProjectTasks(
      input.actor.tenantId,
      project.id
    )).find((candidate) => candidate.id === input.taskId);
    if (!task) return { ok: false as const, status: 404, error: "task_not_found" };

    const targetStatus = (await transactionDataSource.listTaskStatuses(
      input.actor.tenantId
    )).find(
      (candidate) =>
        candidate.id === input.body.statusId && candidate.status === "active"
    );
    if (!targetStatus) {
      return { ok: false as const, status: 400, error: "task_status_not_found" };
    }

    const manageDecision = canManageProjects({
      actor: input.actor,
      profile: input.profile,
      targetTenantId: input.actor.tenantId
    });
    if (!manageDecision.allowed && !canParticipantTransitionTask(input.actor.id, task)) {
      return {
        ok: false as const,
        status: 403,
        error: "task_participant_role_required"
      };
    }

    if (input.clientUpdatedAt && task.updatedAt.getTime() !== input.clientUpdatedAt.getTime()) {
      return {
        ok: false as const,
        status: 409,
        error: "task_version_conflict",
        currentVersions: { taskUpdatedAt: task.updatedAt.toISOString() }
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
      !canAcceptTaskResult(input.actor, input.profile, task)
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "task_acceptance_required"
      };
    }

    const planningCommand = buildStatusTransitionPlanningCommand({
      taskId: task.id,
      statusId: targetStatus.id
    });
    await transactionDataSource.applyPlanningCommand({
      tenantId: input.actor.tenantId,
      projectId: project.id,
      actorUserId: input.actor.id,
      command: planningCommand
    });
    const updated = await transactionDataSource.findTaskById(input.actor.tenantId, task.id);
    if (!updated) {
      return {
        ok: false as const,
        status: 409,
        error: "task_status_transition_conflict"
      };
    }
    const planVersion = await transactionDataSource.incrementPlanVersion(
      input.actor.tenantId,
      project.id
    );

    await deps.appendManagementAuditEvent(
      {
        tenantId: input.actor.tenantId,
        actorUserId: input.actor.id,
        actionType: "task.status_changed",
        sourceWorkflow: "project_work",
        sourceEntity: { type: "Task", id: updated.id },
        commandInput: {
          projectId: project.id,
          title: task.title,
          statusId: targetStatus.id,
          status: targetStatus.category,
          planningCommands: [planningCommand]
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
          progress: updated.progress,
          planVersion
        },
        permissionResult: {
          allowed: true,
          reason: manageDecision.allowed ? manageDecision.reason : "task_participant",
          authorizationBasis: manageDecision.allowed
            ? "permission"
            : "task_participant_role",
          permission: manageDecision.allowed ? "tenant.projects.manage" : null,
          participantRole: getActorTaskParticipantRole(input.actor.id, task)
        }
      },
      transactionDataSource
    );
    await createTaskSystemActivity(transactionDataSource, {
      tenantId: input.actor.tenantId,
      taskId: updated.id,
      actorUserId: input.actor.id,
      title: "Статус задачи изменен",
      body: `${task.statusName} -> ${targetStatus.name}`
    });

    return { ok: true as const, task: updated, planVersion };
  });
}
