import { canManageOpportunities } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { appendDeniedAudit } from "./audit";
import type {
  AuthorizedResult,
  ProjectIntakeServiceDeps
} from "./types";

export async function authorizeOpportunityUpdate(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
  }
): Promise<AuthorizedResult> {
  if (
    !deps.dataSource.findOpportunityById ||
    !deps.dataSource.findClientById ||
    !deps.dataSource.findContactById ||
    !deps.dataSource.findProjectTypeById ||
    !deps.dataSource.updateOpportunity ||
    !deps.dataSource.withTransaction ||
    !deps.dataSource.appendAuditEvent
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageOpportunities({
    actor: input.actor,
    profile: await deps.getActorProfile(input.actor),
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) {
    await appendDeniedAudit(deps, {
      actor: input.actor,
      actionType: "opportunity.update_denied",
      sourceEntity: {
        type: "Opportunity",
        id: input.opportunityId
      },
      commandInput: { opportunityId: input.opportunityId },
      permissionResult: decision,
      error: decision.reason
    });
    return { ok: false, status: 403, error: decision.reason };
  }

  return { ok: true, decision };
}
