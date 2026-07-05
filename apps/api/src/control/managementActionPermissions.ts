import {
  canApplyPlanningScenarios,
  canManageProjectPlan,
  canManageProjectResources,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type {
  ManagementActionCandidate,
  TenantUser
} from "@kiss-pm/domain";

import { permissionForCommand } from "../planning/planningCommandPermissions";

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

function decisionForPermission(
  permission: string,
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  const input = { actor, profile, targetTenantId: actor.tenantId };
  if (permission === "tenant.project_plan.manage") return canManageProjectPlan(input);
  if (permission === "tenant.project_resources.manage") return canManageProjectResources(input);
  if (permission === "tenant.planning_scenarios.apply") return canApplyPlanningScenarios(input);
  return {
    allowed: false,
    reason: "permission_missing"
  };
}
