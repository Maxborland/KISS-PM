import { randomUUID } from "node:crypto";

import {
  canEditTaskFields,
  canParticipateInTaskActivity,
  getActorTaskParticipantRole
} from "./taskCommandGuards";
import type {
  CommentResult,
  CreateTaskCommentInput,
  TaskCommandWorkspaceDeps
} from "./taskCommandTypes";

export async function createTaskComment(
  deps: TaskCommandWorkspaceDeps,
  input: CreateTaskCommentInput
): Promise<CommentResult> {
  if (
    !deps.dataSource.findTaskById ||
    !deps.dataSource.createTaskActivity ||
    !deps.dataSource.appendAuditEvent ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.findTaskById ||
      !transactionDataSource.createTaskActivity ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { ok: false, status: 501, error: "persistence_not_configured" };
    }

    const task = await transactionDataSource.findTaskById(input.actor.tenantId, input.taskId);
    if (!task) return { ok: false, status: 404, error: "task_not_found" };
    if (
      !canParticipateInTaskActivity(input.actor.id, task) &&
      !canEditTaskFields(input.actor, input.profile, task).allowed
    ) {
      return { ok: false, status: 403, error: "task_participant_required" };
    }

    const activity = await transactionDataSource.createTaskActivity({
      id: `task-activity-${randomUUID()}`,
      tenantId: input.actor.tenantId,
      taskId: task.id,
      type: "comment",
      body: input.body.body,
      title: null,
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null,
      authorUserId: input.actor.id
    });
    await deps.appendManagementAuditEvent(
      {
        tenantId: input.actor.tenantId,
        actorUserId: input.actor.id,
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
          participantRole: getActorTaskParticipantRole(input.actor.id, task)
        }
      },
      transactionDataSource
    );

    return { ok: true, activity };
  });
}
