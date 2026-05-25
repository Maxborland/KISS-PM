import type { PolicyDecision } from "@kiss-pm/access-control";
import type { TenantId, TenantUser } from "@kiss-pm/domain";
import {
  createTenantOrgStructureRepository,
  type KissPmDatabase,
  type OrgStructureReplaceInput,
  type TenantOrgStructureSnapshot
} from "@kiss-pm/persistence";

import type { ManagementAuditEventInput } from "../apiTypes";
import type { ApiTenantDataSource } from "../apiTypes";

export function tenantOrgStructureErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.startsWith("tenant_org_")) {
    return error.message;
  }
  return null;
}

export async function replaceTenantOrgStructureCommand(input: {
  db: KissPmDatabase;
  tenantId: TenantId;
  actor: TenantUser;
  body: OrgStructureReplaceInput;
  permissionResult: PolicyDecision;
  auditDataSource: ApiTenantDataSource;
  appendManagementAuditEvent: (
    event: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ) => Promise<string>;
}): Promise<TenantOrgStructureSnapshot> {
  const repository = createTenantOrgStructureRepository(input.db);
  const before = await repository.getOrgStructure(input.tenantId);
  const orgStructure = await repository.replaceOrgStructure(input.tenantId, input.body);

  await input.appendManagementAuditEvent(
    {
      tenantId: input.tenantId,
      actorUserId: input.actor.id,
      actionType: "tenant.org_structure.updated",
      sourceWorkflow: "tenant.org_structure",
      sourceEntity: { type: "tenant_org_structure", id: input.tenantId },
      commandInput: input.body,
      beforeState: before,
      afterState: orgStructure,
      permissionResult: input.permissionResult
    },
    input.auditDataSource
  );

  return orgStructure;
}
