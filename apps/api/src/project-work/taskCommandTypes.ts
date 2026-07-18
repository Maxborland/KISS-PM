import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { TaskActivityRecord, TaskRecord } from "@kiss-pm/persistence";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  ProjectRecord
} from "../apiTypes";
import type {
  CreateTaskBody,
  TaskCommentBody,
  UpdateTaskBody,
  UpdateTaskStatusBody
} from "../projectWorkParsers";

export type TaskCommandWorkspaceDeps = {
  dataSource: ApiTenantDataSource;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export type WorkspaceInput = {
  actor: TenantUser;
  profile: AccessProfile;
};

export type WorkspaceError = {
  ok: false;
  status: 400 | 403 | 404 | 409 | 501;
  error: string;
  currentVersions?: { taskUpdatedAt: string };
};

export type PreflightResult = { ok: true } | WorkspaceError;

// Единый конверт конфликта optimistic-lock: currentVersions даёт клиенту версию
// для честного refresh/retry. Использовать во ВСЕХ командах вместо литералов —
// дрейф форм между PATCH и status-переходом уже случался (ревью #252).
export function taskVersionConflict(updatedAt: Date): WorkspaceError {
  return {
    ok: false,
    status: 409,
    error: "task_version_conflict",
    currentVersions: { taskUpdatedAt: updatedAt.toISOString() }
  };
}

export type TaskResult =
  | { ok: true; task: TaskRecord; project?: ProjectRecord; planVersion?: number | null }
  | WorkspaceError;

export type CommentResult = { ok: true; activity: TaskActivityRecord } | WorkspaceError;

export type CreateWorkspaceInboxTaskInput = WorkspaceInput & { body: CreateTaskBody };
export type CreateProjectTaskInput = WorkspaceInput & {
  projectId: string;
  body: CreateTaskBody;
};
export type UpdateTaskInput = WorkspaceInput & { taskId: string; body: UpdateTaskBody };
export type ArchiveTaskInput = WorkspaceInput & { taskId: string };
export type TransitionTaskStatusInput = WorkspaceInput & {
  projectId: string;
  taskId: string;
  body: UpdateTaskStatusBody;
  clientUpdatedAt?: Date;
};
export type CreateTaskCommentInput = WorkspaceInput & {
  taskId: string;
  body: TaskCommentBody;
};
