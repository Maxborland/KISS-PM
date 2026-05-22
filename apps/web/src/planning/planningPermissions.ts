import type { PlanningGanttCapabilities } from "@kiss-pm/planning-gantt-ui";
import type { PlanningCommand } from "@kiss-pm/domain";

export function hasPlanningPermission(
  permissions: readonly string[],
  permission: string
): boolean {
  return permissions.includes(permission);
}

export function canReadPlanningWorkspace(permissions: readonly string[]): boolean {
  return (
    hasPlanningPermission(permissions, "tenant.projects.read") &&
    hasPlanningPermission(permissions, "tenant.project_plan.read") &&
    hasPlanningPermission(permissions, "tenant.project_resources.read")
  );
}

export function planningCapabilitiesFromPermissions(
  permissions: readonly string[]
): PlanningGanttCapabilities {
  return {
    canReadPlan: hasPlanningPermission(permissions, "tenant.project_plan.read"),
    canManagePlan: hasPlanningPermission(permissions, "tenant.project_plan.manage"),
    canManageBaseline: hasPlanningPermission(permissions, "tenant.project_baselines.manage"),
    canReadResources: hasPlanningPermission(permissions, "tenant.project_resources.read"),
    canManageResources: hasPlanningPermission(permissions, "tenant.project_resources.manage"),
    canPreviewScenarios: hasPlanningPermission(permissions, "tenant.planning_scenarios.preview"),
    canApplyScenarios: hasPlanningPermission(permissions, "tenant.planning_scenarios.apply")
  };
}

export function planningReadDisabledReason(permissions: readonly string[]): string | null {
  if (!hasPlanningPermission(permissions, "tenant.projects.read")) return "Нужно право tenant.projects.read";
  if (!hasPlanningPermission(permissions, "tenant.project_plan.read")) return "Нужно право tenant.project_plan.read";
  if (!hasPlanningPermission(permissions, "tenant.project_resources.read")) return "Нужно право tenant.project_resources.read";
  return null;
}

export function canApplyPlanningCommand(
  command: PlanningCommand,
  permissions: readonly string[]
): boolean {
  if (command.type === "baseline.capture") {
    return hasPlanningPermission(permissions, "tenant.project_baselines.manage");
  }
  if (commandAllocatesProjectResources(command)) {
    return hasPlanningPermission(permissions, "tenant.project_resources.manage");
  }
  return hasPlanningPermission(permissions, "tenant.project_plan.manage");
}

function commandAllocatesProjectResources(command: PlanningCommand): boolean {
  return (
    command.type === "assignment.upsert" ||
    command.type === "assignment.delete" ||
    command.type === "resource.reserve" ||
    (command.type === "task.create" && command.payload.assignments.length > 0)
  );
}
