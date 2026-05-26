import { canManageTaskStatuses, canReadProjects, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { TaskStatusRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "../apiTypes";
import type { CreateTaskStatusBody } from "../projectWorkParsers";
import { appendTaskStatusAudit } from "./taskStatusAudit";

type TaskStatusWorkspaceDeps = {
  dataSource: ApiTenantDataSource;
  runDataSourceTransaction<T>(operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

type WorkspaceInput = {
  actor: TenantUser;
  profile: AccessProfile;
};

type WorkspaceError = {
  ok: false;
  status: 403 | 404 | 409 | 501;
  error: string;
};

type TaskStatusListResult = { ok: true; taskStatuses: TaskStatusRecord[] } | WorkspaceError;

type TaskStatusResult = { ok: true; taskStatus: TaskStatusRecord } | WorkspaceError;

export function createTaskStatusWorkspace(deps: TaskStatusWorkspaceDeps) {
  return {
    listTaskStatuses(input: WorkspaceInput) {
      return listTaskStatuses(deps, input);
    },
    createTaskStatus(input: WorkspaceInput & { value: CreateTaskStatusBody }) {
      return createTaskStatus(deps, input);
    },
    updateTaskStatus(input: WorkspaceInput & { statusId: string; value: CreateTaskStatusBody }) {
      return updateTaskStatus(deps, input);
    },
    archiveTaskStatus(input: WorkspaceInput & { statusId: string }) {
      return archiveTaskStatus(deps, input);
    }
  };
}

async function listTaskStatuses(
  deps: TaskStatusWorkspaceDeps,
  input: WorkspaceInput
): Promise<TaskStatusListResult> {
  if (!deps.dataSource.listTaskStatuses) {
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
    taskStatuses: await deps.dataSource.listTaskStatuses(input.actor.tenantId)
  };
}

async function createTaskStatus(
  deps: TaskStatusWorkspaceDeps,
  input: WorkspaceInput & { value: CreateTaskStatusBody }
): Promise<TaskStatusResult> {
  if (!deps.dataSource.createTaskStatus || !deps.dataSource.appendAuditEvent || !deps.dataSource.withTransaction) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageTaskStatuses({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (!transactionDataSource.createTaskStatus || !transactionDataSource.appendAuditEvent) {
      return { ok: false, status: 501, error: "persistence_not_configured" };
    }
    const taskStatus = await transactionDataSource.createTaskStatus({
      ...input.value,
      tenantId: input.actor.tenantId
    });
    await appendTaskStatusAudit(
      deps,
      {
        actor: input.actor,
        actionType: "task_status.created",
        taskStatusId: taskStatus.id,
        commandInput: input.value,
        beforeState: null,
        afterState: { id: taskStatus.id, category: taskStatus.category },
        permissionReason: decision.reason
      },
      transactionDataSource
    );

    return { ok: true, taskStatus };
  });
}

async function updateTaskStatus(
  deps: TaskStatusWorkspaceDeps,
  input: WorkspaceInput & { statusId: string; value: CreateTaskStatusBody }
): Promise<TaskStatusResult> {
  if (
    !deps.dataSource.updateTaskStatusDefinition ||
    !deps.dataSource.listTaskStatuses ||
    !deps.dataSource.appendAuditEvent ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageTaskStatuses({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.updateTaskStatusDefinition ||
      !transactionDataSource.listTaskStatuses ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { ok: false, status: 501, error: "persistence_not_configured" };
    }
    const before = (await transactionDataSource.listTaskStatuses(input.actor.tenantId)).find(
      (status) => status.id === input.statusId
    );
    if (!before) return { ok: false, status: 404, error: "task_status_not_found" };
    if (before.isSystem && input.value.status === "archived") {
      return { ok: false, status: 409, error: "system_task_status_required" };
    }
    if (before.isSystem && before.category !== input.value.category) {
      return { ok: false, status: 409, error: "system_task_status_category_locked" };
    }

    const taskStatus = await transactionDataSource.updateTaskStatusDefinition({
      ...input.value,
      tenantId: input.actor.tenantId
    });
    await appendTaskStatusAudit(
      deps,
      {
        actor: input.actor,
        actionType: "task_status.updated",
        taskStatusId: taskStatus.id,
        commandInput: input.value,
        beforeState: {
          id: before.id,
          name: before.name,
          category: before.category,
          sortOrder: before.sortOrder,
          status: before.status
        },
        afterState: {
          id: taskStatus.id,
          name: taskStatus.name,
          category: taskStatus.category,
          sortOrder: taskStatus.sortOrder,
          status: taskStatus.status
        },
        permissionReason: decision.reason
      },
      transactionDataSource
    );

    return { ok: true, taskStatus };
  });
}

async function archiveTaskStatus(
  deps: TaskStatusWorkspaceDeps,
  input: WorkspaceInput & { statusId: string }
): Promise<TaskStatusResult> {
  if (
    !deps.dataSource.archiveTaskStatus ||
    !deps.dataSource.listTaskStatuses ||
    !deps.dataSource.appendAuditEvent ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageTaskStatuses({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.archiveTaskStatus ||
      !transactionDataSource.listTaskStatuses ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { ok: false, status: 501, error: "persistence_not_configured" };
    }
    const before = (await transactionDataSource.listTaskStatuses(input.actor.tenantId)).find(
      (status) => status.id === input.statusId
    );
    if (!before) return { ok: false, status: 404, error: "task_status_not_found" };
    if (before.isSystem) {
      return { ok: false, status: 409, error: "system_task_status_required" };
    }

    const taskStatus = await transactionDataSource.archiveTaskStatus(
      input.actor.tenantId,
      input.statusId
    );
    if (!taskStatus) return { ok: false, status: 404, error: "task_status_not_found" };

    await appendTaskStatusAudit(
      deps,
      {
        actor: input.actor,
        actionType: "task_status.archived",
        taskStatusId: taskStatus.id,
        commandInput: { id: taskStatus.id },
        beforeState: { id: before.id, status: before.status },
        afterState: { id: taskStatus.id, status: taskStatus.status },
        permissionReason: decision.reason
      },
      transactionDataSource
    );

    return { ok: true, taskStatus };
  });
}
