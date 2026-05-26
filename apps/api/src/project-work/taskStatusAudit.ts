import type { TenantUser } from "@kiss-pm/domain";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "../apiTypes";

type TaskStatusAuditDeps = {
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export async function appendTaskStatusAudit(
  deps: TaskStatusAuditDeps,
  input: {
    actor: TenantUser;
    actionType: string;
    taskStatusId: string;
    commandInput: Record<string, unknown>;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    permissionReason: string;
  },
  auditDataSource: ApiTenantDataSource
) {
  await deps.appendManagementAuditEvent(
    {
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: input.actionType,
      sourceWorkflow: "project_work",
      sourceEntity: { type: "TaskStatus", id: input.taskStatusId },
      commandInput: input.commandInput,
      beforeState: input.beforeState,
      afterState: input.afterState,
      permissionResult: {
        allowed: true,
        reason: input.permissionReason,
        permission: "tenant.task_statuses.manage"
      }
    },
    auditDataSource
  );
}
