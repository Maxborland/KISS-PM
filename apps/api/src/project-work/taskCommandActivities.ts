import type { TaskRecord } from "@kiss-pm/persistence";
import { randomUUID } from "node:crypto";

import type { ApiTenantDataSource } from "../apiTypes";

export function summarizeTask(task: TaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    projectId: task.projectId,
    stageId: task.stageId,
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

export async function createTaskSystemActivity(
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
