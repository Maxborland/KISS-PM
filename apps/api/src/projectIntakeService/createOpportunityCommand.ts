import type { TenantUser } from "@kiss-pm/domain";
import type { OpportunityInput } from "../apiTypes";
import { authorizeOpportunityCreate } from "./authorization";
import { validateOpportunityCustomFieldValues } from "./opportunityCustomFields";
import { resolveOpportunityLinks } from "./opportunityLinks";
import type {
  CreateOpportunityResult,
  ProjectIntakeServiceDeps
} from "./types";

export async function createOpportunity(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    input: OpportunityInput;
  }
): Promise<CreateOpportunityResult> {
  const authorization = await authorizeOpportunityCreate(deps, input.actor);
  if (!authorization.ok) return authorization;

  const inputWithOwner = {
    ...input.input,
    ownerUserId: input.input.ownerUserId ?? input.actor.id
  };
  const linked = await resolveOpportunityLinks(
    deps.dataSource,
    input.actor.tenantId,
    inputWithOwner
  );
  if (!linked.ok) return linked;
  const customFieldValidation = await validateOpportunityCustomFieldValues(
    deps.dataSource,
    input.actor.tenantId,
    inputWithOwner.customFieldValues
  );
  if (!customFieldValidation.ok) return customFieldValidation;

  const existing = await deps.dataSource.listOpportunities!(input.actor.tenantId);
  if (existing.some((opportunity) => opportunity.id === input.input.id)) {
    return { ok: false, status: 409, error: "opportunity_id_taken" };
  }

  let opportunity;
  try {
    opportunity = await deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (!transactionDataSource.createOpportunity) {
      throw new Error("transactional_opportunity_create_not_configured");
    }

    const createdOpportunity =
      await transactionDataSource.createOpportunity({
        ...inputWithOwner,
        clientName: linked.client.name,
        contactName: linked.contact.name,
        projectType: linked.projectType.name,
        customFieldValues: customFieldValidation.values
      });
    await deps.appendManagementAuditEvent(
      {
        tenantId: input.actor.tenantId,
        actorUserId: input.actor.id,
        actionType: "opportunity.created",
        sourceWorkflow: "crm_intake",
        sourceEntity: {
          type: "Opportunity",
          id: createdOpportunity.id
        },
        commandInput: {
          ...inputWithOwner,
          clientName: linked.client.name,
          contactName: linked.contact.name,
          projectType: linked.projectType.name,
          customFieldValues: customFieldValidation.values
        },
        beforeState: null,
        afterState: createdOpportunity,
        permissionResult: authorization.decision
      },
      transactionDataSource
    );

    return createdOpportunity;
    });
  } catch (error) {
    // Гонка pre-check (listOpportunities выше) не транзакционен: два параллельных create с одним id
    // оба проходят проверку, проигравший ловит opportunities_pkey (23505) → отдаём 409, а не 500.
    if ((error as { code?: unknown }).code === "23505") {
      return { ok: false, status: 409, error: "opportunity_id_taken" };
    }
    throw error;
  }

  return { ok: true, status: 201, opportunity };
}
