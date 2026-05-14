import type { TenantId, TenantOwned } from "@kiss-pm/domain-core";

export const packageName = "@kiss-pm/resource-planning";

export type DemandFormulaMetadata = {
  key: string;
  version: number;
  label: string;
};

export type DemandScopeHintValue = string | number | boolean;

export type DemandScopeHint = TenantOwned & {
  opportunityId: string;
  key: string;
  label: string;
  value: DemandScopeHintValue;
};

export type DemandAssumption = {
  code: string;
  message: string;
};

export type DemandScopeHintDriver = {
  scopeHintKey: string;
  hoursPerUnit: number;
};

export type DemandTemplateRoleRule = {
  stageKey: string;
  stageLabel: string;
  roleKey: string;
  roleLabel: string;
  baseWorkHours: number;
  scopeHintDrivers: DemandScopeHintDriver[];
  confidence: number;
  sortOrder: number;
  assumptions: DemandAssumption[];
};

export type DemandTemplateProfile = TenantOwned & {
  id: string;
  templateKey: string;
  templateVersion: number;
  scenarioKey: string;
  scenarioLabel: string;
  formula: DemandFormulaMetadata;
  roleRules: DemandTemplateRoleRule[];
  updatedAt: string;
};

export type DemandTemplateMatchInput = {
  tenantId: TenantId;
  opportunityId: string;
  matched: boolean;
  template?: {
    id: string;
    key: string;
    label: string;
    version: number;
  };
  confidence: number;
  assumptions: DemandAssumption[];
};

export type StageRoleDemand = {
  stageKey: string;
  stageLabel: string;
  roleKey: string;
  roleLabel: string;
  plannedWorkHours: number;
  confidence: number;
  formulaRef: string;
  sourceAssumptions: DemandAssumption[];
};

export type DemandEstimate = TenantOwned & {
  opportunityId: string;
  template: {
    key: string;
    label: string;
    version: number;
  };
  scenario: {
    key: string;
    label: string;
  };
  formula: DemandFormulaMetadata;
  stageRoleDemands: StageRoleDemand[];
  totalPlannedWorkHours: number;
  confidence: number;
  assumptions: DemandAssumption[];
  trace: string[];
};

export class ResourcePlanningModelError extends Error {
  constructor(
    readonly code: "validation_error" | "tenant_mismatch" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "ResourcePlanningModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireNonNegativeNumber(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} must be a non-negative number`);
  }

  return value;
}

function requireProbability(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} must be between 0 and 1`);
  }

  return value;
}

function requireArray<T>(value: T[] | undefined, fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} must be an array`);
  }

  return value;
}

function requireObject<T extends object>(value: T | undefined, fieldName: string): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} must be an object`);
  }

  return value;
}

function requireSystemKey(value: string | undefined, fieldName: string): string {
  const key = requireNonEmptyString(value, fieldName);
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(key)) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} must be a stable system key`);
  }

  return key;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function requireFiniteFormulaResult(value: number): number {
  if (!Number.isFinite(value)) {
    throw new ResourcePlanningModelError("validation_error", "demandEstimate.formulaResult must be finite");
  }

  return value;
}

function cloneAssumptions(assumptions: DemandAssumption[] | undefined, fieldName: string): DemandAssumption[] {
  return requireArray(assumptions, fieldName).map((rawAssumption) => {
    const assumption = requireObject(rawAssumption, `${fieldName}[]`);

    return {
      code: requireSystemKey(assumption.code, `${fieldName}.code`),
      message: requireNonEmptyString(assumption.message, `${fieldName}.message`)
    };
  });
}

function cloneScopeHintDrivers(drivers: DemandScopeHintDriver[] | undefined): DemandScopeHintDriver[] {
  const cloned = requireArray(drivers, "demandTemplateRoleRule.scopeHintDrivers").map((rawDriver) => {
    const driver = requireObject(rawDriver, "demandTemplateRoleRule.scopeHintDriver");

    return {
      scopeHintKey: requireSystemKey(driver.scopeHintKey, "demandTemplateRoleRule.scopeHintDriver.scopeHintKey"),
      hoursPerUnit: requireNonNegativeNumber(driver.hoursPerUnit, "demandTemplateRoleRule.scopeHintDriver.hoursPerUnit")
    };
  });
  if (new Set(cloned.map((driver) => driver.scopeHintKey)).size !== cloned.length) {
    throw new ResourcePlanningModelError("conflict", "demandTemplateRoleRule scope hint drivers must be unique");
  }

  return cloned;
}

function cloneRoleRules(roleRules: DemandTemplateRoleRule[] | undefined): DemandTemplateRoleRule[] {
  const cloned = requireArray(roleRules, "demandTemplateProfile.roleRules").map((rawRule) => {
    const rule = requireObject(rawRule, "demandTemplateProfile.roleRule");

    return {
      stageKey: requireSystemKey(rule.stageKey, "demandTemplateRoleRule.stageKey"),
      stageLabel: requireNonEmptyString(rule.stageLabel, "demandTemplateRoleRule.stageLabel"),
      roleKey: requireSystemKey(rule.roleKey, "demandTemplateRoleRule.roleKey"),
      roleLabel: requireNonEmptyString(rule.roleLabel, "demandTemplateRoleRule.roleLabel"),
      baseWorkHours: requireNonNegativeNumber(rule.baseWorkHours, "demandTemplateRoleRule.baseWorkHours"),
      scopeHintDrivers: cloneScopeHintDrivers(rule.scopeHintDrivers),
      confidence: requireProbability(rule.confidence, "demandTemplateRoleRule.confidence"),
      sortOrder: requirePositiveInteger(rule.sortOrder, "demandTemplateRoleRule.sortOrder"),
      assumptions: cloneAssumptions(rule.assumptions, "demandTemplateRoleRule.assumptions")
    };
  });

  if (cloned.length === 0) {
    throw new ResourcePlanningModelError("validation_error", "demandTemplateProfile.roleRules must not be empty");
  }
  const roleKeys = cloned.map((rule) => `${rule.stageKey}:${rule.roleKey}`);
  if (new Set(roleKeys).size !== roleKeys.length) {
    throw new ResourcePlanningModelError("conflict", "demandTemplateProfile stage/role rules must be unique");
  }

  return cloned;
}

function createFormulaMetadata(formula: DemandFormulaMetadata | undefined): DemandFormulaMetadata {
  const rawFormula = requireObject(formula, "demandTemplateProfile.formula");

  return {
    key: requireSystemKey(rawFormula.key, "demandTemplateProfile.formula.key"),
    version: requirePositiveInteger(rawFormula.version, "demandTemplateProfile.formula.version"),
    label: requireNonEmptyString(rawFormula.label, "demandTemplateProfile.formula.label")
  };
}

function cloneScopeHints(scopeHints: DemandScopeHint[] | undefined): DemandScopeHint[] {
  return requireArray(scopeHints, "demandEstimate.scopeHints").map((rawHint) => {
    const hint = requireObject(rawHint, "demandEstimate.scopeHint");
    const value = hint.value;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new ResourcePlanningModelError("validation_error", "demandEstimate.scopeHint.value is invalid");
    }

    return {
      tenantId: requireNonEmptyString(hint.tenantId, "demandEstimate.scopeHint.tenantId"),
      opportunityId: requireNonEmptyString(hint.opportunityId, "demandEstimate.scopeHint.opportunityId"),
      key: requireSystemKey(hint.key, "demandEstimate.scopeHint.key"),
      label: requireNonEmptyString(hint.label, "demandEstimate.scopeHint.label"),
      value
    };
  });
}

function createScopeHintIndex(
  scopeHints: DemandScopeHint[],
  tenantId: TenantId,
  opportunityId: string
): Map<string, DemandScopeHint> {
  const index = new Map<string, DemandScopeHint>();
  for (const scopeHint of scopeHints) {
    if (scopeHint.tenantId !== tenantId) {
      throw new ResourcePlanningModelError("tenant_mismatch", "Scope hint tenant mismatch");
    }
    if (scopeHint.opportunityId !== opportunityId) {
      throw new ResourcePlanningModelError("validation_error", "Scope hint opportunity mismatch");
    }
    if (index.has(scopeHint.key)) {
      throw new ResourcePlanningModelError("conflict", `Duplicate demand scope hint key: ${scopeHint.key}`);
    }
    index.set(scopeHint.key, scopeHint);
  }

  return index;
}

export function createDemandTemplateProfile(input: {
  id: string;
  tenantId: TenantId;
  templateKey: string;
  templateVersion: number;
  scenarioKey: string;
  scenarioLabel: string;
  formula: DemandFormulaMetadata;
  roleRules: DemandTemplateRoleRule[];
  updatedAt: string;
}): DemandTemplateProfile {
  const rawProfile = requireObject(input, "demandTemplateProfile");

  return {
    id: requireNonEmptyString(rawProfile.id, "demandTemplateProfile.id"),
    tenantId: requireNonEmptyString(rawProfile.tenantId, "tenantId"),
    templateKey: requireSystemKey(rawProfile.templateKey, "demandTemplateProfile.templateKey"),
    templateVersion: requirePositiveInteger(rawProfile.templateVersion, "demandTemplateProfile.templateVersion"),
    scenarioKey: requireSystemKey(rawProfile.scenarioKey, "demandTemplateProfile.scenarioKey"),
    scenarioLabel: requireNonEmptyString(rawProfile.scenarioLabel, "demandTemplateProfile.scenarioLabel"),
    formula: createFormulaMetadata(rawProfile.formula),
    roleRules: cloneRoleRules(rawProfile.roleRules),
    updatedAt: requireValidTimestamp(rawProfile.updatedAt, "demandTemplateProfile.updatedAt")
  };
}

function validateTemplateMatch(match: DemandTemplateMatchInput): Required<DemandTemplateMatchInput> {
  const templateMatch = requireObject(match, "demandEstimate.templateMatch");
  if (templateMatch.matched !== true || templateMatch.template === undefined) {
    throw new ResourcePlanningModelError("validation_error", "demandEstimate.templateMatch must be matched");
  }
  const template = requireObject(templateMatch.template, "demandEstimate.templateMatch.template");

  return {
    tenantId: requireNonEmptyString(templateMatch.tenantId, "demandEstimate.templateMatch.tenantId"),
    opportunityId: requireNonEmptyString(templateMatch.opportunityId, "demandEstimate.templateMatch.opportunityId"),
    matched: true,
    template: {
      id: requireNonEmptyString(template.id, "demandEstimate.templateMatch.template.id"),
      key: requireSystemKey(template.key, "demandEstimate.templateMatch.template.key"),
      label: requireNonEmptyString(template.label, "demandEstimate.templateMatch.template.label"),
      version: requirePositiveInteger(template.version, "demandEstimate.templateMatch.template.version")
    },
    confidence: requireProbability(templateMatch.confidence, "demandEstimate.templateMatch.confidence"),
    assumptions: cloneAssumptions(templateMatch.assumptions, "demandEstimate.templateMatch.assumptions")
  };
}

function getNumericScopeHintValue(scopeHints: Map<string, DemandScopeHint>, scopeHintKey: string): number {
  const scopeHint = scopeHints.get(scopeHintKey);
  if (scopeHint === undefined) {
    throw new ResourcePlanningModelError(
      "validation_error",
      `demandEstimate.scopeHint.${scopeHintKey} is required for demand driver`
    );
  }
  if (typeof scopeHint.value !== "number" || !Number.isFinite(scopeHint.value)) {
    throw new ResourcePlanningModelError("validation_error", `demandEstimate.scopeHint.${scopeHintKey} must be numeric`);
  }
  if (scopeHint.value < 0) {
    throw new ResourcePlanningModelError(
      "validation_error",
      `demandEstimate.scopeHint.${scopeHintKey} must be a non-negative number`
    );
  }

  return scopeHint.value;
}

function createDriverAssumption(driver: DemandScopeHintDriver, units: number): DemandAssumption {
  const hours = roundHours(requireFiniteFormulaResult(units * driver.hoursPerUnit));

  return {
    code: "scope_hint_driver",
    message: `${driver.scopeHintKey} x ${driver.hoursPerUnit} ч = ${hours} ч.`
  };
}

export function estimateDemandFromTemplateMatch(input: {
  tenantId: TenantId;
  opportunityId: string;
  templateMatch: DemandTemplateMatchInput;
  scopeHints: DemandScopeHint[];
  demandProfile: DemandTemplateProfile;
}): DemandEstimate {
  const rawInput = requireObject(input, "demandEstimate");
  const tenantId = requireNonEmptyString(rawInput.tenantId, "tenantId");
  const opportunityId = requireNonEmptyString(rawInput.opportunityId, "demandEstimate.opportunityId");
  const templateMatch = validateTemplateMatch(rawInput.templateMatch);
  const demandProfile = createDemandTemplateProfile(rawInput.demandProfile);
  if (templateMatch.tenantId !== tenantId) {
    throw new ResourcePlanningModelError("tenant_mismatch", "Template match tenant mismatch");
  }
  if (templateMatch.opportunityId !== opportunityId) {
    throw new ResourcePlanningModelError("validation_error", "Template match opportunity mismatch");
  }
  if (demandProfile.tenantId !== tenantId) {
    throw new ResourcePlanningModelError("tenant_mismatch", "Demand profile tenant mismatch");
  }
  if (demandProfile.templateKey !== templateMatch.template.key) {
    throw new ResourcePlanningModelError(
      "validation_error",
      `Demand profile template mismatch: expected ${templateMatch.template.key}, profile ${demandProfile.templateKey}`
    );
  }
  if (demandProfile.templateVersion !== templateMatch.template.version) {
    throw new ResourcePlanningModelError(
      "validation_error",
      `Demand profile template version mismatch: expected ${templateMatch.template.version}, profile ${demandProfile.templateVersion}`
    );
  }

  const scopeHints = createScopeHintIndex(cloneScopeHints(rawInput.scopeHints), tenantId, opportunityId);
  const formulaRef = `${demandProfile.formula.key}@${demandProfile.formula.version}`;
  const sortedRoleRules = [...demandProfile.roleRules].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    if (left.stageKey !== right.stageKey) return left.stageKey.localeCompare(right.stageKey);
    return left.roleKey.localeCompare(right.roleKey);
  });
  const stageRoleDemands = sortedRoleRules.map((rule) => {
    const driverAssumptions: DemandAssumption[] = [];
    let plannedWorkHours = rule.baseWorkHours;
    for (const driver of rule.scopeHintDrivers) {
      const units = getNumericScopeHintValue(scopeHints, driver.scopeHintKey);
      const driverWorkHours = requireFiniteFormulaResult(units * driver.hoursPerUnit);
      plannedWorkHours = requireFiniteFormulaResult(plannedWorkHours + driverWorkHours);
      if (units !== 0) driverAssumptions.push(createDriverAssumption(driver, units));
    }

    return {
      stageKey: rule.stageKey,
      stageLabel: rule.stageLabel,
      roleKey: rule.roleKey,
      roleLabel: rule.roleLabel,
      plannedWorkHours: roundHours(requireFiniteFormulaResult(plannedWorkHours)),
      confidence: roundConfidence(Math.min(templateMatch.confidence, rule.confidence)),
      formulaRef,
      sourceAssumptions: [...rule.assumptions.map((assumption) => ({ ...assumption })), ...driverAssumptions]
    };
  });
  const totalPlannedWorkHours = roundHours(
    requireFiniteFormulaResult(
      stageRoleDemands.reduce(
        (total, demand) => requireFiniteFormulaResult(total + demand.plannedWorkHours),
        0
      )
    )
  );
  const confidence = roundConfidence(Math.min(...stageRoleDemands.map((demand) => demand.confidence)));

  return {
    tenantId,
    opportunityId,
    template: {
      key: templateMatch.template.key,
      label: templateMatch.template.label,
      version: templateMatch.template.version
    },
    scenario: {
      key: demandProfile.scenarioKey,
      label: demandProfile.scenarioLabel
    },
    formula: { ...demandProfile.formula },
    stageRoleDemands,
    totalPlannedWorkHours,
    confidence,
    assumptions: templateMatch.assumptions.map((assumption) => ({ ...assumption })),
    trace: [
      `demand_estimate:template:${templateMatch.template.key}@${templateMatch.template.version}`,
      `demand_estimate:scenario:${demandProfile.scenarioKey}`,
      `demand_estimate:formula:${formulaRef}`,
      `demand_estimate:stage_role_demands:${stageRoleDemands.length}`
    ]
  };
}
