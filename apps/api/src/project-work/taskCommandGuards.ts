import {
  canDeleteTasks,
  canEditTasks,
  canManageProjects,
  canManageProjectResources,
  canReadProjects,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { PlanningCommand, TenantUser } from "@kiss-pm/domain";
import type {
  TaskRecord,
  TaskStatusCategory,
  TaskStatusRecord
} from "@kiss-pm/persistence";

import type { ApiTenantDataSource, ProjectRecord } from "../apiTypes";

export async function findActiveProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  const projects = await dataSource.listProjects?.(tenantId);
  return projects?.find((project) => project.id === projectId && project.status === "active");
}

export function canManageOrReadProjects(
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  const readDecision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
  if (readDecision.allowed) return readDecision;
  return canManageProjects({ actor, profile, targetTenantId: actor.tenantId });
}

export function canParticipantTransitionTask(actorUserId: string, task: TaskRecord): boolean {
  const transitionRoles = new Set(["requester", "executor", "co_executor", "controller"]);
  const participantRole = getActorTaskParticipantRole(actorUserId, task);
  return participantRole ? transitionRoles.has(participantRole) : false;
}

export function canParticipateInTaskActivity(actorUserId: string, task: TaskRecord): boolean {
  return task.participants.some((participant) => participant.userId === actorUserId);
}

export function getActorTaskParticipantRole(
  actorUserId: string,
  task: TaskRecord
): string | undefined {
  return task.participants.find((participant) => participant.userId === actorUserId)
    ?.role;
}

export function isTaskStatusTransitionAllowed(
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

export function normalizeTaskParticipants(
  actorUserId: string,
  participants: TaskRecord["participants"]
): TaskRecord["participants"] {
  const result = [...participants];
  if (!result.some((participant) => participant.role === "requester")) {
    result.push({ userId: actorUserId, role: "requester" });
  }
  return result;
}

export function getParticipantUserId(
  participants: TaskRecord["participants"],
  role: string
): string | undefined {
  return participants.find((participant) => participant.role === role)?.userId;
}

export function getRequiredStatusByCategory(
  statuses: TaskStatusRecord[],
  category: TaskStatusCategory
): TaskStatusRecord | undefined {
  return statuses.find(
    (status) => status.category === category && status.status === "active"
  );
}

export function canEditTaskFields(
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

export function canApplyTaskCompatibilityPlanningCommands(
  actor: TenantUser,
  profile: AccessProfile,
  commands: PlanningCommand[],
  planningParticipantsChanged: boolean
): PolicyDecision {
  const touchesResourceAssignments =
    planningParticipantsChanged ||
    commands.some(
      (command) => command.type === "assignment.upsert" || command.type === "assignment.delete"
    );
  if (!touchesResourceAssignments) {
    return { allowed: true, reason: "same_tenant_permission_granted" };
  }
  return canManageProjectResources({ actor, profile, targetTenantId: actor.tenantId });
}

export function canDeleteTask(
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

export function canAcceptTaskResult(
  actor: TenantUser,
  profile: AccessProfile,
  task: TaskRecord
): boolean {
  return canEditTaskFields(actor, profile, task).allowed;
}
