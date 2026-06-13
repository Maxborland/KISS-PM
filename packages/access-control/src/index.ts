import type { TenantId, TenantUser } from "@kiss-pm/domain";

export const permissions = [
  "tenant.users.read",
  "tenant.users.manage",
  "tenant.access_profiles.read",
  "tenant.access_profiles.manage",
  "tenant.positions.read",
  "tenant.positions.manage",
  "tenant.audit_events.read",
  "tenant.workspace_config.read",
  "tenant.workspace_config.manage",
  "tenant.absences.read",
  "tenant.absences.manage",
  "tenant.org_structure.read",
  "tenant.org_structure.manage",
  "tenant.clients.read",
  "tenant.clients.manage",
  "tenant.contacts.read",
  "tenant.contacts.manage",
  "tenant.products.read",
  "tenant.products.manage",
  "tenant.project_types.read",
  "tenant.project_types.manage",
  "tenant.deal_stages.read",
  "tenant.deal_stages.manage",
  "tenant.crm_pipelines.read",
  "tenant.crm_pipelines.manage",
  "tenant.crm_pipeline_rules.manage",
  "tenant.crm_pipeline_automations.manage",
  "tenant.opportunities.read",
  "tenant.opportunities.manage",
  "tenant.projects.read",
  "tenant.projects.manage",
  "tenant.project_plan.read",
  "tenant.project_plan.manage",
  "tenant.project_baselines.manage",
  "tenant.project_resources.read",
  "tenant.project_resources.manage",
  "tenant.planning_scenarios.preview",
  "tenant.planning_scenarios.apply",
  "tenant.kpi_definitions.read",
  "tenant.kpi_definitions.manage",
  "tenant.control_signals.read",
  "tenant.control_signals.manage",
  "tenant.management_actions.execute",
  "tenant.corrective_actions.manage",
  "tenant.control_surfaces.read",
  "tenant.control_surfaces.manage",
  "tenant.control_surfaces.publish",
  "tenant.retrospectives.read",
  "tenant.retrospectives.manage",
  "tenant.template_improvements.apply",
  "tenant.background_jobs.read",
  "tenant.background_jobs.manage",
  "tenant.communications.read",
  "tenant.communications.manage",
  "tenant.tasks.create",
  "tenant.tasks.edit",
  "tenant.tasks.delete",
  "tenant.task_statuses.manage",
  "tenant.project_stages.manage",
  "tenant.project_activation.manage",
  "tenant.resource_feasibility.read",
  "profile.read",
  "profile.update",
  "workspace.theme.manage"
] as const;

export type Permission = (typeof permissions)[number];

export type AccessProfile = {
  id: string;
  permissions: readonly Permission[];
};

export type PolicyDecisionReason =
  | "same_tenant_permission_granted"
  | "cross_tenant_denied"
  | "permission_missing";

export type PolicyDecision = {
  allowed: boolean;
  reason: PolicyDecisionReason;
};

export function createAccessProfile(input: AccessProfile): AccessProfile {
  return {
    id: input.id,
    permissions: [...input.permissions]
  };
}

export function isPermission(value: string): value is Permission {
  return permissions.includes(value as Permission);
}

export function canReadTenantUsers(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.users.read"
  });
}

export function canManageTenantUsers(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.users.manage"
  });
}

export function canReadAccessProfiles(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.access_profiles.read"
  });
}

export function canManageAccessProfiles(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.access_profiles.manage"
  });
}

export function canReadAuditEvents(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.audit_events.read"
  });
}

export function canReadBackgroundJobs(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.background_jobs.read"
  });
}

export function canManageBackgroundJobs(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.background_jobs.manage"
  });
}

export function canReadPositions(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.positions.read"
  });
}

export function canReadWorkspaceConfig(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.workspace_config.read"
  });
}

export function canManageWorkspaceConfig(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.workspace_config.manage"
  });
}

export function canReadAbsences(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.absences.read"
  });
}

export function canManageAbsences(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.absences.manage"
  });
}

export function canReadOrgStructure(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.org_structure.read"
  });
}

export function canManageOrgStructure(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.org_structure.manage"
  });
}

export function canReadOpportunities(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.opportunities.read"
  });
}

export function canReadClients(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.clients.read"
  });
}

export function canManageClients(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.clients.manage"
  });
}

export function canReadContacts(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.contacts.read"
  });
}

export function canManageContacts(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.contacts.manage"
  });
}

export function canReadProducts(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.products.read"
  });
}

export function canManageProducts(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.products.manage"
  });
}

export function canReadCommunications(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.communications.read"
  });
}

export function canManageCommunications(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.communications.manage"
  });
}

export function canReadProjectTypes(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_types.read"
  });
}

export function canManageProjectTypes(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_types.manage"
  });
}

export function canReadDealStages(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.deal_stages.read"
  });
}

export function canManageDealStages(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.deal_stages.manage"
  });
}


export function canReadCrmPipelines(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.crm_pipelines.read"
  });
}

export function canManageCrmPipelines(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.crm_pipelines.manage"
  });
}

export function canManageCrmPipelineRules(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.crm_pipeline_rules.manage"
  });
}

export function canManageCrmPipelineAutomations(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.crm_pipeline_automations.manage"
  });
}

export function canManageOpportunities(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.opportunities.manage"
  });
}

export function canReadProjects(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.projects.read"
  });
}

export function canManageProjects(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.projects.manage"
  });
}

export function canReadProjectPlan(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_plan.read"
  });
}

export function canManageProjectPlan(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_plan.manage"
  });
}

export function canManageProjectBaselines(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_baselines.manage"
  });
}

export function canReadProjectResources(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_resources.read"
  });
}

export function canManageProjectResources(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_resources.manage"
  });
}

export function canPreviewPlanningScenarios(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.planning_scenarios.preview"
  });
}

export function canApplyPlanningScenarios(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.planning_scenarios.apply"
  });
}

export function canReadKpiDefinitions(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.kpi_definitions.read"
  });
}

export function canManageKpiDefinitions(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.kpi_definitions.manage"
  });
}

export function canReadControlSignals(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.control_signals.read"
  });
}

export function canManageControlSignals(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.control_signals.manage"
  });
}

export function canExecuteManagementActions(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.management_actions.execute"
  });
}

export function canManageCorrectiveActions(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.corrective_actions.manage"
  });
}

export function canReadControlSurfaces(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.control_surfaces.read"
  });
}

export function canManageControlSurfaces(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.control_surfaces.manage"
  });
}

export function canPublishControlSurfaces(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.control_surfaces.publish"
  });
}

export function canReadRetrospectives(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.retrospectives.read"
  });
}

export function canManageRetrospectives(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.retrospectives.manage"
  });
}

export function canApplyTemplateImprovements(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.template_improvements.apply"
  });
}

export function canCreateTasks(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.tasks.create"
  });
}

export function canEditTasks(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.tasks.edit"
  });
}

export function canDeleteTasks(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.tasks.delete"
  });
}

export function canManageTaskStatuses(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.task_statuses.manage"
  });
}

export function canManageProjectStages(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_stages.manage"
  });
}

export function canManageProjectActivation(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.project_activation.manage"
  });
}

export function canReadResourceFeasibility(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.resource_feasibility.read"
  });
}

export function canManagePositions(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "tenant.positions.manage"
  });
}

export function canUpdateProfile(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "profile.update"
  });
}

export function canManageWorkspaceTheme(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
}): PolicyDecision {
  return evaluateTenantPermission({
    ...input,
    permission: "workspace.theme.manage"
  });
}

function evaluateTenantPermission(input: {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
  permission: Permission;
}): PolicyDecision {
  if (input.actor.tenantId !== input.targetTenantId) {
    return {
      allowed: false,
      reason: "cross_tenant_denied"
    };
  }

  if (!input.profile.permissions.includes(input.permission)) {
    return {
      allowed: false,
      reason: "permission_missing"
    };
  }

  return {
    allowed: true,
    reason: "same_tenant_permission_granted"
  };
}
