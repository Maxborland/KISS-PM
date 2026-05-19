import type { TenantUser } from "@kiss-pm/domain";
import { isSingleUseActivationError } from "./activationErrors";
import { authorizeProjectActivation } from "./authorization";
import { buildFeasibilityAssessment } from "./feasibilityAssessment";
import { isFinalOpportunityStatus } from "./opportunityStatus";
import type {
  ActivateProjectFromOpportunityResult,
  ProjectActivationInput,
  ProjectIntakeServiceDeps
} from "./types";

export async function activateProjectFromOpportunity(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
    activation: ProjectActivationInput;
  }
): Promise<ActivateProjectFromOpportunityResult> {
  const authorization = await authorizeProjectActivation(deps, input);
  if (!authorization.ok) return authorization;

  const opportunity =
    await deps.dataSource.findOpportunityById!(input.actor.tenantId, input.opportunityId);
  if (!opportunity) return { ok: false, status: 404, error: "opportunity_not_found" };

  const activation = await deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.findOpportunityById ||
      !transactionDataSource.lockTenantResourcePlanning ||
      !transactionDataSource.createProjectDraftFromOpportunity ||
      !transactionDataSource.activateProjectDraft
    ) {
      throw new Error("transactional_project_activation_not_configured");
    }

    await transactionDataSource.lockTenantResourcePlanning(input.actor.tenantId);

    const currentOpportunity = await transactionDataSource.findOpportunityById(
      input.actor.tenantId,
      opportunity.id
    );
    if (!currentOpportunity) {
      return { ok: false as const, error: "opportunity_not_found", status: 404 as const };
    }
    if (isFinalOpportunityStatus(currentOpportunity.status)) {
      return {
        ok: false as const,
        error: "opportunity_not_activatable",
        status: 409 as const
      };
    }
    if (!currentOpportunity.feasibilityStatus) {
      return { ok: false as const, error: "feasibility_required", status: 400 as const };
    }

    const currentAssessment = await buildFeasibilityAssessment(
      transactionDataSource,
      input.actor.tenantId,
      currentOpportunity
    );
    if (currentAssessment.status === "blocked") {
      return {
        ok: false as const,
        error: "opportunity_not_activatable",
        status: 409 as const
      };
    }
    if (currentAssessment.status === "conflict" && !input.activation.acceptedRiskReason) {
      return {
        ok: false as const,
        error: "risk_acceptance_required",
        status: 409 as const
      };
    }

    const draftProject =
      await transactionDataSource.createProjectDraftFromOpportunity({
        id: input.activation.id,
        tenantId: input.actor.tenantId,
        sourceOpportunityId: currentOpportunity.id,
        title: currentOpportunity.title,
        clientName: currentOpportunity.clientName,
        clientId: currentOpportunity.clientId,
        projectTypeId: currentOpportunity.projectTypeId,
        status: "draft",
        plannedStart: currentOpportunity.plannedStart,
        plannedFinish: currentOpportunity.plannedFinish,
        contractValue: currentOpportunity.contractValue,
        plannedHours: currentOpportunity.plannedHours,
        templateId: currentOpportunity.templateId,
        demand: currentOpportunity.demand
      });
    const activatedProject = await transactionDataSource.activateProjectDraft({
      tenantId: input.actor.tenantId,
      projectId: draftProject.id
    });
    await deps.appendManagementAuditEvent(
      {
        tenantId: input.actor.tenantId,
        actorUserId: input.actor.id,
        actionType: "project.activated",
        sourceWorkflow: "crm_intake",
        sourceEntity: {
          type: "Project",
          id: activatedProject.id
        },
        commandInput: {
          opportunityId: currentOpportunity.id,
          projectId: activatedProject.id,
          draftProjectId: draftProject.id,
          acceptedRiskReason: input.activation.acceptedRiskReason,
          currentFeasibilityStatus: currentAssessment.status
        },
        beforeState: draftProject,
        afterState: activatedProject,
        permissionResult: authorization.decision
      },
      transactionDataSource
    );

    return { ok: true as const, project: activatedProject };
  }).catch((error: unknown) => {
    if (isSingleUseActivationError(error)) {
      return {
        ok: false as const,
        error: "opportunity_not_activatable",
        status: 409 as const
      };
    }

    throw error;
  });

  if (!activation.ok) return activation;

  return { ok: true, status: 201, project: activation.project };
}
