import { canReadProjects } from "@kiss-pm/access-control";

import {
  canEditTaskFields,
  canManageOrReadProjects,
  canParticipateInTaskActivity,
  findActiveProject
} from "./taskCommandGuards";
import type { PreflightResult, TaskCommandWorkspaceDeps, WorkspaceInput } from "./taskCommandTypes";
import {
  authorizeCreateTask,
  hasProjectCreateTaskDeps,
  hasWorkspaceInboxCreateTaskDeps
} from "./taskCreateSupport";

export async function preflightCreateWorkspaceInboxTask(
  deps: TaskCommandWorkspaceDeps,
  input: WorkspaceInput
): Promise<PreflightResult> {
  if (!hasWorkspaceInboxCreateTaskDeps(deps)) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const createPermission = authorizeCreateTask(input);
  if (!createPermission.allowed) {
    return { ok: false, status: createPermission.status, error: createPermission.error };
  }
  return { ok: true };
}

export async function preflightCreateProjectTask(
  deps: TaskCommandWorkspaceDeps,
  input: WorkspaceInput & { projectId: string }
): Promise<PreflightResult> {
  if (!hasProjectCreateTaskDeps(deps)) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const createPermission = authorizeCreateTask(input);
  if (!createPermission.allowed) {
    return { ok: false, status: createPermission.status, error: createPermission.error };
  }

  const project = await findActiveProject(deps.dataSource, input.actor.tenantId, input.projectId);
  if (!project) return { ok: false, status: 404, error: "project_not_found" };
  return { ok: true };
}

export async function preflightUpdateTask(
  deps: TaskCommandWorkspaceDeps,
  input: WorkspaceInput & { taskId: string }
): Promise<PreflightResult> {
  if (
    !deps.dataSource.findTaskById ||
    !deps.dataSource.getPlanSnapshot ||
    !deps.dataSource.listProjectTaskAssignments ||
    !deps.dataSource.lockTenantResourcePlanning ||
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
  return { ok: true };
}

export async function preflightTransitionTaskStatus(
  deps: TaskCommandWorkspaceDeps,
  input: WorkspaceInput & { projectId: string }
): Promise<PreflightResult> {
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

  const decision = canManageOrReadProjects(input.actor, input.profile);
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  const project = await findActiveProject(deps.dataSource, input.actor.tenantId, input.projectId);
  if (!project) return { ok: false, status: 404, error: "project_not_found" };
  return { ok: true };
}

export async function preflightCreateTaskComment(
  deps: TaskCommandWorkspaceDeps,
  input: WorkspaceInput & { taskId: string }
): Promise<PreflightResult> {
  if (!deps.dataSource.findTaskById || !deps.dataSource.createTaskActivity) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const readDecision = canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!readDecision.allowed) return { ok: false, status: 403, error: readDecision.reason };

  const task = await deps.dataSource.findTaskById(input.actor.tenantId, input.taskId);
  if (!task) return { ok: false, status: 404, error: "task_not_found" };
  if (
    !canParticipateInTaskActivity(input.actor.id, task) &&
    !canEditTaskFields(input.actor, input.profile, task).allowed
  ) {
    return { ok: false, status: 403, error: "task_participant_required" };
  }
  return { ok: true };
}
