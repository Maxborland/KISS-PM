import { buildUpdateTaskPlanningCommands } from "../planningTaskCompatibility";
import { createTaskSystemActivity, summarizeTask } from "./taskCommandActivities";
import {
  canApplyTaskCompatibilityPlanningCommands,
  canEditTaskFields,
  getParticipantUserId,
  normalizeTaskParticipants
} from "./taskCommandGuards";
import type { TaskCommandWorkspaceDeps, TaskResult, UpdateTaskInput } from "./taskCommandTypes";

export async function updateTask(
  deps: TaskCommandWorkspaceDeps,
  input: UpdateTaskInput
): Promise<TaskResult> {
  if (
    !deps.dataSource.findTaskById ||
    !deps.dataSource.getPlanSnapshot ||
    !deps.dataSource.applyPlanningCommand ||
    !deps.dataSource.updateTaskMetadata ||
    !deps.dataSource.incrementPlanVersion ||
    !deps.dataSource.listTaskStatuses ||
    !deps.dataSource.listWorkspaceUsers ||
    !deps.dataSource.createTaskActivity ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const task = await deps.dataSource.findTaskById(input.actor.tenantId, input.taskId);
  if (!task) return { ok: false, status: 404, error: "task_not_found" };
  const editDecision = canEditTaskFields(input.actor, input.profile, task);
  if (!editDecision.allowed) return { ok: false, status: 403, error: editDecision.reason };
  if (input.body.statusId !== task.statusId) {
    return { ok: false, status: 409, error: "task_status_transition_not_allowed" };
  }

  const participants = normalizeTaskParticipants(input.actor.id, input.body.participants);
  const ownerUserId = getParticipantUserId(participants, "executor");
  const requesterUserId = getParticipantUserId(participants, "requester");
  if (!ownerUserId || !requesterUserId) {
    return { ok: false, status: 400, error: "task_executor_required" };
  }

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.getPlanSnapshot ||
      !transactionDataSource.applyPlanningCommand ||
      !transactionDataSource.updateTaskMetadata ||
      !transactionDataSource.findTaskById ||
      !transactionDataSource.incrementPlanVersion ||
      !transactionDataSource.listTaskStatuses ||
      !transactionDataSource.listWorkspaceUsers ||
      !transactionDataSource.createTaskActivity
    ) {
      throw new Error("persistence_not_configured");
    }
    await transactionDataSource.lockTenantResourcePlanning?.(input.actor.tenantId);
    const currentTask = await transactionDataSource.findTaskById(
      input.actor.tenantId,
      task.id
    );
    if (!currentTask) {
      return { ok: false as const, status: 404, error: "task_not_found" };
    }

    const currentEditDecision = canEditTaskFields(input.actor, input.profile, currentTask);
    if (!currentEditDecision.allowed) {
      return { ok: false as const, status: 403, error: currentEditDecision.reason };
    }
    if (input.body.statusId !== currentTask.statusId) {
      return {
        ok: false as const,
        status: 409,
        error: "task_status_transition_not_allowed"
      };
    }

    const currentActiveUserIds = new Set(
      (await transactionDataSource.listWorkspaceUsers(input.actor.tenantId))
        .filter((user) => user.status !== "inactive")
        .map((user) => user.id)
    );
    if (participants.some((participant) => !currentActiveUserIds.has(participant.userId))) {
      return { ok: false as const, status: 400, error: "invalid_task_participant" };
    }

    const currentNextStatus = (await transactionDataSource.listTaskStatuses(
      input.actor.tenantId
    )).find((status) => status.id === input.body.statusId && status.status === "active");
    if (!currentNextStatus) {
      return { ok: false as const, status: 400, error: "task_status_not_found" };
    }

    const snapshot = await transactionDataSource.getPlanSnapshot(
      input.actor.tenantId,
      currentTask.projectId
    );
    if (!snapshot) return { ok: false as const, status: 404, error: "project_not_found" };
    const planningCommands = buildUpdateTaskPlanningCommands({
      task: currentTask,
      body: input.body,
      participants,
      snapshot
    });
    if (currentTask.updatedAt.getTime() !== input.body.clientUpdatedAt.getTime()) {
      return { ok: false as const, status: 409, error: "task_version_conflict" };
    }
    const planningCompatibilityDecision = canApplyTaskCompatibilityPlanningCommands(
      input.actor,
      input.profile,
      planningCommands
    );
    if (!planningCompatibilityDecision.allowed) {
      return { ok: false as const, status: 403, error: planningCompatibilityDecision.reason };
    }
    for (const command of planningCommands) {
      await transactionDataSource.applyPlanningCommand({
        tenantId: input.actor.tenantId,
        projectId: currentTask.projectId,
        actorUserId: input.actor.id,
        command
      });
    }
    const metadataTask = await transactionDataSource.updateTaskMetadata({
      tenantId: input.actor.tenantId,
      taskId: currentTask.id,
      description: input.body.description,
      priority: input.body.priority,
      requesterUserId,
      ownerUserId,
      requiresAcceptance: input.body.requiresAcceptance,
      participants
    });
    if (!metadataTask) return { ok: false as const, status: 404, error: "task_not_found" };
    const updated =
      (await transactionDataSource.findTaskById(input.actor.tenantId, currentTask.id)) ??
      metadataTask;
    const planVersion =
      planningCommands.length > 0
        ? await transactionDataSource.incrementPlanVersion(input.actor.tenantId, updated.projectId)
        : null;
    await deps.appendManagementAuditEvent({
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: "task.updated",
      sourceWorkflow: "project_work",
      sourceEntity: { type: "Task", id: updated.id },
      commandInput: {
        title: updated.title,
        statusId: currentNextStatus.id,
        planningCommands
      },
      beforeState: summarizeTask(currentTask),
      afterState: { ...summarizeTask(updated), planVersion },
      permissionResult: currentEditDecision
    }, transactionDataSource);
    await createTaskSystemActivity(transactionDataSource, {
      tenantId: input.actor.tenantId,
      taskId: updated.id,
      actorUserId: input.actor.id,
      title: "Задача обновлена",
      body: "Поля задачи изменены через карточку задачи."
    });
    return { ok: true as const, task: updated, planVersion };
  });
}
