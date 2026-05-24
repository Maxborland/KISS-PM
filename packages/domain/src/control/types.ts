import type { PlanDelta } from "../planning/planningCommands";

export type KpiEntityType = "project";
export type KpiPeriod = "snapshot" | "day" | "week" | "month";
export type KpiUnit = "days" | "minutes" | "percent" | "count";
export type KpiSeverity = "ok" | "warning" | "critical";
export type KpiStatus = "active" | "archived";

export type BuiltInKpiMetricKey =
  | "deadline_delta_days"
  | "resource_overload_minutes"
  | "critical_task_count"
  | "progress_percent"
  | "baseline_finish_slip_days";

export type KpiExpression =
  | { type: "number"; value: number }
  | { type: "metric"; key: BuiltInKpiMetricKey }
  | { type: "binary"; op: "add" | "sub" | "mul" | "div"; left: KpiExpression; right: KpiExpression }
  | { type: "unary"; op: "abs"; value: KpiExpression }
  | { type: "aggregate"; op: "min" | "max"; values: KpiExpression[] };

export type KpiFormula =
  | { type: "builtin"; key: BuiltInKpiMetricKey }
  | { type: "expression"; expression: KpiExpression };

export type KpiThresholdRule = {
  severity: Exclude<KpiSeverity, "ok">;
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;
};

export type KpiDefinition = {
  id: string;
  tenantId: string;
  entityType: KpiEntityType;
  code: string;
  label: string;
  formula: KpiFormula;
  unit: KpiUnit;
  period: KpiPeriod;
  thresholdRules: KpiThresholdRule[];
  ownerRole: string | null;
  allowedActions: ManagementActionType[];
  version: number;
  status: KpiStatus;
};

export type KpiEvaluation = {
  id: string;
  tenantId: string;
  projectId: string;
  definitionId: string;
  definitionVersion: number;
  formulaVersion: number;
  sourceData: Record<string, unknown>;
  periodStart: string | null;
  periodEnd: string | null;
  threshold: KpiThresholdRule | null;
  calculatedValue: number;
  severity: KpiSeverity;
  evaluatedAt: string;
};

export type ControlSignalStatus = "open" | "acknowledged" | "resolved" | "accepted_risk";

export type ControlSignal = {
  id: string;
  tenantId: string;
  projectId: string;
  sourceEntity: { type: string; id: string };
  sourceMetric: BuiltInKpiMetricKey | string;
  evaluationId: string | null;
  severity: Exclude<KpiSeverity, "ok">;
  explanation: string;
  ownerUserId: string | null;
  allowedActions: ManagementActionType[];
  scenarioProposals: ManagementActionCandidate[];
  status: ControlSignalStatus;
  createdAt: string;
  updatedAt: string;
};

export type CorrectiveActionStatus = "open" | "in_progress" | "done" | "cancelled";

export type CorrectiveAction = {
  id: string;
  tenantId: string;
  projectId: string;
  controlSignalId: string;
  title: string;
  description: string | null;
  responsibleUserId: string | null;
  dueDate: string | null;
  status: CorrectiveActionStatus;
  result: string | null;
};

export type ManagementActionType =
  | "create_corrective_action"
  | "generate_planning_solution"
  | "apply_planning_delta"
  | "accept_risk"
  | "move_deadline"
  | "open_gantt";

export type ManagementActionCandidate = {
  id: string;
  type: ManagementActionType;
  label: string;
  targetEntity: { type: string; id: string };
  requiredPermissions: string[];
  planDelta: PlanDelta | null;
  input: Record<string, unknown>;
  explainability: {
    reason: string;
    deadlineDeltaDays: number;
    overloadMinutes: number;
    changedTaskIds: string[];
    changedAssignmentIds: string[];
    riskScore: number;
    cost: number;
  };
};
