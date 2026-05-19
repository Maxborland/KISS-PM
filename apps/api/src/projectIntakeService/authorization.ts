import {
  canManageOpportunities,
  canManageProjects,
  canManageProjectActivation,
  canReadResourceFeasibility
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { appendDeniedAudit } from "./audit";
import type {
  AuthorizedResult,
  ProjectIntakeServiceDeps
} from "./types";

export async function authorizeOpportunityCreate(
  deps: ProjectIntakeServiceDeps,
  actor: TenantUser
): Promise<AuthorizedResult> {
  if (
    !deps.dataSource.createOpportunity ||
    !deps.dataSource.listOpportunities ||
    !deps.dataSource.findClientById ||
    !deps.dataSource.findContactById ||
    !deps.dataSource.findProjectTypeById ||
    !deps.dataSource.findDealStageById ||
    !deps.dataSource.withTransaction ||
    !deps.dataSource.appendAuditEvent
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageOpportunities({
    actor,
    profile: await deps.getActorProfile(actor),
    targetTenantId: actor.tenantId
  });
  if (!decision.allowed) {
    await appendDeniedAudit(deps, {
      actor,
      actionType: "opportunity.create_denied",
      sourceEntity: { type: "Opportunity", id: "unknown" },
      commandInput: { endpoint: "createOpportunity" },
      permissionResult: decision,
      error: decision.reason
    });
    return { ok: false, status: 403, error: decision.reason };
  }

  return { ok: true, decision };
}

export async function authorizeOpportunityStageChange(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
  }
): Promise<AuthorizedResult> {
  if (
    !deps.dataSource.findOpportunityById ||
    !deps.dataSource.findDealStageById ||
    !deps.dataSource.updateOpportunityStage ||
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
      actionType: "opportunity.stage_update_denied",
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

export async function authorizeOpportunityFeasibility(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
  }
): Promise<AuthorizedResult> {
  if (
    !deps.dataSource.findOpportunityById ||
    !deps.dataSource.updateOpportunityFeasibility ||
    !deps.dataSource.listPositions ||
    !deps.dataSource.listWorkspaceUsers ||
    !deps.dataSource.listProjects ||
    !deps.dataSource.withTransaction ||
    !deps.dataSource.appendAuditEvent
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const profile = await deps.getActorProfile(input.actor);
  const feasibilityDecision = canReadResourceFeasibility({
    actor: input.actor,
    profile,
    targetTenantId: input.actor.tenantId
  });
  if (!feasibilityDecision.allowed) {
    await appendDeniedAudit(deps, {
      actor: input.actor,
      actionType: "opportunity.feasibility_denied",
      sourceEntity: {
        type: "Opportunity",
        id: input.opportunityId
      },
      commandInput: { opportunityId: input.opportunityId },
      permissionResult: feasibilityDecision,
      error: feasibilityDecision.reason
    });
    return { ok: false, status: 403, error: feasibilityDecision.reason };
  }

  const manageDecision = canManageOpportunities({
    actor: input.actor,
    profile,
    targetTenantId: input.actor.tenantId
  });
  if (!manageDecision.allowed) {
    await appendDeniedAudit(deps, {
      actor: input.actor,
      actionType: "opportunity.feasibility_denied",
      sourceEntity: {
        type: "Opportunity",
        id: input.opportunityId
      },
      commandInput: { opportunityId: input.opportunityId },
      permissionResult: manageDecision,
      error: manageDecision.reason
    });
    return { ok: false, status: 403, error: manageDecision.reason };
  }

  return { ok: true, decision: manageDecision };
}

export async function authorizeProjectActivation(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
  }
): Promise<AuthorizedResult> {
  if (
    !deps.dataSource.findOpportunityById ||
    !deps.dataSource.activateProjectFromOpportunity ||
    !deps.dataSource.lockTenantResourcePlanning ||
    !deps.dataSource.listPositions ||
    !deps.dataSource.listWorkspaceUsers ||
    !deps.dataSource.listProjects ||
    !deps.dataSource.withTransaction ||
    !deps.dataSource.appendAuditEvent
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const profile = await deps.getActorProfile(input.actor);
  const decision = canManageProjectActivation({
    actor: input.actor,
    profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) {
    await appendDeniedAudit(deps, {
      actor: input.actor,
      actionType: "project.activation_denied",
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

  const projectDecision = canManageProjects({
    actor: input.actor,
    profile,
    targetTenantId: input.actor.tenantId
  });
  if (!projectDecision.allowed) {
    await appendDeniedAudit(deps, {
      actor: input.actor,
      actionType: "project.activation_denied",
      sourceEntity: {
        type: "Opportunity",
        id: input.opportunityId
      },
      commandInput: { opportunityId: input.opportunityId },
      permissionResult: projectDecision,
      error: projectDecision.reason
    });
    return { ok: false, status: 403, error: projectDecision.reason };
  }

  return { ok: true, decision };
}
