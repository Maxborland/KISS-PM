import type { TenantUser } from "@kiss-pm/domain";
import { authorizeOpportunityFinalize } from "./finalizeOpportunityAuthorization";
import { isFinalOpportunityStatus } from "./opportunityStatus";
import type {
  FinalizeOpportunityResult,
  OpportunityFinalActionInput,
  ProjectIntakeServiceDeps
} from "./types";

export async function finalizeOpportunity(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
    finalAction: OpportunityFinalActionInput;
  }
): Promise<FinalizeOpportunityResult> {
  const authorization = await authorizeOpportunityFinalize(deps, input);
  if (!authorization.ok) return authorization;

  const opportunity =
    await deps.dataSource.findOpportunityById!(input.actor.tenantId, input.opportunityId);
  if (!opportunity) return { ok: false, status: 404, error: "opportunity_not_found" };
  if (isFinalOpportunityStatus(opportunity.status)) {
    return { ok: false, status: 409, error: "opportunity_final_action_locked" };
  }

  const updatedOpportunity = await deps.runDataSourceTransaction(
    async (transactionDataSource) => {
      if (!transactionDataSource.finalizeOpportunity) {
        throw new Error("transactional_opportunity_finalize_not_configured");
      }

      const updated = await transactionDataSource.finalizeOpportunity({
        tenantId: input.actor.tenantId,
        opportunityId: opportunity.id,
        status: input.finalAction.status
      });
      if (!updated) {
        return undefined;
      }
      await deps.appendManagementAuditEvent(
        {
          tenantId: input.actor.tenantId,
          actorUserId: input.actor.id,
          actionType: `opportunity.${input.finalAction.status}`,
          sourceWorkflow: "crm_intake",
          sourceEntity: {
            type: "Opportunity",
            id: opportunity.id
          },
          commandInput: {
            opportunityId: opportunity.id,
            reason: input.finalAction.reason
          },
          beforeState: opportunity,
          afterState: updated,
          permissionResult: authorization.decision
        },
        transactionDataSource
      );

      return updated;
    }
  );

  if (!updatedOpportunity) {
    return { ok: false, status: 409, error: "opportunity_final_action_locked" };
  }

  return { ok: true, status: 200, opportunity: updatedOpportunity };
}
