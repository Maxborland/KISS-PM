export type PlanningGanttFeatures = {
  baseline: boolean;
  criticalPath: boolean;
  dependencies: boolean;
  commandPreview: boolean;
  effortFields: boolean;
  resourceLoad: boolean;
  scenarioPlanning: boolean;
};

export const DEFAULT_PLANNING_GANTT_FEATURES: PlanningGanttFeatures = {
  baseline: true,
  criticalPath: true,
  dependencies: true,
  commandPreview: true,
  effortFields: true,
  resourceLoad: true,
  scenarioPlanning: true
};

export function withPlanningGanttFeatureOverrides(
  overrides: Partial<PlanningGanttFeatures> = {}
): PlanningGanttFeatures {
  return {
    ...DEFAULT_PLANNING_GANTT_FEATURES,
    ...overrides
  };
}
