export type PlanningGanttCapabilities = {
  canReadPlan: boolean;
  canManagePlan: boolean;
  canManageBaseline: boolean;
  canReadResources: boolean;
  canManageResources: boolean;
  canPreviewScenarios: boolean;
  canApplyScenarios: boolean;
};

export const DEFAULT_PLANNING_GANTT_CAPABILITIES: PlanningGanttCapabilities = {
  canReadPlan: false,
  canManagePlan: false,
  canManageBaseline: false,
  canReadResources: false,
  canManageResources: false,
  canPreviewScenarios: false,
  canApplyScenarios: false
};

export function withPlanningGanttCapabilityOverrides(
  overrides: Partial<PlanningGanttCapabilities> = {}
): PlanningGanttCapabilities {
  return {
    ...DEFAULT_PLANNING_GANTT_CAPABILITIES,
    ...overrides
  };
}
