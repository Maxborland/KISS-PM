import type { PolicyDecision } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type {
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "./apiTypes";

type AuditEntity = {
  type: string;
  id: string;
};

type GovernedAuditDraft = {
  actionType: string;
  sourceEntity: AuditEntity;
  commandInput: Record<string, unknown>;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
};

type GovernedMutationInput<
  T,
  TDataSource extends ManagementAuditDataSource
> = {
  actor: TenantUser;
  permissionResult: PolicyDecision;
  sourceWorkflow: string;
  deniedAudit: Pick<GovernedAuditDraft, "actionType" | "sourceEntity" | "commandInput">;
  execute(transactionDataSource: TDataSource): Promise<T>;
  successAudit(value: T): GovernedAuditDraft;
  runDataSourceTransaction<R>(
    operation: (transactionDataSource: TDataSource) => Promise<R>
  ): Promise<R>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type GovernedDeniedAuditInput = {
  actor: TenantUser;
  permissionResult: PolicyDecision;
  sourceWorkflow: string;
  deniedAudit: Pick<GovernedAuditDraft, "actionType" | "sourceEntity" | "commandInput">;
  appendManagementAuditEvent(input: ManagementAuditEventInput): Promise<string>;
};

export type GovernedMutationResult<T> =
  | { ok: true; value: T }
  | GovernedDeniedResult;

export type GovernedDeniedResult = {
  ok: false;
  status: 403;
  error: PolicyDecision["reason"];
};

export async function runGovernedMutation<
  T,
  TDataSource extends ManagementAuditDataSource
>(
  input: GovernedMutationInput<T, TDataSource>
): Promise<GovernedMutationResult<T>> {
  if (!input.permissionResult.allowed) {
    return writeGovernedDeniedAudit(input);
  }

  const value = await input.runDataSourceTransaction(async (transactionDataSource) => {
    const mutationResult = await input.execute(transactionDataSource);
    const audit = input.successAudit(mutationResult);
    await input.appendManagementAuditEvent(
      {
        tenantId: input.actor.tenantId,
        actorUserId: input.actor.id,
        actionType: audit.actionType,
        sourceWorkflow: input.sourceWorkflow,
        sourceEntity: audit.sourceEntity,
        commandInput: audit.commandInput,
        beforeState: audit.beforeState ?? null,
        afterState: audit.afterState ?? null,
        permissionResult: input.permissionResult
      },
      transactionDataSource
    );
    return mutationResult;
  });

  return { ok: true, value };
}

export async function writeGovernedDeniedAudit(
  input: GovernedDeniedAuditInput
): Promise<GovernedDeniedResult> {
  await input.appendManagementAuditEvent({
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.deniedAudit.actionType,
    sourceWorkflow: input.sourceWorkflow,
    sourceEntity: input.deniedAudit.sourceEntity,
    commandInput: input.deniedAudit.commandInput,
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: {
      status: "denied",
      error: input.permissionResult.reason
    }
  });
  return { ok: false, status: 403, error: input.permissionResult.reason };
}
