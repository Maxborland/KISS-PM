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

export type TenantPolicyInput = {
  actor: TenantUser;
  profile: AccessProfile;
  targetTenantId: TenantId;
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

// Каждый can* — типизированный фасад над одним permission: даёт greppable-имя
// и единственное место, где живёт строка права.
function tenantPermission(permission: Permission) {
  return (input: TenantPolicyInput): PolicyDecision =>
    evaluateTenantPermission({ ...input, permission });
}

export const canReadTenantUsers = tenantPermission("tenant.users.read");
export const canManageTenantUsers = tenantPermission("tenant.users.manage");
export const canReadAccessProfiles = tenantPermission("tenant.access_profiles.read");
export const canManageAccessProfiles = tenantPermission("tenant.access_profiles.manage");
export const canReadAuditEvents = tenantPermission("tenant.audit_events.read");
export const canReadBackgroundJobs = tenantPermission("tenant.background_jobs.read");
export const canManageBackgroundJobs = tenantPermission("tenant.background_jobs.manage");
export const canReadPositions = tenantPermission("tenant.positions.read");
export const canManagePositions = tenantPermission("tenant.positions.manage");
export const canReadWorkspaceConfig = tenantPermission("tenant.workspace_config.read");
export const canManageWorkspaceConfig = tenantPermission("tenant.workspace_config.manage");
export const canReadAbsences = tenantPermission("tenant.absences.read");
export const canManageAbsences = tenantPermission("tenant.absences.manage");
export const canReadOrgStructure = tenantPermission("tenant.org_structure.read");
export const canManageOrgStructure = tenantPermission("tenant.org_structure.manage");
export const canReadClients = tenantPermission("tenant.clients.read");
export const canManageClients = tenantPermission("tenant.clients.manage");
export const canReadContacts = tenantPermission("tenant.contacts.read");
export const canManageContacts = tenantPermission("tenant.contacts.manage");
export const canReadProducts = tenantPermission("tenant.products.read");
export const canManageProducts = tenantPermission("tenant.products.manage");
export const canReadCommunications = tenantPermission("tenant.communications.read");
export const canManageCommunications = tenantPermission("tenant.communications.manage");
export const canReadProjectTypes = tenantPermission("tenant.project_types.read");
export const canManageProjectTypes = tenantPermission("tenant.project_types.manage");
export const canReadDealStages = tenantPermission("tenant.deal_stages.read");
export const canManageDealStages = tenantPermission("tenant.deal_stages.manage");
export const canReadCrmPipelines = tenantPermission("tenant.crm_pipelines.read");
export const canManageCrmPipelines = tenantPermission("tenant.crm_pipelines.manage");
export const canManageCrmPipelineRules = tenantPermission("tenant.crm_pipeline_rules.manage");
export const canManageCrmPipelineAutomations = tenantPermission(
  "tenant.crm_pipeline_automations.manage"
);
export const canReadOpportunities = tenantPermission("tenant.opportunities.read");
export const canManageOpportunities = tenantPermission("tenant.opportunities.manage");
export const canReadProjects = tenantPermission("tenant.projects.read");
export const canManageProjects = tenantPermission("tenant.projects.manage");
export const canReadProjectPlan = tenantPermission("tenant.project_plan.read");
export const canManageProjectPlan = tenantPermission("tenant.project_plan.manage");
export const canManageProjectBaselines = tenantPermission("tenant.project_baselines.manage");
export const canReadProjectResources = tenantPermission("tenant.project_resources.read");
export const canManageProjectResources = tenantPermission("tenant.project_resources.manage");
export const canPreviewPlanningScenarios = tenantPermission("tenant.planning_scenarios.preview");
export const canApplyPlanningScenarios = tenantPermission("tenant.planning_scenarios.apply");
export const canReadKpiDefinitions = tenantPermission("tenant.kpi_definitions.read");
export const canManageKpiDefinitions = tenantPermission("tenant.kpi_definitions.manage");
export const canReadControlSignals = tenantPermission("tenant.control_signals.read");
export const canManageControlSignals = tenantPermission("tenant.control_signals.manage");
export const canExecuteManagementActions = tenantPermission("tenant.management_actions.execute");
export const canManageCorrectiveActions = tenantPermission("tenant.corrective_actions.manage");
export const canReadControlSurfaces = tenantPermission("tenant.control_surfaces.read");
export const canManageControlSurfaces = tenantPermission("tenant.control_surfaces.manage");
export const canPublishControlSurfaces = tenantPermission("tenant.control_surfaces.publish");
export const canReadRetrospectives = tenantPermission("tenant.retrospectives.read");
export const canManageRetrospectives = tenantPermission("tenant.retrospectives.manage");
export const canApplyTemplateImprovements = tenantPermission("tenant.template_improvements.apply");
export const canCreateTasks = tenantPermission("tenant.tasks.create");
export const canEditTasks = tenantPermission("tenant.tasks.edit");
export const canDeleteTasks = tenantPermission("tenant.tasks.delete");
export const canManageTaskStatuses = tenantPermission("tenant.task_statuses.manage");
export const canManageProjectActivation = tenantPermission("tenant.project_activation.manage");
export const canReadResourceFeasibility = tenantPermission("tenant.resource_feasibility.read");
export const canUpdateProfile = tenantPermission("profile.update");
export const canManageWorkspaceTheme = tenantPermission("workspace.theme.manage");

function evaluateTenantPermission(input: TenantPolicyInput & { permission: Permission }): PolicyDecision {
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
