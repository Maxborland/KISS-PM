import {
  canApplyPlanningScenarios,
  canCreateTasks,
  canExecuteManagementActions,
  canManageControlSignals,
  canManageCorrectiveActions,
  canManageKpiDefinitions,
  canManageProjectPlan,
  canManageProjectResources,
  canManageProjects,
  canPreviewPlanningScenarios,
  canReadProjectPlan,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { ManagementActionCandidate, TenantUser } from "@kiss-pm/domain";
import { permissionForCommand } from "../planning/planningRouteAuth";

export function decisionForActionPermissions(
  action: ManagementActionCandidate,
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  for (const permission of action.requiredPermissions) {
    const decision = decisionForPermission(permission, actor, profile);
    if (!decision.allowed) return decision;
  }
  for (const command of action.planDelta?.commands ?? []) {
    const decision = permissionForCommand(command, actor, profile);
    if (!decision.allowed) return decision;
  }
  return {
    allowed: true,
    reason: "same_tenant_permission_granted"
  };
}

export function decisionForPermission(
  permission: string,
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  const input = { actor, profile, targetTenantId: actor.tenantId };
  if (permission === "tenant.project_plan.read") return canReadProjectPlan(input);
  if (permission === "tenant.project_plan.manage") return canManageProjectPlan(input);
  if (permission === "tenant.project_resources.manage") return canManageProjectResources(input);
  if (permission === "tenant.planning_scenarios.preview") return canPreviewPlanningScenarios(input);
  if (permission === "tenant.planning_scenarios.apply") return canApplyPlanningScenarios(input);
  if (permission === "tenant.corrective_actions.manage") return canManageCorrectiveActions(input);
  if (permission === "tenant.management_actions.execute") return canExecuteManagementActions(input);
  if (permission === "tenant.control_signals.manage") return canManageControlSignals(input);
  if (permission === "tenant.tasks.create") return canCreateTasks(input);
  if (permission === "tenant.projects.manage") return canManageProjects(input);
  if (permission === "tenant.kpi_definitions.manage") return canManageKpiDefinitions(input);
  return {
    allowed: false,
    reason: "permission_missing"
  };
}
