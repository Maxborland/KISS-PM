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

    const proposedActivityId = `task-activity-${randomUUID()}`;
    const claim = input.body.clientRequestId
      ? await transactionDataSource.claimWriteFlowIdempotencyKey({
          tenantId: input.actor.tenantId,
          actorUserId: input.actor.id,
          surface: `project_work.task.comment.create:${task.id}`,
          clientRequestId: input.body.clientRequestId,
          resourceId: proposedActivityId
        })
      : { claimed: true, resourceId: proposedActivityId };
    if (!claim.claimed) {
      const activities = await transactionDataSource.listTaskActivities(input.actor.tenantId, task.id);
      const existingActivity = activities.find((activity) => activity.id === claim.resourceId);
      if (!existingActivity) throw new Error("write_flow_idempotent_resource_missing");
      return { ok: true, activity: existingActivity };
    }

    const activity = await transactionDataSource.createTaskActivity({
      id: claim.resourceId,
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
        commandInput: {
          activityId: activity.id,
          ...(input.body.clientRequestId ? { clientRequestId: input.body.clientRequestId } : {})
        },
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
