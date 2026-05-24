import {
  canManageProjectBaselines,
  canManageProjectPlan,
  canManageProjectResources,
  canReadProjectPlan,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { PlanningCommand, TenantUser } from "@kiss-pm/domain";

export function canReadPlanningReadModel(input: {
  actor: TenantUser;
  profile: AccessProfile;
}): PolicyDecision {
  return canReadProjectPlan({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
}

export function permissionForCommand(
  command: PlanningCommand,
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  const input = { actor, profile, targetTenantId: actor.tenantId };
  if (command.type === "baseline.capture") return canManageProjectBaselines(input);
  if (
    command.type === "assignment.upsert" ||
    command.type === "assignment.delete" ||
    command.type === "assignment.allocations.replace" ||
    command.type === "resource.reserve"
  ) {
    return canManageProjectResources(input);
  }
  return canManageProjectPlan(input);
}
