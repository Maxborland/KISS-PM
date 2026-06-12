import type { TenantUser } from "@kiss-pm/domain";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "../apiTypes";

type ProjectTaskStageAuditDeps = {
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export async function appendProjectTaskStageAudit(
  deps: ProjectTaskStageAuditDeps,
  input: {
    actor: TenantUser;
    actionType: string;
    stageId: string;
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
      sourceEntity: { type: "ProjectTaskStage", id: input.stageId },
      commandInput: input.commandInput,
      beforeState: input.beforeState,
      afterState: input.afterState,
      permissionResult: {
        allowed: true,
        reason: input.permissionReason,
        permission: "tenant.project_stages.manage"
      }
    },
    auditDataSource
  );
}
