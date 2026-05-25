import type { BuiltInKpiMetricKey, KpiExpression, KpiFormula } from "./types";

const builtInMetricKeys: readonly BuiltInKpiMetricKey[] = [
  "deadline_delta_days",
  "resource_overload_minutes",
  "critical_task_count",
  "progress_percent",
  "baseline_finish_slip_days"
];

const binaryOps = ["add", "sub", "mul", "div"] as const;
const unaryOps = ["abs"] as const;
const aggregateOps = ["min", "max"] as const;
const maxExpressionDepth = 8;
const maxAggregateValues = 8;

export type KpiMetricValues = Record<BuiltInKpiMetricKey, number>;

export function evaluateKpiExpression(
  expression: KpiExpression,
  metrics: KpiMetricValues
): number {
  switch (expression.type) {
    case "number":
      return finite(expression.value);
    case "metric":
      return finite(metrics[expression.key]);
    case "binary": {
      const left = evaluateKpiExpression(expression.left, metrics);
      const right = evaluateKpiExpression(expression.right, metrics);
      if (expression.op === "add") return finite(left + right);
      if (expression.op === "sub") return finite(left - right);
      if (expression.op === "mul") return finite(left * right);
      if (right === 0) return 0;
      return finite(left / right);
    }
    case "unary":
      return finite(Math.abs(evaluateKpiExpression(expression.value, metrics)));
    case "aggregate": {
      const values = expression.values.map((value) => evaluateKpiExpression(value, metrics));
      if (values.length === 0) return 0;
      return finite(expression.op === "min" ? Math.min(...values) : Math.max(...values));
    }
  }
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function validateKpiFormula(formula: unknown): formula is KpiFormula {
  return validateKpiFormulaDetailed(formula).length === 0;
}

export function validateKpiFormulaDetailed(formula: unknown): string[] {
  if (!isRecord(formula)) return ["formula_must_be_object"];
  if (formula.type === "builtin") {
    return isBuiltInMetricKey(formula.key) ? [] : ["builtin_metric_unknown"];
  }
  if (formula.type === "expression") {
    return validateExpression(formula.expression, 0);
  }
  return ["formula_type_unknown"];
}

function validateExpression(expression: unknown, depth: number): string[] {
  if (!isRecord(expression)) return ["expression_must_be_object"];
  if (depth > maxExpressionDepth) return ["expression_too_deep"];

  switch (expression.type) {
    case "number":
      return typeof expression.value === "number" && Number.isFinite(expression.value)
        ? []
        : ["number_value_invalid"];
    case "metric":
      return isBuiltInMetricKey(expression.key) ? [] : ["metric_key_unknown"];
    case "binary":
      return [
        ...(isStringIn(expression.op, binaryOps) ? [] : ["binary_op_unknown"]),
        ...validateExpression(expression.left, depth + 1),
        ...validateExpression(expression.right, depth + 1)
      ];
    case "unary":
      return [
        ...(isStringIn(expression.op, unaryOps) ? [] : ["unary_op_unknown"]),
        ...validateExpression(expression.value, depth + 1)
      ];
    case "aggregate":
      if (!isStringIn(expression.op, aggregateOps)) return ["aggregate_op_unknown"];
      if (!Array.isArray(expression.values)) return ["aggregate_values_invalid"];
      if (expression.values.length === 0 || expression.values.length > maxAggregateValues) {
        return ["aggregate_values_out_of_bounds"];
      }
      return expression.values.flatMap((value) => validateExpression(value, depth + 1));
    default:
      return ["expression_type_unknown"];
  }
}

function isBuiltInMetricKey(value: unknown): value is BuiltInKpiMetricKey {
  return typeof value === "string" && builtInMetricKeys.includes(value as BuiltInKpiMetricKey);
}

function isStringIn<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
