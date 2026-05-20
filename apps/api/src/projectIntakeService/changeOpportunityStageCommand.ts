import type { TenantUser } from "@kiss-pm/domain";
import { authorizeOpportunityStageChange } from "./authorization";
import { isFinalOpportunityStatus } from "./opportunityStatus";
import type {
  ChangeOpportunityStageResult,
  ProjectIntakeServiceDeps
} from "./types";

export async function changeOpportunityStage(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
    stageId: string;
  }
): Promise<ChangeOpportunityStageResult> {
  const authorization = await authorizeOpportunityStageChange(deps, input);
  if (!authorization.ok) return authorization;

  const opportunity = await deps.dataSource.findOpportunityById!(
    input.actor.tenantId,
    input.opportunityId
  );
  if (!opportunity) return { ok: false, status: 404, error: "opportunity_not_found" };
  if (isFinalOpportunityStatus(opportunity.status)) {
    return { ok: false, status: 409, error: "opportunity_stage_locked" };
  }

  const stage = await deps.dataSource.findDealStageById!(
    input.actor.tenantId,
    input.stageId
  );
  if (!stage || stage.status !== "active") {
    return { ok: false, status: 404, error: "deal_stage_not_found" };
  }

  const opportunityAfterChange = await deps.runDataSourceTransaction(
    async (transactionDataSource) => {
      if (!transactionDataSource.updateOpportunityStage) {
        throw new Error("transactional_opportunity_stage_not_configured");
      }

      const updated = await transactionDataSource.updateOpportunityStage({
        tenantId: input.actor.tenantId,
        opportunityId: opportunity.id,
        stageId: stage.id
      });
      if (!updated) {
        return undefined;
      }
      await deps.appendManagementAuditEvent(
        {
          tenantId: input.actor.tenantId,
          actorUserId: input.actor.id,
          actionType: "opportunity.stage_updated",
          sourceWorkflow: "crm_intake",
          sourceEntity: {
            type: "Opportunity",
            id: opportunity.id
          },
          commandInput: {
            opportunityId: opportunity.id,
            stageId: stage.id
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

  if (!opportunityAfterChange) {
    return { ok: false, status: 409, error: "opportunity_stage_locked" };
  }

  return { ok: true, status: 200, opportunity: opportunityAfterChange };
}
