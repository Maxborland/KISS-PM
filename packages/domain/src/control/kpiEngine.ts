import type { CalculatedPlan, PlanSnapshot } from "../planning/types";
import type { ResourceLoadMatrix } from "../planning/resourcePlanning";
import { evaluateKpiExpression, type KpiMetricValues } from "./kpiExpressions";
import type {
  BuiltInKpiMetricKey,
  ControlSignal,
  KpiDefinition,
  KpiEvaluation,
  KpiSeverity,
  KpiThresholdRule,
  ManagementActionCandidate
} from "./types";

export function createDefaultProjectKpiDefinitions(tenantId: string): KpiDefinition[] {
  return [
    {
      id: "kpi-project-deadline-delta",
      tenantId,
      entityType: "project",
      code: "project.deadline_delta_days",
      label: "Сдвиг срока проекта",
      formula: { type: "builtin", key: "deadline_delta_days" },
      unit: "days",
      period: "snapshot",
      thresholdRules: [
        { severity: "warning", operator: "gt", value: 0 },
        { severity: "critical", operator: "gt", value: 2 }
      ],
      ownerRole: "project_manager",
      allowedActions: ["generate_planning_solution", "apply_planning_delta", "move_deadline"],
      version: 1,
      status: "active"
    },
    {
      id: "kpi-project-resource-overload",
      tenantId,
      entityType: "project",
      code: "project.resource_overload_minutes",
      label: "Перегруз ресурсов",
      formula: { type: "builtin", key: "resource_overload_minutes" },
      unit: "minutes",
      period: "snapshot",
      thresholdRules: [{ severity: "critical", operator: "gt", value: 0 }],
      ownerRole: "resource_manager",
      allowedActions: ["generate_planning_solution", "apply_planning_delta", "accept_risk"],
      version: 1,
      status: "active"
    },
    {
      id: "kpi-project-baseline-slip",
      tenantId,
      entityType: "project",
      code: "project.baseline_finish_slip_days",
      label: "Отклонение от baseline",
      formula: { type: "builtin", key: "baseline_finish_slip_days" },
      unit: "days",
      period: "snapshot",
      thresholdRules: [
        { severity: "warning", operator: "gt", value: 0 },
        { severity: "critical", operator: "gt", value: 5 }
      ],
      ownerRole: "project_manager",
      allowedActions: ["create_corrective_action", "open_gantt"],
      version: 1,
      status: "active"
    }
  ];
}

export type EvaluateProjectKpisInput = {
  definitions: KpiDefinition[];
  snapshot: PlanSnapshot;
  calculatedPlan: CalculatedPlan;
  resourceLoad: ResourceLoadMatrix;
  evaluatedAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
};

export function evaluateProjectKpis(input: EvaluateProjectKpisInput): KpiEvaluation[] {
  const metrics = buildProjectKpiMetrics(input);
  const sourceData = buildSourceData(input, metrics);

  return input.definitions
    .filter((definition) => definition.status === "active" && definition.entityType === "project")
    .map((definition) => {
      const calculatedValue =
        definition.formula.type === "builtin"
          ? metrics[definition.formula.key]
          : evaluateKpiExpression(definition.formula.expression, metrics);
      const threshold = selectThreshold(definition.thresholdRules, calculatedValue);
      const severity = threshold?.severity ?? "ok";

      return {
        id: `kpi-eval-${definition.id}-${input.snapshot.projectId}-${input.snapshot.planVersion}`,
        tenantId: input.snapshot.tenantId,
        projectId: input.snapshot.projectId,
        definitionId: definition.id,
        definitionVersion: definition.version,
        formulaVersion: definition.version,
        sourceData,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        threshold,
        calculatedValue,
        severity,
        evaluatedAt: input.evaluatedAt
      };
    });
}

export function createControlSignalsFromEvaluations(input: {
  evaluations: KpiEvaluation[];
  definitions: KpiDefinition[];
  snapshot: PlanSnapshot;
  actionCandidatesByMetric?: Record<string, ManagementActionCandidate[]>;
  now: string;
}): ControlSignal[] {
  const definitionsById = new Map(input.definitions.map((definition) => [definition.id, definition]));

  return input.evaluations
    .filter((evaluation): evaluation is KpiEvaluation & { severity: Exclude<KpiSeverity, "ok"> } =>
      evaluation.severity !== "ok"
    )
    .map((evaluation) => {
      const definition = definitionsById.get(evaluation.definitionId);
      const metric = metricKeyForDefinition(definition);
      return {
        id: `signal-${evaluation.projectId}-${evaluation.definitionId}`,
        tenantId: evaluation.tenantId,
        projectId: evaluation.projectId,
        sourceEntity: { type: "Project", id: evaluation.projectId },
        sourceMetric: metric,
        evaluationId: evaluation.id,
        severity: evaluation.severity,
        explanation: explainEvaluation(definition, evaluation),
        ownerUserId: null,
        allowedActions: definition?.allowedActions ?? [],
        scenarioProposals: input.actionCandidatesByMetric?.[metric] ?? [],
        status: "open",
        createdAt: input.now,
        updatedAt: input.now
      };
    });
}

export function buildProjectKpiMetrics(input: {
  snapshot: PlanSnapshot;
  calculatedPlan: CalculatedPlan;
  resourceLoad: ResourceLoadMatrix;
}): KpiMetricValues {
  const projectFinish = input.calculatedPlan.projectFinish;
  const deadline = input.snapshot.project.deadline;
  const latestBaselineFinish = latestBaselineProjectFinish(input.snapshot);
  const totalTasks = input.snapshot.tasks.length;
  // Взвешенный прогресс: Σ(percentComplete·workMinutes) / Σ(workMinutes). Если труд нигде не задан —
  // среднее по percentComplete (равный вес). НЕ «закрытые/всего» — иначе 9 задач по 99% дают 0%.
  let earnedWork = 0;
  let totalWork = 0;
  let percentSum = 0;
  for (const task of input.snapshot.tasks) {
    const pct = Math.max(0, Math.min(100, task.percentComplete));
    const work = Math.max(0, task.workMinutes);
    earnedWork += (pct / 100) * work;
    totalWork += work;
    percentSum += pct;
  }
  const progressPercent =
    totalTasks === 0
      ? 0
      : Math.round(totalWork > 0 ? (earnedWork / totalWork) * 100 : percentSum / totalTasks);

  return {
    deadline_delta_days: projectFinish && deadline ? Math.max(0, dateDeltaDays(deadline, projectFinish)) : 0,
    resource_overload_minutes: input.resourceLoad.overloads
      .filter((overload) => overload.granularity === "day")
      .reduce((total, overload) => total + overload.overloadMinutes, 0),
    critical_task_count: input.calculatedPlan.criticalPathTaskIds.length,
    progress_percent: progressPercent,
    baseline_finish_slip_days:
      latestBaselineFinish && projectFinish ? Math.max(0, dateDeltaDays(latestBaselineFinish, projectFinish)) : 0
  };
}

function selectThreshold(
  rules: KpiThresholdRule[],
  value: number
): KpiThresholdRule | null {
  const matched = rules.filter((rule) => matchesRule(rule, value));
  const critical = matched.find((rule) => rule.severity === "critical");
  return critical ?? matched[0] ?? null;
}

function matchesRule(rule: KpiThresholdRule, value: number): boolean {
  if (rule.operator === "gt") return value > rule.value;
  if (rule.operator === "gte") return value >= rule.value;
  if (rule.operator === "lt") return value < rule.value;
  if (rule.operator === "lte") return value <= rule.value;
  return value === rule.value;
}

function metricKeyForDefinition(definition: KpiDefinition | undefined): BuiltInKpiMetricKey | string {
  if (!definition) return "unknown";
  return definition.formula.type === "builtin" ? definition.formula.key : definition.code;
}

function explainEvaluation(
  definition: KpiDefinition | undefined,
  evaluation: KpiEvaluation
): string {
  const label = definition?.label ?? evaluation.definitionId;
  const threshold = evaluation.threshold
    ? `порог ${evaluation.threshold.operator} ${evaluation.threshold.value}`
    : "порог не задан";
  return `${label}: значение ${evaluation.calculatedValue}, ${threshold}`;
}

function buildSourceData(
  input: EvaluateProjectKpisInput,
  metrics: KpiMetricValues
): Record<string, unknown> {
  return {
    projectId: input.snapshot.projectId,
    planVersion: input.snapshot.planVersion,
    calculatedAt: input.calculatedPlan.calculatedAt,
    projectFinish: input.calculatedPlan.projectFinish,
    deadline: input.snapshot.project.deadline,
    metrics
  };
}

function latestBaselineProjectFinish(snapshot: PlanSnapshot): string | null {
  const baseline = [...snapshot.baselines].sort((left, right) =>
    right.capturedAt.localeCompare(left.capturedAt)
  )[0];
  if (!baseline) return null;
  return baseline.tasks
    .map((task) => task.plannedFinish)
    .filter((finish): finish is string => Boolean(finish))
    .sort()
    .at(-1) ?? null;
}

export function dateDeltaDays(left: string, right: string): number {
  const leftDate = Date.parse(`${left}T00:00:00.000Z`);
  const rightDate = Date.parse(`${right}T00:00:00.000Z`);
  if (!Number.isFinite(leftDate) || !Number.isFinite(rightDate)) return 0;
  return Math.ceil((rightDate - leftDate) / 86_400_000);
}
