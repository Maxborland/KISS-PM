import type { TenantUser } from "@kiss-pm/domain";
import type { OpportunityUpdateInput } from "../apiTypes";
import { resolveOpportunityLinks } from "./opportunityLinks";
import { isFinalOpportunityStatus } from "./opportunityStatus";
import type {
  ProjectIntakeServiceDeps,
  UpdateOpportunityResult
} from "./types";
import { authorizeOpportunityUpdate } from "./updateOpportunityAuthorization";

export async function updateOpportunity(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
    input: OpportunityUpdateInput;
  }
): Promise<UpdateOpportunityResult> {
  const authorization = await authorizeOpportunityUpdate(deps, input);
  if (!authorization.ok) return authorization;

  const opportunity = await deps.dataSource.findOpportunityById!(
    input.actor.tenantId,
    input.opportunityId
  );
  if (!opportunity) return { ok: false, status: 404, error: "opportunity_not_found" };
  if (isFinalOpportunityStatus(opportunity.status)) {
    return { ok: false, status: 409, error: "opportunity_update_locked" };
  }

  const linked = await resolveOpportunityLinks(deps.dataSource, input.actor.tenantId, {
    ...input.input,
    id: opportunity.id,
    status: opportunity.status,
    clientName: opportunity.clientName,
    contactName: opportunity.contactName,
    projectType: opportunity.projectType
  });
  if (!linked.ok) return linked;

  const updatedOpportunity = await deps.runDataSourceTransaction(
    async (transactionDataSource) => {
      if (!transactionDataSource.updateOpportunity) {
        throw new Error("transactional_opportunity_update_not_configured");
      }

      const updated = await transactionDataSource.updateOpportunity({
        ...input.input,
        id: opportunity.id,
        status: opportunity.status,
        clientName: linked.client.name,
        contactName: linked.contact.name,
        projectType: linked.projectType.name
      });
      await deps.appendManagementAuditEvent(
        {
          tenantId: input.actor.tenantId,
          actorUserId: input.actor.id,
          actionType: "opportunity.updated",
          sourceWorkflow: "crm_intake",
          sourceEntity: {
            type: "Opportunity",
            id: opportunity.id
          },
          commandInput: {
            opportunityId: opportunity.id,
            ...input.input,
            clientName: linked.client.name,
            contactName: linked.contact.name,
            projectType: linked.projectType.name
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

  return { ok: true, status: 200, opportunity: updatedOpportunity };
}
