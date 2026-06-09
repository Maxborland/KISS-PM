import { canManageProjects } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type { ProjectWorkRouteDeps } from "../projectWorkRoutes";
import type { ApiTenantDataSource, ProjectRecord } from "../apiTypes";
import { summarizeTask } from "./taskCommandActivities";

export function projectManagePermissionResult(
  decision: ReturnType<typeof canManageProjects>
): ReturnType<typeof canManageProjects> & Record<string, unknown> {
  return {
    ...decision,
    permission: "tenant.projects.manage",
    authorizationBasis: decision.allowed ? "permission" : "permission_missing"
  };
}

export function isMutableProjectStatus(status: string): status is "active" | "paused" {
  return status === "active" || status === "paused";
}

export async function appendProjectStatusDeniedAudit(
  deps: ProjectWorkRouteDeps,
  actor: TenantUser,
  projectId: string,
  status: string,
  permissionResult: Record<string, unknown>
): Promise<void> {
  try {
    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "project.status_change_denied",
      sourceWorkflow: "project_core",
      sourceEntity: { type: "Project", id: projectId },
      commandInput: { status },
      beforeState: null,
      afterState: null,
      permissionResult,
      executionResult: { status: "denied" }
    });
  } catch {
    return;
  }
}


type ProjectWorkDeniedAuditInput = {
  actor: TenantUser;
  actionType: string;
  status: number;
  error: string;
  projectId?: string;
  taskId?: string;
  commandInput: Record<string, unknown>;
};

export async function appendProjectWorkDeniedAudit(
  deps: ProjectWorkRouteDeps,
  input: ProjectWorkDeniedAuditInput
): Promise<void> {
  const context = await resolveProjectWorkDeniedAuditContext(deps.dataSource, input);
  if (!context.shouldAudit) return;

  try {
    await deps.appendManagementAuditEvent({
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: input.actionType,
      sourceWorkflow: "project_work",
      sourceEntity: context.sourceEntity,
      commandInput: input.commandInput,
      beforeState: context.beforeState,
      afterState: null,
      permissionResult: permissionResultForProjectWorkDenial(input),
      executionResult: { status: "denied" }
    });
  } catch {
    return;
  }
}

async function resolveProjectWorkDeniedAuditContext(
  dataSource: ApiTenantDataSource,
  input: ProjectWorkDeniedAuditInput
): Promise<{
  shouldAudit: boolean;
  sourceEntity: { type: string; id: string };
  beforeState: Record<string, unknown> | null;
}> {
  const foundTask = input.taskId
    ? await dataSource.findTaskById?.(input.actor.tenantId, input.taskId)
    : undefined;
  const task =
    foundTask && (!input.projectId || foundTask.projectId === input.projectId)
      ? foundTask
      : undefined;
  const projects = await dataSource.listProjects?.(input.actor.tenantId);
  const project = resolveAuditProject(projects, input.projectId, task?.projectId, input.actionType);

  if (input.status === 403) {
    return {
      shouldAudit: true,
      sourceEntity: task
        ? { type: "Task", id: task.id }
        : project
          ? { type: "Project", id: project.id }
          : { type: "Tenant", id: input.actor.tenantId },
      beforeState: task ? summarizeTask(task) : project ? summarizeProject(project) : null
    };
  }

  if (
    input.status !== 404 ||
    input.error !== "project_not_found" ||
    !project ||
    project.status === "active"
  ) {
    return {
      shouldAudit: false,
      sourceEntity: { type: "Tenant", id: input.actor.tenantId },
      beforeState: null
    };
  }

  return {
    shouldAudit: true,
    sourceEntity: task ? { type: "Task", id: task.id } : { type: "Project", id: project.id },
    beforeState: task ? summarizeTask(task) : summarizeProject(project)
  };
}

function resolveAuditProject(
  projects: ProjectRecord[] | undefined,
  projectId: string | undefined,
  taskProjectId: string | undefined,
  actionType: string
): ProjectRecord | undefined {
  if (!projects) return undefined;
  const knownProjectId = taskProjectId ?? projectId;
  if (knownProjectId) return projects.find((project) => project.id === knownProjectId);
  if (actionType === "task.create_denied") {
    return projects.find(
      (project) =>
        project.sourceType === "workspace_inbox" &&
        project.status !== "closed" &&
        project.status !== "cancelled"
    );
  }
  return undefined;
}

function summarizeProject(project: ProjectRecord): Record<string, unknown> {
  return {
    id: project.id,
    status: project.status,
    sourceType: project.sourceType
  };
}

function permissionResultForProjectWorkDenial(
  input: ProjectWorkDeniedAuditInput
): Record<string, unknown> {
  if (input.status === 403) return { allowed: false, reason: input.error };
  return { allowed: true, reason: "project_lifecycle_blocked" };
}
