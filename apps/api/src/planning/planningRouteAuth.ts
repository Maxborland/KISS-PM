import {
  canManageProjectBaselines,
  canManageProjectPlan,
  canManageProjectResources,
  canReadProjectPlan,
  canReadProjectResources,
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

// Ресурсные исключения календаря (персональные отсутствия) отдаём в read-model только актору
// с правом на ресурсы (read/manage). Любой актор-фейсинг ответ (read-model/preview/apply/scenario/
// autosolver/control) должен передавать этот флаг: иначе либо утечка чужих отсутствий, либо их
// пропажа у правомочного редактора после мутации (usePlanning замещает state ответом).
export function includeResourceExceptionsFor(input: {
  actor: TenantUser;
  profile: AccessProfile;
}): boolean {
  const resourceInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };
  return (
    canReadProjectResources(resourceInput).allowed ||
    canManageProjectResources(resourceInput).allowed
  );
}

export function permissionForCommand(
  command: PlanningCommand,
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  const input = { actor, profile, targetTenantId: actor.tenantId };
  if (command.type === "baseline.capture") return canManageProjectBaselines(input);
  if (command.type === "task.create" && command.payload.assignments.length > 0) {
    const planDecision = canManageProjectPlan(input);
    if (!planDecision.allowed) return planDecision;
    return canManageProjectResources(input);
  }
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
