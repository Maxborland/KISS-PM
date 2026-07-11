import {
  canCreateTasks,
  canManageProjects,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TaskRecord, TaskStatusRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource } from "../apiTypes";
import { createTaskSystemActivity } from "./taskCommandActivities";
import {
  getParticipantUserId,
  getRequiredStatusByCategory,
  normalizeTaskParticipants
} from "./taskCommandGuards";
import type { TaskCommandWorkspaceDeps, WorkspaceInput } from "./taskCommandTypes";

export type CreateTaskPermission = {
  createDecision: PolicyDecision;
  legacyManageDecision: PolicyDecision;
};

export type CreateTaskAuthorization =
  | ({ allowed: true } & CreateTaskPermission)
  | ({ allowed: false; status: 403; error: string } & CreateTaskPermission);

export function hasWorkspaceInboxCreateTaskDeps(deps: TaskCommandWorkspaceDeps): boolean {
  return Boolean(
    "ensureWorkspaceInboxProject" in deps.dataSource &&
      "listWorkspaceUsers" in deps.dataSource &&
      "listProjectTaskAssignments" in deps.dataSource &&
      "lockTenantResourcePlanning" in deps.dataSource &&
      "listTaskStatuses" in deps.dataSource &&
      "applyPlanningCommand" in deps.dataSource &&
      "updateTaskMetadata" in deps.dataSource &&
      "findTaskById" in deps.dataSource &&
      "incrementPlanVersion" in deps.dataSource &&
      "createTaskActivity" in deps.dataSource &&
      "withTransaction" in deps.dataSource
  );
}

export function hasProjectCreateTaskDeps(deps: TaskCommandWorkspaceDeps): boolean {
  return Boolean(
    "listProjects" in deps.dataSource &&
      "listWorkspaceUsers" in deps.dataSource &&
      "listProjectTaskAssignments" in deps.dataSource &&
      "listTaskStatuses" in deps.dataSource &&
      "lockTenantResourcePlanning" in deps.dataSource &&
      "applyPlanningCommand" in deps.dataSource &&
      "updateTaskMetadata" in deps.dataSource &&
      "findTaskById" in deps.dataSource &&
      "incrementPlanVersion" in deps.dataSource &&
      "createTaskActivity" in deps.dataSource &&
      "withTransaction" in deps.dataSource
  );
}

export function authorizeCreateTask(input: WorkspaceInput): CreateTaskAuthorization {
  const createDecision = canCreateTasks({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  const legacyManageDecision = canManageProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!createDecision.allowed && !legacyManageDecision.allowed) {
    return { allowed: false, status: 403, error: createDecision.reason, createDecision, legacyManageDecision };
  }
  return { allowed: true, createDecision, legacyManageDecision };
}

export function createPermissionResult(permission: CreateTaskPermission) {
  return {
    allowed: true,
    reason: permission.createDecision.allowed
      ? permission.createDecision.reason
      : permission.legacyManageDecision.reason,
    permission: permission.createDecision.allowed
      ? "tenant.tasks.create"
      : "tenant.projects.manage"
  };
}

export function prepareCreateTaskParticipants(
  actorUserId: string,
  participants: TaskRecord["participants"]
):
  | { ok: true; participants: TaskRecord["participants"]; ownerUserId: string; requesterUserId: string }
  | { ok: false; status: 400; error: "task_executor_required" } {
  const normalizedParticipants = normalizeTaskParticipants(actorUserId, participants);
  const ownerUserId = getParticipantUserId(normalizedParticipants, "executor");
  const requesterUserId = getParticipantUserId(normalizedParticipants, "requester");
  if (!ownerUserId || !requesterUserId) {
    return { ok: false, status: 400, error: "task_executor_required" };
  }
  return {
    ok: true,
    participants: normalizedParticipants,
    ownerUserId,
    requesterUserId
  };
}

export function validateCreateTaskParticipants(
  participants: TaskRecord["participants"],
  users: Array<{ id: string; status: string }>
): boolean {
  const currentActiveUserIds = new Set(
    users.filter((user) => user.status !== "inactive").map((user) => user.id)
  );
  return participants.every((participant) => currentActiveUserIds.has(participant.userId));
}

export function resolveCreateTaskStatus(
  statuses: TaskStatusRecord[],
  requestedStatusId?: string
): TaskStatusRecord | undefined {
  const taskStatus =
    statuses.find((status) => status.id === requestedStatusId) ??
    getRequiredStatusByCategory(statuses, "new");
  return statuses.find(
    (status) => status.id === taskStatus?.id && status.status === "active"
  );
}

export async function appendCreatedTaskActivity(
  dataSource: ApiTenantDataSource,
  input: {
    tenantId: string;
    taskId: string;
    actorUserId: string;
    statusName: string;
    ownerUserId: string;
  }
): Promise<void> {
  if (!dataSource.createTaskActivity || !dataSource.listWorkspaceUsers) {
    throw new Error("persistence_not_configured");
  }

  await createTaskSystemActivity(dataSource, {
    tenantId: input.tenantId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    title: "Задача создана",
    body: `Статус: ${input.statusName}. Ответственный: ${
      (await dataSource.listWorkspaceUsers(input.tenantId)).find(
        (user) => user.id === input.ownerUserId
      )?.name ?? input.ownerUserId
    }.`
  });
}
