import type { TenantUser } from "@kiss-pm/domain";
import { authorizeOpportunityFeasibility } from "./authorization";
import { buildFeasibilityAssessment } from "./feasibilityAssessment";
import { isFinalOpportunityStatus } from "./opportunityStatus";
import type {
  CheckOpportunityFeasibilityResult,
  ProjectIntakeServiceDeps
} from "./types";

export async function checkOpportunityFeasibility(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
  }
): Promise<CheckOpportunityFeasibilityResult> {
  const authorization = await authorizeOpportunityFeasibility(deps, input);
  if (!authorization.ok) return authorization;

  const opportunity =
    await deps.dataSource.findOpportunityById!(input.actor.tenantId, input.opportunityId);
  if (!opportunity) return { ok: false, status: 404, error: "opportunity_not_found" };
  if (isFinalOpportunityStatus(opportunity.status)) {
    return { ok: false, status: 409, error: "opportunity_not_feasible" };
  }

  const assessment = await buildFeasibilityAssessment(
    deps.dataSource,
    input.actor.tenantId,
    opportunity
  );
  const nextStatus = assessment.status === "ok" || assessment.status === "warning"
    ? "ready_to_activate"
    : "feasibility";

  const updatedOpportunity = await deps.runDataSourceTransaction(
    async (transactionDataSource) => {
      if (!transactionDataSource.updateOpportunityFeasibility) {
        throw new Error("transactional_opportunity_feasibility_not_configured");
      }

      const updated = await transactionDataSource.updateOpportunityFeasibility({
        tenantId: input.actor.tenantId,
        opportunityId: opportunity.id,
        status: nextStatus,
        feasibilityStatus: assessment.status,
        feasibilityResult: assessment as unknown as Record<string, unknown>
      });
      if (!updated) {
        return undefined;
      }
      await deps.appendManagementAuditEvent(
        {
          tenantId: input.actor.tenantId,
          actorUserId: input.actor.id,
          actionType: "opportunity.feasibility_checked",
          sourceWorkflow: "crm_intake",
          sourceEntity: {
            type: "Opportunity",
            id: opportunity.id
          },
          commandInput: { opportunityId: opportunity.id },
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
    return { ok: false, status: 409, error: "opportunity_not_feasible" };
  }

  return {
    ok: true,
    status: 200,
    opportunity: updatedOpportunity,
    assessment
  };
}
