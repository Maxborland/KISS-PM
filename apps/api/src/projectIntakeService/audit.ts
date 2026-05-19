import type { TenantUser } from "@kiss-pm/domain";
import type { ProjectIntakeServiceDeps } from "./types";

export async function appendDeniedAudit(
  deps: Pick<ProjectIntakeServiceDeps, "appendManagementAuditEvent">,
  input: {
    actor: TenantUser;
    actionType: string;
    sourceEntity: {
      type: string;
      id: string;
    };
    commandInput: Record<string, unknown>;
    permissionResult: Record<string, unknown>;
    error: string;
  }
) {
  await deps.appendManagementAuditEvent({
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "crm_intake",
    sourceEntity: input.sourceEntity,
    commandInput: input.commandInput,
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: {
      status: "denied",
      error: input.error
    }
  });
}
