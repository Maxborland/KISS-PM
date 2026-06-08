import { canReadProjects, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type {
  AttachmentReadModel,
  TaskActivityRecord,
  TaskRecord
} from "@kiss-pm/persistence";

import type { ApiTenantDataSource, ProjectRecord } from "../apiTypes";
import { serializeAttachment } from "../attachmentSerialization";

type TaskReadWorkspaceDeps = {
  dataSource: ApiTenantDataSource;
};

type WorkspaceInput = {
  actor: TenantUser;
  profile: AccessProfile;
};

type WorkspaceError = {
  ok: false;
  status: 403 | 404 | 501;
  error: string;
};

type SerializedAttachment = ReturnType<typeof serializeAttachment>;

type ProjectDetailResult =
  | { ok: true; project: ProjectRecord; tasks: TaskRecord[] }
  | WorkspaceError;

type ProjectTasksResult = { ok: true; tasks: TaskRecord[] } | WorkspaceError;

type TaskDetailResult =
  | {
      ok: true;
      task: TaskRecord;
      activities: TaskActivityRecord[];
      attachmentItems: SerializedAttachment[];
    }
  | WorkspaceError;

type TaskActivityResult =
  | { ok: true; activities: TaskActivityRecord[]; attachmentItems: SerializedAttachment[] }
  | WorkspaceError;

export function createTaskReadWorkspace(deps: TaskReadWorkspaceDeps) {
  return {
    getProjectDetail(input: WorkspaceInput & { projectId: string }) {
      return getProjectDetail(deps, input);
    },
    listProjectTasks(input: WorkspaceInput & { projectId: string }) {
      return listProjectTasks(deps, input);
    },
    listMyWorkTasks(input: WorkspaceInput) {
      return listMyWorkTasks(deps, input);
    },
    getTaskDetail(input: WorkspaceInput & { taskId: string }) {
      return getTaskDetail(deps, input);
    },
    listTaskActivity(input: WorkspaceInput & { taskId: string }) {
      return listTaskActivity(deps, input);
    }
  };
}

async function getProjectDetail(
  deps: TaskReadWorkspaceDeps,
  input: WorkspaceInput & { projectId: string }
): Promise<ProjectDetailResult> {
  if (!deps.dataSource.listProjects || !deps.dataSource.listProjectTasks) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  const project = await findReadableProject(
    deps.dataSource,
    input.actor.tenantId,
    input.projectId
  );
  if (!project) return { ok: false, status: 404, error: "project_not_found" };

  return {
    ok: true,
    project,
    tasks: await deps.dataSource.listProjectTasks(input.actor.tenantId, project.id)
  };
}

async function listProjectTasks(
  deps: TaskReadWorkspaceDeps,
  input: WorkspaceInput & { projectId: string }
): Promise<ProjectTasksResult> {
  if (!deps.dataSource.listProjects || !deps.dataSource.listProjectTasks) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  const project = await findReadableProject(
    deps.dataSource,
    input.actor.tenantId,
    input.projectId
  );
  if (!project) return { ok: false, status: 404, error: "project_not_found" };

  return {
    ok: true,
    tasks: await deps.dataSource.listProjectTasks(input.actor.tenantId, project.id)
  };
}

async function listMyWorkTasks(
  deps: TaskReadWorkspaceDeps,
  input: WorkspaceInput
): Promise<ProjectTasksResult> {
  if (!deps.dataSource.listMyWorkTasks) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  return {
    ok: true,
    tasks: await deps.dataSource.listMyWorkTasks(input.actor.tenantId, input.actor.id)
  };
}

async function getTaskDetail(
  deps: TaskReadWorkspaceDeps,
  input: WorkspaceInput & { taskId: string }
): Promise<TaskDetailResult> {
  if (!deps.dataSource.findTaskById || !deps.dataSource.listTaskActivities) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  const task = await deps.dataSource.findTaskById(input.actor.tenantId, input.taskId);
  if (!task) return { ok: false, status: 404, error: "task_not_found" };

  return {
    ok: true,
    task,
    activities: await deps.dataSource.listTaskActivities(input.actor.tenantId, task.id),
    attachmentItems: await listSerializedTaskAttachmentItems(deps, input.actor.tenantId, task.id)
  };
}

async function listTaskActivity(
  deps: TaskReadWorkspaceDeps,
  input: WorkspaceInput & { taskId: string }
): Promise<TaskActivityResult> {
  if (!deps.dataSource.findTaskById || !deps.dataSource.listTaskActivities) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };
  const task = await deps.dataSource.findTaskById(input.actor.tenantId, input.taskId);
  if (!task) return { ok: false, status: 404, error: "task_not_found" };

  return {
    ok: true,
    activities: await deps.dataSource.listTaskActivities(input.actor.tenantId, task.id),
    attachmentItems: await listSerializedTaskAttachmentItems(deps, input.actor.tenantId, task.id)
  };
}

async function listSerializedTaskAttachmentItems(
  deps: TaskReadWorkspaceDeps,
  tenantId: string,
  taskId: string
): Promise<SerializedAttachment[]> {
  const attachmentItems = (await deps.dataSource.listAttachmentActivityItems?.({
    tenantId,
    entityType: "task",
    entityId: taskId
  })) ?? [];
  return attachmentItems.map((attachment: AttachmentReadModel) => serializeAttachment(attachment));
}

async function findReadableProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  const projects = await dataSource.listProjects?.(tenantId);
  return projects?.find(
    (project) =>
      project.id === projectId &&
      (project.status === "active" || project.status === "paused")
  );
}
