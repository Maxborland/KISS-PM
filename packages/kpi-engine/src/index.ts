export const packageName = "@kiss-pm/kpi-engine";

export type KpiSeverity = "none" | "attention" | "warning" | "critical";
export type KpiEntityType =
  | "opportunity"
  | "project"
  | "project_stage"
  | "task"
  | "resource";
export type KpiSourceType =
  | "crm"
  | "project"
  | "schedule"
  | "resource"
  | "worklog"
  | "task"
  | "kpi";
export type KpiEvaluationCadence = "daily" | "weekly" | "monthly" | "manual";

export class KpiEngineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "KpiEngineError";
    this.code = code;
  }
}

export interface KpiSourceBindingDefinition {
  readonly key: string;
  readonly label: string;
  readonly sourceType: KpiSourceType;
  readonly sourceField: string;
  readonly valueType: "number";
}

export interface KpiFormulaDefinition {
  readonly id: string;
  readonly tenantId: string;
  readonly version: number;
  readonly expression: string;
  readonly sourceBindings: readonly KpiSourceBindingDefinition[];
  readonly active: boolean;
}

export type KpiThresholdCondition =
  | { readonly operator: "gt" | "gte" | "lt" | "lte" | "eq"; readonly value: number }
  | {
      readonly operator: "between";
      readonly min: number;
      readonly max: number;
      readonly inclusive?: boolean;
    };

export interface KpiThresholdRule {
  readonly id: string;
  readonly severity: Exclude<KpiSeverity, "none">;
  readonly condition: KpiThresholdCondition;
  readonly explanation: string;
  readonly recommendedActionKeys: readonly string[];
}

export interface KpiThresholdRuleSet {
  readonly id: string;
  readonly tenantId: string;
  readonly version: number;
  readonly rules: readonly KpiThresholdRule[];
  readonly active: boolean;
}

export interface KpiDefinition {
  readonly id: string;
  readonly tenantId: string;
  readonly systemKey: string;
  readonly label: string;
  readonly entityType: KpiEntityType;
  readonly ownerRoleKey: string;
  readonly unit: string;
  readonly version: number;
  readonly formulaDefinitionId: string;
  readonly thresholdRuleSetId: string;
  readonly evaluationCadence: KpiEvaluationCadence;
  readonly active: boolean;
}

export interface KpiFormulaEvaluationResult {
  readonly value: number;
  readonly trace: readonly string[];
}

export interface KpiThresholdEvaluationResult {
  readonly severity: KpiSeverity;
  readonly matchedRuleId: string | null;
  readonly explanation: string | null;
  readonly recommendedActionKeys: readonly string[];
  readonly trace: readonly string[];
}

export interface KpiEvaluationPeriod {
  readonly start: string;
  readonly end: string;
}

export interface KpiSourceValue {
  readonly tenantId: string;
  readonly bindingKey: string;
  readonly value: number;
  readonly sourceEntityType: KpiEntityType;
  readonly sourceEntityId: string;
  readonly sourceField: string;
  readonly observedAt: string;
}

export interface KpiEvaluation {
  readonly id: string;
  readonly tenantId: string;
  readonly kpiDefinitionId: string;
  readonly kpiDefinitionVersion: number;
  readonly formulaDefinitionId: string;
  readonly formulaVersion: number;
  readonly thresholdRuleSetId: string;
  readonly thresholdRuleSetVersion: number;
  readonly entityType: KpiEntityType;
  readonly entityId: string;
  readonly period: KpiEvaluationPeriod;
  readonly evaluatedAt: string;
  readonly value: number;
  readonly severity: KpiSeverity;
  readonly matchedThresholdRuleId: string | null;
  readonly explanation: string | null;
  readonly recommendedActionKeys: readonly string[];
  readonly sourceTrace: readonly KpiSourceValue[];
  readonly formulaTrace: readonly string[];
  readonly thresholdTrace: readonly string[];
}

export interface KpiControlSignal {
  readonly id: string;
  readonly tenantId: string;
  readonly sourceType: "kpi_evaluation";
  readonly sourceEvaluationId: string;
  readonly kpiDefinitionId: string;
  readonly entityType: KpiEntityType;
  readonly entityId: string;
  readonly period: KpiEvaluationPeriod;
  readonly severity: Exclude<KpiSeverity, "none">;
  readonly explanation: string;
  readonly recommendedActionKeys: readonly string[];
  readonly status: "open" | "closed" | "superseded";
  readonly actionExecutionState: "not_executed";
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface Token {
  readonly type: "number" | "identifier" | "operator" | "paren" | "comma";
  readonly value: string;
}

const allowedFunctions = new Set(["abs", "ceil", "floor", "max", "min", "round"]);
const severityRank: Record<KpiSeverity, number> = {
  none: 0,
  attention: 1,
  warning: 2,
  critical: 3,
};
const entityTypes = new Set<KpiEntityType>([
  "opportunity",
  "project",
  "project_stage",
  "task",
  "resource",
]);
const sourceTypes = new Set<KpiSourceType>([
  "crm",
  "project",
  "schedule",
  "resource",
  "worklog",
  "task",
  "kpi",
]);
const evaluationCadences = new Set<KpiEvaluationCadence>([
  "daily",
  "weekly",
  "monthly",
  "manual",
]);
const thresholdSeverities = new Set<Exclude<KpiSeverity, "none">>([
  "attention",
  "warning",
  "critical",
]);

export function defineFormula(input: {
  readonly id: string;
  readonly tenantId: string;
  readonly version: number;
  readonly expression: string;
  readonly sourceBindings: readonly KpiSourceBindingDefinition[];
  readonly active?: boolean;
}): KpiFormulaDefinition {
  const definition: KpiFormulaDefinition = {
    id: requireId(input.id, "formula_id"),
    tenantId: requireId(input.tenantId, "tenant_id"),
    version: requirePositiveInteger(input.version, "formula_version"),
    expression: requireNonEmpty(input.expression, "formula_expression"),
    sourceBindings: validateBindings(input.sourceBindings),
    active: input.active ?? true,
  };
  validateFormulaExpression(definition.expression, definition.sourceBindings);
  return definition;
}

export function defineThresholdRuleSet(input: {
  readonly id: string;
  readonly tenantId: string;
  readonly version: number;
  readonly rules: readonly KpiThresholdRule[];
  readonly active?: boolean;
}): KpiThresholdRuleSet {
  const rules = input.rules.map(validateThresholdRule);
  if (rules.length === 0) {
    throw new KpiEngineError("threshold_rules_required", "Threshold rule set needs at least one rule.");
  }
  const ruleIds = new Set<string>();
  for (const rule of rules) {
    if (ruleIds.has(rule.id)) {
      throw new KpiEngineError("duplicate_threshold_rule", `Duplicate threshold rule ${rule.id}.`);
    }
    ruleIds.add(rule.id);
  }

  return {
    id: requireId(input.id, "threshold_rule_set_id"),
    tenantId: requireId(input.tenantId, "tenant_id"),
    version: requirePositiveInteger(input.version, "threshold_rule_set_version"),
    rules,
    active: input.active ?? true,
  };
}

export function defineKpi(input: {
  readonly id: string;
  readonly tenantId: string;
  readonly systemKey: string;
  readonly label: string;
  readonly entityType: KpiEntityType;
  readonly ownerRoleKey: string;
  readonly unit: string;
  readonly version: number;
  readonly formulaDefinitionId: string;
  readonly thresholdRuleSetId: string;
  readonly evaluationCadence: KpiEvaluationCadence;
  readonly active?: boolean;
}): KpiDefinition {
  return {
    id: requireId(input.id, "kpi_id"),
    tenantId: requireId(input.tenantId, "tenant_id"),
    systemKey: requireSystemKey(input.systemKey, "kpi_system_key"),
    label: requireNonEmpty(input.label, "kpi_label"),
    entityType: requireEnum(input.entityType, entityTypes, "invalid_entity_type"),
    ownerRoleKey: requireSystemKey(input.ownerRoleKey, "owner_role_key"),
    unit: requireNonEmpty(input.unit, "kpi_unit"),
    version: requirePositiveInteger(input.version, "kpi_version"),
    formulaDefinitionId: requireId(input.formulaDefinitionId, "formula_definition_id"),
    thresholdRuleSetId: requireId(input.thresholdRuleSetId, "threshold_rule_set_id"),
    evaluationCadence: requireEnum(
      input.evaluationCadence,
      evaluationCadences,
      "invalid_evaluation_cadence",
    ),
    active: input.active ?? true,
  };
}

export function evaluateFormula(
  definition: KpiFormulaDefinition,
  input: { readonly tenantId: string; readonly values: Readonly<Record<string, number>> },
): KpiFormulaEvaluationResult {
  ensureSameTenant(definition.tenantId, input.tenantId);
  if (!definition.active) {
    throw new KpiEngineError("formula_inactive", `Formula ${definition.id} is inactive.`);
  }

  const bindingKeys = new Set(definition.sourceBindings.map((binding) => binding.key));
  const values = new Map<string, number>();
  for (const binding of definition.sourceBindings) {
    const value = input.values[binding.key];
    if (value === undefined) {
      throw new KpiEngineError("missing_source_value", `Missing source value for ${binding.key}.`);
    }
    values.set(binding.key, requireFiniteNumber(value, `source_value:${binding.key}`));
  }

  const parser = new FormulaParser(tokenize(definition.expression), values, bindingKeys);
  const value = parser.parse();
  if (!Number.isFinite(value)) {
    throw new KpiEngineError("formula_non_finite_result", `Formula ${definition.id} returned ${value}.`);
  }

  return {
    value,
    trace: [
      `formula:${definition.id}@${definition.version}`,
      ...Array.from(values)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, bindingValue]) => `binding:${key}=${formatNumber(bindingValue)}`),
      `expression:${definition.expression}`,
      `result:${formatNumber(value)}`,
    ],
  };
}

export function evaluateThreshold(
  ruleSet: KpiThresholdRuleSet,
  input: { readonly tenantId: string; readonly value: number },
): KpiThresholdEvaluationResult {
  ensureSameTenant(ruleSet.tenantId, input.tenantId);
  if (!ruleSet.active) {
    throw new KpiEngineError("threshold_rule_set_inactive", `Threshold rule set ${ruleSet.id} is inactive.`);
  }
  const value = requireFiniteNumber(input.value, "threshold_value");
  const matched = ruleSet.rules
    .filter((rule) => conditionMatches(rule.condition, value))
    .sort((left, right) => {
      const severityDelta = severityRank[right.severity] - severityRank[left.severity];
      return severityDelta === 0 ? left.id.localeCompare(right.id) : severityDelta;
    })[0];

  if (!matched) {
    return {
      severity: "none",
      matchedRuleId: null,
      explanation: null,
      recommendedActionKeys: [],
      trace: [`threshold:${ruleSet.id}@${ruleSet.version}`, `value:${formatNumber(value)}`, "matched:none"],
    };
  }

  return {
    severity: matched.severity,
    matchedRuleId: matched.id,
    explanation: matched.explanation,
    recommendedActionKeys: matched.recommendedActionKeys,
    trace: [
      `threshold:${ruleSet.id}@${ruleSet.version}`,
      `value:${formatNumber(value)}`,
      `matched:${matched.id}:${matched.severity}`,
    ],
  };
}

export function evaluateKpi(input: {
  readonly id: string;
  readonly tenantId: string;
  readonly definition: KpiDefinition;
  readonly formula: KpiFormulaDefinition;
  readonly thresholdRuleSet: KpiThresholdRuleSet;
  readonly entity: { readonly type: KpiEntityType; readonly id: string };
  readonly period: KpiEvaluationPeriod;
  readonly evaluatedAt: string;
  readonly sourceValues: readonly KpiSourceValue[];
}): KpiEvaluation {
  const tenantId = requireId(input.tenantId, "tenant_id");
  ensureSameTenant(tenantId, input.definition.tenantId);
  ensureSameTenant(tenantId, input.formula.tenantId);
  ensureSameTenant(tenantId, input.thresholdRuleSet.tenantId);
  if (!input.definition.active) {
    throw new KpiEngineError("kpi_inactive", `KPI definition ${input.definition.id} is inactive.`);
  }
  if (input.definition.formulaDefinitionId !== input.formula.id) {
    throw new KpiEngineError("formula_definition_mismatch", "KPI definition points to another formula.");
  }
  if (input.definition.thresholdRuleSetId !== input.thresholdRuleSet.id) {
    throw new KpiEngineError("threshold_rule_set_mismatch", "KPI definition points to another threshold rule set.");
  }
  if (input.definition.entityType !== input.entity.type) {
    throw new KpiEngineError("entity_type_mismatch", "KPI definition cannot evaluate the provided entity type.");
  }

  const sourceValueMap: Record<string, number> = {};
  const sourceTrace: KpiSourceValue[] = [];
  for (const binding of input.formula.sourceBindings) {
    const sourceValue = input.sourceValues.find((value) => value.bindingKey === binding.key);
    if (!sourceValue) {
      throw new KpiEngineError("missing_source_value", `Missing source value for ${binding.key}.`);
    }
    ensureSameTenant(tenantId, sourceValue.tenantId);
    if (sourceValue.sourceField !== binding.sourceField) {
      throw new KpiEngineError("source_field_mismatch", `Source field mismatch for ${binding.key}.`);
    }
    sourceValueMap[binding.key] = sourceValue.value;
    sourceTrace.push({
      ...sourceValue,
      sourceEntityId: requireId(sourceValue.sourceEntityId, "source_entity_id"),
      observedAt: requireIsoDateTime(sourceValue.observedAt, "source_observed_at"),
      value: requireFiniteNumber(sourceValue.value, binding.key),
    });
  }

  const formulaResult = evaluateFormula(input.formula, {
    tenantId,
    values: sourceValueMap,
  });
  const thresholdResult = evaluateThreshold(input.thresholdRuleSet, {
    tenantId,
    value: formulaResult.value,
  });

  return {
    id: requireId(input.id, "kpi_evaluation_id"),
    tenantId,
    kpiDefinitionId: input.definition.id,
    kpiDefinitionVersion: input.definition.version,
    formulaDefinitionId: input.formula.id,
    formulaVersion: input.formula.version,
    thresholdRuleSetId: input.thresholdRuleSet.id,
    thresholdRuleSetVersion: input.thresholdRuleSet.version,
    entityType: input.entity.type,
    entityId: requireId(input.entity.id, "entity_id"),
    period: validatePeriod(input.period),
    evaluatedAt: requireIsoDateTime(input.evaluatedAt, "evaluated_at"),
    value: formulaResult.value,
    severity: thresholdResult.severity,
    matchedThresholdRuleId: thresholdResult.matchedRuleId,
    explanation: thresholdResult.explanation,
    recommendedActionKeys: thresholdResult.recommendedActionKeys,
    sourceTrace: sourceTrace.sort((left, right) => left.bindingKey.localeCompare(right.bindingKey)),
    formulaTrace: formulaResult.trace,
    thresholdTrace: thresholdResult.trace,
  };
}

export function createControlSignalFromEvaluation(input: {
  readonly id: string;
  readonly evaluation: KpiEvaluation;
  readonly createdAt: string;
}): KpiControlSignal | null {
  if (input.evaluation.severity === "none") {
    return null;
  }
  const createdAt = requireIsoDateTime(input.createdAt, "created_at");
  return {
    id: requireId(input.id, "control_signal_id"),
    tenantId: input.evaluation.tenantId,
    sourceType: "kpi_evaluation",
    sourceEvaluationId: input.evaluation.id,
    kpiDefinitionId: input.evaluation.kpiDefinitionId,
    entityType: input.evaluation.entityType,
    entityId: input.evaluation.entityId,
    period: input.evaluation.period,
    severity: input.evaluation.severity,
    explanation: input.evaluation.explanation ?? "KPI threshold matched.",
    recommendedActionKeys: input.evaluation.recommendedActionKeys,
    status: "open",
    actionExecutionState: "not_executed",
    createdAt,
    updatedAt: createdAt,
  };
}

export function upsertControlSignalFromEvaluation(input: {
  readonly id: string;
  readonly evaluation: KpiEvaluation;
  readonly existingSignals: readonly KpiControlSignal[];
  readonly changedAt: string;
}): KpiControlSignal | null {
  const nextSignal = createControlSignalFromEvaluation({
    id: input.id,
    evaluation: input.evaluation,
    createdAt: input.changedAt,
  });
  if (!nextSignal) {
    return null;
  }

  const existing = input.existingSignals.find(
    (signal) =>
      signal.status === "open" &&
      signal.tenantId === nextSignal.tenantId &&
      signal.kpiDefinitionId === nextSignal.kpiDefinitionId &&
      signal.entityType === nextSignal.entityType &&
      signal.entityId === nextSignal.entityId &&
      signal.period.start === nextSignal.period.start &&
      signal.period.end === nextSignal.period.end,
  );

  if (!existing) {
    return nextSignal;
  }

  return {
    ...nextSignal,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: requireIsoDateTime(input.changedAt, "changed_at"),
  };
}

class FormulaParser {
  private index = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly values: ReadonlyMap<string, number>,
    private readonly bindingKeys: ReadonlySet<string>,
  ) {}

  parse(): number {
    const value = this.parseExpression();
    if (this.current()) {
      throw new KpiEngineError("formula_invalid_syntax", `Unexpected token ${this.current()?.value}.`);
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (this.current()?.type === "operator" && ["+", "-"].includes(this.current()?.value ?? "")) {
      const operator = this.consume().value;
      const right = this.parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (this.current()?.type === "operator" && ["*", "/"].includes(this.current()?.value ?? "")) {
      const operator = this.consume().value;
      const right = this.parseFactor();
      if (operator === "/" && right === 0) {
        throw new KpiEngineError("formula_non_finite_result", "Division by zero is not allowed.");
      }
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  private parseFactor(): number {
    if (this.current()?.type === "operator" && ["+", "-"].includes(this.current()?.value ?? "")) {
      const operator = this.consume().value;
      const value = this.parseFactor();
      return operator === "-" ? -value : value;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.current();
    if (!token) {
      throw new KpiEngineError("formula_invalid_syntax", "Unexpected end of expression.");
    }

    if (token.type === "number") {
      this.consume();
      return requireFiniteNumber(Number(token.value), "formula_number");
    }

    if (token.type === "identifier") {
      return this.parseIdentifier();
    }

    if (token.type === "paren" && token.value === "(") {
      this.consume();
      const value = this.parseExpression();
      this.expect("paren", ")");
      return value;
    }

    throw new KpiEngineError("formula_invalid_syntax", `Unexpected token ${token.value}.`);
  }

  private parseIdentifier(): number {
    const identifier = this.consume().value;
    if (this.current()?.type === "paren" && this.current()?.value === "(") {
      return this.parseFunctionCall(identifier);
    }
    if (!this.bindingKeys.has(identifier)) {
      throw new KpiEngineError("unknown_formula_binding", `Unknown formula binding ${identifier}.`);
    }
    const value = this.values.get(identifier);
    if (value === undefined) {
      throw new KpiEngineError("missing_source_value", `Missing source value for ${identifier}.`);
    }
    return value;
  }

  private parseFunctionCall(functionName: string): number {
    if (!allowedFunctions.has(functionName)) {
      throw new KpiEngineError("formula_function_not_allowed", `Function ${functionName} is not allowed.`);
    }
    this.expect("paren", "(");
    const args: number[] = [];
    if (this.current()?.type === "paren" && this.current()?.value === ")") {
      this.consume();
    } else {
      args.push(this.parseExpression());
      while (this.current()?.type === "comma") {
        this.consume();
        args.push(this.parseExpression());
      }
      this.expect("paren", ")");
    }

    switch (functionName) {
      case "abs":
        requireArgumentCount(functionName, args, 1);
        return Math.abs(args[0]);
      case "ceil":
        requireArgumentCount(functionName, args, 1);
        return Math.ceil(args[0]);
      case "floor":
        requireArgumentCount(functionName, args, 1);
        return Math.floor(args[0]);
      case "round":
        requireArgumentCount(functionName, args, 1);
        return Math.round(args[0]);
      case "max":
        requireMinimumArgumentCount(functionName, args, 1);
        return Math.max(...args);
      case "min":
        requireMinimumArgumentCount(functionName, args, 1);
        return Math.min(...args);
      default:
        throw new KpiEngineError("formula_function_not_allowed", `Function ${functionName} is not allowed.`);
    }
  }

  private current(): Token | undefined {
    return this.tokens[this.index];
  }

  private consume(): Token {
    const token = this.current();
    if (!token) {
      throw new KpiEngineError("formula_invalid_syntax", "Unexpected end of expression.");
    }
    this.index += 1;
    return token;
  }

  private expect(type: Token["type"], value: string): void {
    const token = this.consume();
    if (token.type !== type || token.value !== value) {
      throw new KpiEngineError("formula_invalid_syntax", `Expected ${value}, got ${token.value}.`);
    }
  }
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index];
    if (!char) {
      break;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = expression.slice(index).match(/^\d+(?:\.\d+)?/);
      if (!match) {
        throw new KpiEngineError("formula_invalid_syntax", `Invalid number near ${expression.slice(index)}.`);
      }
      tokens.push({ type: "number", value: match[0] });
      index += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const match = expression.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!match) {
        throw new KpiEngineError("formula_invalid_syntax", `Invalid identifier near ${expression.slice(index)}.`);
      }
      tokens.push({ type: "identifier", value: match[0] });
      index += match[0].length;
      continue;
    }
    if ("+-*/".includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }
    if ("()".includes(char)) {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma", value: char });
      index += 1;
      continue;
    }
    throw new KpiEngineError("formula_invalid_character", `Character ${char} is not allowed in KPI formulas.`);
  }
  return tokens;
}

function validateFormulaExpression(
  expression: string,
  bindings: readonly KpiSourceBindingDefinition[],
): void {
  const tokens = tokenize(expression);
  const bindingKeys = new Set(bindings.map((binding) => binding.key));
  const emptyValues = new Map(bindings.map((binding) => [binding.key, 1]));
  const parser = new FormulaParser(tokens, emptyValues, bindingKeys);
  parser.parse();
}

function validateBindings(bindings: readonly KpiSourceBindingDefinition[]): readonly KpiSourceBindingDefinition[] {
  if (bindings.length === 0) {
    throw new KpiEngineError("source_bindings_required", "Formula needs at least one source binding.");
  }
  const seen = new Set<string>();
  return bindings.map((binding) => {
    const key = requireFormulaIdentifier(binding.key, "source_binding_key");
    if (seen.has(key)) {
      throw new KpiEngineError("duplicate_source_binding", `Duplicate source binding ${key}.`);
    }
    seen.add(key);
    return {
      key,
      label: requireNonEmpty(binding.label, "source_binding_label"),
      sourceType: requireEnum(binding.sourceType, sourceTypes, "invalid_source_type"),
      sourceField: requireFormulaIdentifier(binding.sourceField, "source_field"),
      valueType: "number",
    };
  });
}

function validateThresholdRule(rule: KpiThresholdRule): KpiThresholdRule {
  validateCondition(rule.condition);
  return {
    id: requireId(rule.id, "threshold_rule_id"),
    severity: requireEnum(rule.severity, thresholdSeverities, "invalid_threshold_severity"),
    condition: rule.condition,
    explanation: requireNonEmpty(rule.explanation, "threshold_explanation"),
    recommendedActionKeys: rule.recommendedActionKeys.map((key) =>
      requireSystemKey(key, "recommended_action_key"),
    ),
  };
}

function validateCondition(condition: KpiThresholdCondition): void {
  if (condition.operator === "between") {
    requireFiniteNumber(condition.min, "threshold_min");
    requireFiniteNumber(condition.max, "threshold_max");
    if (condition.min > condition.max) {
      throw new KpiEngineError("threshold_invalid_range", "Between threshold min must be <= max.");
    }
    return;
  }
  requireFiniteNumber(condition.value, "threshold_value");
}

function conditionMatches(condition: KpiThresholdCondition, value: number): boolean {
  switch (condition.operator) {
    case "gt":
      return value > condition.value;
    case "gte":
      return value >= condition.value;
    case "lt":
      return value < condition.value;
    case "lte":
      return value <= condition.value;
    case "eq":
      return value === condition.value;
    case "between":
      return condition.inclusive === false
        ? value > condition.min && value < condition.max
        : value >= condition.min && value <= condition.max;
  }
}

function validatePeriod(period: KpiEvaluationPeriod): KpiEvaluationPeriod {
  const start = requireIsoDate(period.start, "period_start");
  const end = requireIsoDate(period.end, "period_end");
  if (start > end) {
    throw new KpiEngineError("period_invalid", "Evaluation period start must be <= end.");
  }
  return { start, end };
}

function requireArgumentCount(functionName: string, args: readonly number[], count: number): void {
  if (args.length !== count) {
    throw new KpiEngineError("formula_invalid_function_args", `${functionName} expects ${count} args.`);
  }
}

function requireMinimumArgumentCount(functionName: string, args: readonly number[], count: number): void {
  if (args.length < count) {
    throw new KpiEngineError("formula_invalid_function_args", `${functionName} expects at least ${count} args.`);
  }
}

function ensureSameTenant(expectedTenantId: string, actualTenantId: string): void {
  if (expectedTenantId !== actualTenantId) {
    throw new KpiEngineError("tenant_mismatch", `Expected tenant ${expectedTenantId}, got ${actualTenantId}.`);
  }
}

function requireId(value: string, field: string): string {
  return requireNonEmpty(value, field);
}

function requireSystemKey(value: string, field: string): string {
  const normalized = requireNonEmpty(value, field);
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    throw new KpiEngineError("invalid_system_key", `${field} must be a stable system key.`);
  }
  return normalized;
}

function requireEnum<T extends string>(value: T, allowed: ReadonlySet<T>, code: string): T {
  if (!allowed.has(value)) {
    throw new KpiEngineError(code, `Unsupported value ${String(value)}.`);
  }
  return value;
}

function requireFormulaIdentifier(value: string, field: string): string {
  const normalized = requireNonEmpty(value, field);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    throw new KpiEngineError("invalid_formula_identifier", `${field} must be a formula identifier.`);
  }
  return normalized;
}

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new KpiEngineError("required_field", `${field} is required.`);
  }
  return value;
}

function requirePositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new KpiEngineError("invalid_positive_integer", `${field} must be a positive integer.`);
  }
  return value;
}

function requireFiniteNumber(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new KpiEngineError("invalid_number", `${field} must be finite.`);
  }
  return value;
}

function requireIsoDate(value: string, field: string): string {
  const normalized = requireNonEmpty(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new KpiEngineError("invalid_iso_date", `${field} must be YYYY-MM-DD.`);
  }
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new KpiEngineError("invalid_iso_date", `${field} must be a real calendar date.`);
  }
  return normalized;
}

function requireIsoDateTime(value: string, field: string): string {
  const normalized = requireNonEmpty(value, field);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(normalized)) {
    throw new KpiEngineError("invalid_iso_datetime", `${field} must be a UTC ISO datetime.`);
  }
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    throw new KpiEngineError("invalid_iso_datetime", `${field} must be an ISO datetime.`);
  }
  const canonical = new Date(timestamp).toISOString();
  const normalizedWithMillis = normalized.includes(".")
    ? normalized
    : normalized.replace("Z", ".000Z");
  if (canonical !== normalizedWithMillis) {
    throw new KpiEngineError("invalid_iso_datetime", `${field} must be a real UTC ISO datetime.`);
  }
  return normalized;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}
