import { diffCalendarDays } from "./calendar";
import type { ResourceLoadMatrix } from "./resourcePlanning";
import type { CalculatedPlan, PlanDate, PlanSnapshot, ValidationIssueCode } from "./types";

export type PlanForecastHealth = "stable" | "watch" | "needs_decision" | "unstable" | "blocked";

export type PlanForecastRiskCode =
  | "deadline_too_tight"
  | "dependency_chain_fragile"
  | "resource_overloaded"
  | "review_bottleneck"
  | "blocked_task"
  | "historical_delay_pattern"
  | "solver_has_no_safe_proposal";

export type PlanForecastRecommendationCode =
  | "keep_plan"
  | "add_buffer"
  | "move_task"
  | "add_resource"
  | "reduce_scope"
  | "resolve_blocker"
  | "use_auto_solver";

export type PlanForecastRiskDriver = {
  code: PlanForecastRiskCode;
  severity: "info" | "warning" | "critical";
  message: string;
  taskIds: string[];
  resourceIds: string[];
  dependencyIds: string[];
  date: PlanDate | null;
  overloadMinutes: number;
  deadlineDeltaDays: number | null;
  validationIssueCodes: ValidationIssueCode[];
};

export type PlanForecastRecommendation = {
  code: PlanForecastRecommendationCode;
  message: string;
  actionRequired: boolean;
  taskIds: string[];
  resourceIds: string[];
};

export type PlanForecastResult = {
  health: PlanForecastHealth;
  managerSummary: string;
  riskDrivers: PlanForecastRiskDriver[];
  recommendations: PlanForecastRecommendation[];
  engineMetadata: {
    source: "deterministic_planning_engine";
    tenantId: string;
    projectId: string;
    planVersion: number;
    engineVersion: string;
    calculatedAt: string;
    projectFinish: PlanDate | null;
    deadline: PlanDate | null;
    deadlineDeltaDays: number | null;
    solverProposalCount: number;
  };
};

export type PlanForecastInput = {
  snapshot: PlanSnapshot;
  calculatedPlan: CalculatedPlan;
  resourceLoad?: ResourceLoadMatrix;
  autoSolverRun?: { proposals: readonly unknown[] } | null;
  blockedStatusIds?: readonly string[];
  reviewStatusIds?: readonly string[];
  historicalDelayTaskIds?: readonly string[];
};

export const DISALLOWED_MANAGER_FORECAST_TERMS = [
  "P50",
  "P75",
  "P80",
  "P95",
  "confidence interval",
  "Monte Carlo",
  "Markov",
  "probability distribution"
] as const;

const defaultBlockedStatusIds = ["blocked"] as const;
const defaultReviewStatusIds = ["review", "in_review", "needs_review"] as const;

export function classifyPlanForecastHealth(input: PlanForecastInput): PlanForecastHealth {
  const riskDrivers = extractPlanForecastRiskDrivers(input);
  const riskCodes = new Set(riskDrivers.map((driver) => driver.code));
  const hasValidationError = input.calculatedPlan.validationIssues.some((issue) => issue.severity === "error");

  if (riskCodes.has("blocked_task")) return "blocked";
  if (hasValidationError || riskCodes.has("solver_has_no_safe_proposal")) return "unstable";
  if (
    riskCodes.has("deadline_too_tight") ||
    riskCodes.has("resource_overloaded") ||
    riskCodes.has("review_bottleneck")
  ) {
    return "needs_decision";
  }
  if (riskDrivers.length > 0) return "watch";
  return "stable";
}

export function createManagerForecastSummary(health: PlanForecastHealth): string {
  switch (health) {
    case "stable":
      return "Plan looks steady. Keep tracking execution against the current plan.";
    case "watch":
      return "Plan needs attention. Review the highlighted drivers before the next checkpoint.";
    case "needs_decision":
      return "Plan needs a management decision. Choose a safe adjustment before committing the schedule.";
    case "unstable":
      return "Plan is not safe to rely on yet. Resolve the planning issues before using it for commitments.";
    case "blocked":
      return "Plan is blocked. Clear the blocker before asking the team to continue against this plan.";
  }
}

export function extractPlanForecastRiskDrivers(input: PlanForecastInput): PlanForecastRiskDriver[] {
  const drivers: PlanForecastRiskDriver[] = [];
  const blockedStatusIds = new Set(input.blockedStatusIds ?? defaultBlockedStatusIds);
  const reviewStatusIds = new Set(input.reviewStatusIds ?? defaultReviewStatusIds);
  const blockedTaskIds = input.snapshot.tasks
    .filter((task) => blockedStatusIds.has(task.statusId))
    .map((task) => task.id);

  if (blockedTaskIds.length > 0) {
    drivers.push(
      createRiskDriver({
        code: "blocked_task",
        severity: "critical",
        message: "One or more tasks are blocked and need an owner decision before the plan can continue.",
        taskIds: blockedTaskIds
      })
    );
  }

  const deadlineDeltaDays = calculateDeadlineDeltaDays(input.calculatedPlan, input.snapshot.project.deadline);
  if (deadlineDeltaDays !== null && deadlineDeltaDays > 0) {
    drivers.push(
      createRiskDriver({
        code: "deadline_too_tight",
        severity: deadlineDeltaDays > 5 ? "critical" : "warning",
        message: "The calculated finish is later than the current deadline.",
        deadlineDeltaDays
      })
    );
  }

  const overloads = input.resourceLoad?.overloads.filter((overload) => overload.granularity === "day") ?? [];
  if (overloads.length > 0) {
    drivers.push(
      createRiskDriver({
        code: "resource_overloaded",
        severity: overloads.some((overload) => overload.overloadMinutes >= 480) ? "critical" : "warning",
        message: "Assigned and reserved work is above available capacity.",
        resourceIds: unique(overloads.map((overload) => overload.resourceId)),
        taskIds: unique(overloads.flatMap((overload) => overload.taskIds)),
        date: overloads[0]?.date ?? null,
        overloadMinutes: overloads.reduce((total, overload) => total + overload.overloadMinutes, 0)
      })
    );
  }

  const dependencyIssueCodes = input.calculatedPlan.validationIssues
    .filter((issue) => issue.code === "dependency_cycle_detected")
    .map((issue) => issue.code);
  if (
    dependencyIssueCodes.length > 0 ||
    (input.calculatedPlan.criticalPathTaskIds.length >= 3 && input.snapshot.dependencies.length >= 2)
  ) {
    drivers.push(
      createRiskDriver({
        code: "dependency_chain_fragile",
        severity: dependencyIssueCodes.length > 0 ? "critical" : "warning",
        message: "The dependency chain leaves little room for delay.",
        taskIds: input.calculatedPlan.criticalPathTaskIds,
        dependencyIds: input.snapshot.dependencies.map((dependency) => dependency.id),
        validationIssueCodes: unique(dependencyIssueCodes)
      })
    );
  }

  const reviewTaskIds = input.snapshot.tasks
    .filter((task) => reviewStatusIds.has(task.statusId))
    .map((task) => task.id);
  if (reviewTaskIds.length >= 2) {
    drivers.push(
      createRiskDriver({
        code: "review_bottleneck",
        severity: "warning",
        message: "Multiple tasks are waiting in review at the same time.",
        taskIds: reviewTaskIds
      })
    );
  }

  if (input.historicalDelayTaskIds && input.historicalDelayTaskIds.length > 0) {
    drivers.push(
      createRiskDriver({
        code: "historical_delay_pattern",
        severity: "info",
        message: "Similar work has slipped before, so this area should be watched.",
        taskIds: [...input.historicalDelayTaskIds]
      })
    );
  }

  const hasUnsafePlanningIssue =
    input.calculatedPlan.validationIssues.some((issue) => issue.severity === "error") ||
    drivers.some((driver) => driver.code === "deadline_too_tight" || driver.code === "resource_overloaded");
  if (input.autoSolverRun && input.autoSolverRun.proposals.length === 0 && hasUnsafePlanningIssue) {
    drivers.push(
      createRiskDriver({
        code: "solver_has_no_safe_proposal",
        severity: "critical",
        message: "The planner could not find a safe automatic adjustment for the current issue."
      })
    );
  }

  return drivers;
}

export function createPlanForecast(input: PlanForecastInput): PlanForecastResult {
  const riskDrivers = extractPlanForecastRiskDrivers(input);
  const health = classifyPlanForecastHealth(input);
  const deadlineDeltaDays = calculateDeadlineDeltaDays(input.calculatedPlan, input.snapshot.project.deadline);

  return {
    health,
    managerSummary: createManagerForecastSummary(health),
    riskDrivers,
    recommendations: [createRecommendation(health, riskDrivers, input.autoSolverRun?.proposals.length ?? 0)],
    engineMetadata: {
      source: "deterministic_planning_engine",
      tenantId: input.snapshot.tenantId,
      projectId: input.snapshot.projectId,
      planVersion: input.snapshot.planVersion,
      engineVersion: input.calculatedPlan.engineVersion,
      calculatedAt: input.calculatedPlan.calculatedAt,
      projectFinish: input.calculatedPlan.projectFinish,
      deadline: input.snapshot.project.deadline,
      deadlineDeltaDays,
      solverProposalCount: input.autoSolverRun?.proposals.length ?? 0
    }
  };
}

function createRecommendation(
  health: PlanForecastHealth,
  riskDrivers: readonly PlanForecastRiskDriver[],
  solverProposalCount: number
): PlanForecastRecommendation {
  const riskCodes = new Set(riskDrivers.map((driver) => driver.code));
  const taskIds = unique(riskDrivers.flatMap((driver) => driver.taskIds));
  const resourceIds = unique(riskDrivers.flatMap((driver) => driver.resourceIds));

  if (health === "stable") {
    return {
      code: "keep_plan",
      message: "Keep the current plan and continue normal tracking.",
      actionRequired: false,
      taskIds: [],
      resourceIds: []
    };
  }
  if (riskCodes.has("blocked_task")) {
    return {
      code: "resolve_blocker",
      message: "Resolve the blocked task before changing the wider plan.",
      actionRequired: true,
      taskIds,
      resourceIds
    };
  }
  if (solverProposalCount > 0 && (riskCodes.has("deadline_too_tight") || riskCodes.has("resource_overloaded"))) {
    return {
      code: "use_auto_solver",
      message: "Review the planner proposal and apply it only through the governed planning command flow.",
      actionRequired: true,
      taskIds,
      resourceIds
    };
  }
  if (riskCodes.has("solver_has_no_safe_proposal")) {
    return {
      code: "reduce_scope",
      message: "Reduce scope or change constraints before asking for a new plan.",
      actionRequired: true,
      taskIds,
      resourceIds
    };
  }
  if (riskCodes.has("resource_overloaded")) {
    return {
      code: "add_resource",
      message: "Add capacity or move work away from the overloaded area.",
      actionRequired: true,
      taskIds,
      resourceIds
    };
  }
  if (riskCodes.has("deadline_too_tight")) {
    return {
      code: "add_buffer",
      message: "Add schedule buffer or move the deadline before committing the plan.",
      actionRequired: true,
      taskIds,
      resourceIds
    };
  }
  if (riskCodes.has("dependency_chain_fragile")) {
    return {
      code: "move_task",
      message: "Move dependent work to reduce schedule fragility.",
      actionRequired: true,
      taskIds,
      resourceIds
    };
  }

  return {
    code: "add_buffer",
    message: "Keep this plan under watch and add a small buffer where possible.",
    actionRequired: true,
    taskIds,
    resourceIds
  };
}

function createRiskDriver(input: {
  code: PlanForecastRiskCode;
  severity: PlanForecastRiskDriver["severity"];
  message: string;
  taskIds?: string[];
  resourceIds?: string[];
  dependencyIds?: string[];
  date?: PlanDate | null;
  overloadMinutes?: number;
  deadlineDeltaDays?: number | null;
  validationIssueCodes?: ValidationIssueCode[];
}): PlanForecastRiskDriver {
  return {
    code: input.code,
    severity: input.severity,
    message: input.message,
    taskIds: input.taskIds ?? [],
    resourceIds: input.resourceIds ?? [],
    dependencyIds: input.dependencyIds ?? [],
    date: input.date ?? null,
    overloadMinutes: input.overloadMinutes ?? 0,
    deadlineDeltaDays: input.deadlineDeltaDays ?? null,
    validationIssueCodes: input.validationIssueCodes ?? []
  };
}

function calculateDeadlineDeltaDays(calculatedPlan: CalculatedPlan, deadline: PlanDate | null): number | null {
  if (!deadline || !calculatedPlan.projectFinish) return null;
  return diffCalendarDays(deadline, calculatedPlan.projectFinish);
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
