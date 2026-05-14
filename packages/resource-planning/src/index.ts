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

export type CapacityDateWindow = {
  startDate: string;
  endDate: string;
};

export type CapacitySeverity = "none" | "warning" | "critical";

export type CapacityFeasibilityStatus = "fit" | "overloaded";

export type RoleCapacityBucket = TenantOwned & {
  id: string;
  roleKey: string;
  roleLabel: string;
  periodStart: string;
  periodEnd: string;
  capacityHours: number;
  committedHours: number;
  sourceLabel: string;
};

export type ResourceReservation = TenantOwned & {
  id: string;
  sourceType: "opportunity" | "project" | "stage";
  sourceId: string;
  roleKey: string;
  roleLabel: string;
  periodStart: string;
  periodEnd: string;
  reservedHours: number;
  status: "active" | "released";
  sourceLabel: string;
};

export type ConflictingReservation = {
  id: string;
  sourceType: ResourceReservation["sourceType"];
  sourceId: string;
  roleKey: string;
  roleLabel: string;
  periodStart: string;
  periodEnd: string;
  reservedHours: number;
  sourceLabel: string;
};

export type RoleCapacityFeasibility = {
  roleKey: string;
  roleLabel: string;
  demandedHours: number;
  capacityHours: number;
  committedHours: number;
  conflictingReservedHours: number;
  availableHours: number;
  gapHours: number;
  severity: CapacitySeverity;
  conflictingReservationIds: string[];
};

export type CapacityFeasibilityBlocker = {
  code: "role_capacity_gap" | "conflicting_reservation";
  severity: Exclude<CapacitySeverity, "none">;
  roleKey: string;
  message: string;
  gapHours: number;
  conflictingReservationIds: string[];
};

export type CapacityFeasibilityResult = TenantOwned & {
  opportunityId: string;
  expectedWindow: CapacityDateWindow;
  status: CapacityFeasibilityStatus;
  severity: CapacitySeverity;
  roleResults: RoleCapacityFeasibility[];
  blockers: CapacityFeasibilityBlocker[];
  conflictingReservations: ConflictingReservation[];
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

function requireDateOnly(value: string | undefined, fieldName: string): string {
  const date = requireNonEmptyString(value, fieldName);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} must be a YYYY-MM-DD date`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName} must be a valid calendar date`);
  }

  return date;
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

function requireFiniteCapacityResult(value: number): number {
  if (!Number.isFinite(value)) {
    throw new ResourcePlanningModelError("validation_error", "capacityFeasibility.resultHours must be finite");
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

function createCapacityDateWindow(rawWindow: CapacityDateWindow | undefined, fieldName: string): CapacityDateWindow {
  const window = requireObject(rawWindow, fieldName);
  const startDate = requireDateOnly(window.startDate, `${fieldName}.startDate`);
  const endDate = requireDateOnly(window.endDate, `${fieldName}.endDate`);
  if (startDate > endDate) {
    throw new ResourcePlanningModelError("validation_error", `${fieldName}.startDate must be before or equal to endDate`);
  }

  return { startDate, endDate };
}

export function createRoleCapacityBucket(input: {
  id: string;
  tenantId: TenantId;
  roleKey: string;
  roleLabel: string;
  periodStart: string;
  periodEnd: string;
  capacityHours: number;
  committedHours: number;
  sourceLabel: string;
}): RoleCapacityBucket {
  const rawBucket = requireObject(input, "roleCapacityBucket");
  const period = createCapacityDateWindow(
    { startDate: rawBucket.periodStart, endDate: rawBucket.periodEnd },
    "roleCapacityBucket.period"
  );

  return {
    id: requireNonEmptyString(rawBucket.id, "roleCapacityBucket.id"),
    tenantId: requireNonEmptyString(rawBucket.tenantId, "tenantId"),
    roleKey: requireSystemKey(rawBucket.roleKey, "roleCapacityBucket.roleKey"),
    roleLabel: requireNonEmptyString(rawBucket.roleLabel, "roleCapacityBucket.roleLabel"),
    periodStart: period.startDate,
    periodEnd: period.endDate,
    capacityHours: requireNonNegativeNumber(rawBucket.capacityHours, "roleCapacityBucket.capacityHours"),
    committedHours: requireNonNegativeNumber(rawBucket.committedHours, "roleCapacityBucket.committedHours"),
    sourceLabel: requireNonEmptyString(rawBucket.sourceLabel, "roleCapacityBucket.sourceLabel")
  };
}

function requireReservationStatus(value: ResourceReservation["status"] | undefined): ResourceReservation["status"] {
  if (value !== "active" && value !== "released") {
    throw new ResourcePlanningModelError("validation_error", "resourceReservation.status is invalid");
  }

  return value;
}

function requireReservationSourceType(
  value: ResourceReservation["sourceType"] | undefined
): ResourceReservation["sourceType"] {
  if (value !== "opportunity" && value !== "project" && value !== "stage") {
    throw new ResourcePlanningModelError("validation_error", "resourceReservation.sourceType is invalid");
  }

  return value;
}

export function createResourceReservation(input: {
  id: string;
  tenantId: TenantId;
  sourceType: ResourceReservation["sourceType"];
  sourceId: string;
  roleKey: string;
  roleLabel: string;
  periodStart: string;
  periodEnd: string;
  reservedHours: number;
  status: ResourceReservation["status"];
  sourceLabel: string;
}): ResourceReservation {
  const rawReservation = requireObject(input, "resourceReservation");
  const period = createCapacityDateWindow(
    { startDate: rawReservation.periodStart, endDate: rawReservation.periodEnd },
    "resourceReservation.period"
  );

  return {
    id: requireNonEmptyString(rawReservation.id, "resourceReservation.id"),
    tenantId: requireNonEmptyString(rawReservation.tenantId, "tenantId"),
    sourceType: requireReservationSourceType(rawReservation.sourceType),
    sourceId: requireNonEmptyString(rawReservation.sourceId, "resourceReservation.sourceId"),
    roleKey: requireSystemKey(rawReservation.roleKey, "resourceReservation.roleKey"),
    roleLabel: requireNonEmptyString(rawReservation.roleLabel, "resourceReservation.roleLabel"),
    periodStart: period.startDate,
    periodEnd: period.endDate,
    reservedHours: requireNonNegativeNumber(rawReservation.reservedHours, "resourceReservation.reservedHours"),
    status: requireReservationStatus(rawReservation.status),
    sourceLabel: requireNonEmptyString(rawReservation.sourceLabel, "resourceReservation.sourceLabel")
  };
}

function overlapsWindow(periodStart: string, periodEnd: string, window: CapacityDateWindow): boolean {
  return periodStart <= window.endDate && periodEnd >= window.startDate;
}

function isInsideWindow(periodStart: string, periodEnd: string, window: CapacityDateWindow): boolean {
  return periodStart >= window.startDate && periodEnd <= window.endDate;
}

type RoleDemandAccumulator = {
  roleKey: string;
  roleLabel: string;
  demandedHours: number;
};

function aggregateDemandByRole(demandEstimate: DemandEstimate): RoleDemandAccumulator[] {
  const rawDemands = requireArray(demandEstimate.stageRoleDemands, "capacityFeasibility.demandEstimate.stageRoleDemands");
  if (rawDemands.length === 0) {
    throw new ResourcePlanningModelError(
      "validation_error",
      "capacityFeasibility.demandEstimate.stageRoleDemands must not be empty"
    );
  }
  const byRole = new Map<string, RoleDemandAccumulator>();

  for (const rawDemand of rawDemands) {
    const demand = requireObject(rawDemand, "capacityFeasibility.demandEstimate.stageRoleDemand");
    const roleKey = requireSystemKey(demand.roleKey, "capacityFeasibility.demandEstimate.stageRoleDemand.roleKey");
    const roleLabel = requireNonEmptyString(
      demand.roleLabel,
      "capacityFeasibility.demandEstimate.stageRoleDemand.roleLabel"
    );
    const plannedWorkHours = requireNonNegativeNumber(
      demand.plannedWorkHours,
      "capacityFeasibility.demandEstimate.stageRoleDemand.plannedWorkHours"
    );
    const existing = byRole.get(roleKey);
    if (existing !== undefined) {
      if (existing.roleLabel !== roleLabel) {
        throw new ResourcePlanningModelError("conflict", `Conflicting demand role label for ${roleKey}`);
      }
      existing.demandedHours = requireFiniteCapacityResult(existing.demandedHours + plannedWorkHours);
    } else {
      byRole.set(roleKey, {
        roleKey,
        roleLabel,
        demandedHours: plannedWorkHours
      });
    }
  }

  return [...byRole.values()].sort((left, right) => left.roleKey.localeCompare(right.roleKey));
}

function cloneDemandEstimateForFeasibility(demandEstimate: DemandEstimate | undefined): DemandEstimate {
  const rawDemandEstimate = requireObject(demandEstimate, "capacityFeasibility.demandEstimate");

  return {
    tenantId: requireNonEmptyString(rawDemandEstimate.tenantId, "capacityFeasibility.demandEstimate.tenantId"),
    opportunityId: requireNonEmptyString(
      rawDemandEstimate.opportunityId,
      "capacityFeasibility.demandEstimate.opportunityId"
    ),
    template: {
      ...requireObject(rawDemandEstimate.template, "capacityFeasibility.demandEstimate.template")
    },
    scenario: {
      ...requireObject(rawDemandEstimate.scenario, "capacityFeasibility.demandEstimate.scenario")
    },
    formula: {
      ...requireObject(rawDemandEstimate.formula, "capacityFeasibility.demandEstimate.formula")
    },
    stageRoleDemands: requireArray(
      rawDemandEstimate.stageRoleDemands,
      "capacityFeasibility.demandEstimate.stageRoleDemands"
    ).map((demand) => ({ ...requireObject(demand, "capacityFeasibility.demandEstimate.stageRoleDemand") })),
    totalPlannedWorkHours: requireNonNegativeNumber(
      rawDemandEstimate.totalPlannedWorkHours,
      "capacityFeasibility.demandEstimate.totalPlannedWorkHours"
    ),
    confidence: requireProbability(rawDemandEstimate.confidence, "capacityFeasibility.demandEstimate.confidence"),
    assumptions: cloneAssumptions(rawDemandEstimate.assumptions, "capacityFeasibility.demandEstimate.assumptions"),
    trace: requireArray(rawDemandEstimate.trace, "capacityFeasibility.demandEstimate.trace").map((traceEntry) =>
      requireNonEmptyString(traceEntry, "capacityFeasibility.demandEstimate.traceEntry")
    )
  };
}

function cloneCapacityBuckets(capacityBuckets: RoleCapacityBucket[] | undefined): RoleCapacityBucket[] {
  return requireArray(capacityBuckets, "capacityFeasibility.capacityBuckets").map((bucket) =>
    createRoleCapacityBucket(bucket)
  );
}

function cloneReservations(reservations: ResourceReservation[] | undefined): ResourceReservation[] {
  return requireArray(reservations, "capacityFeasibility.reservations").map((reservation) =>
    createResourceReservation(reservation)
  );
}

function assertUniqueCapacityBucketIds(capacityBuckets: RoleCapacityBucket[]): void {
  const ids = new Set<string>();
  for (const bucket of capacityBuckets) {
    if (ids.has(bucket.id)) {
      throw new ResourcePlanningModelError("conflict", `Duplicate capacity bucket id: ${bucket.id}`);
    }
    ids.add(bucket.id);
  }
}

function assertUniqueReservationIds(reservations: ResourceReservation[]): void {
  const ids = new Set<string>();
  for (const reservation of reservations) {
    if (ids.has(reservation.id)) {
      throw new ResourcePlanningModelError("conflict", `Duplicate reservation id: ${reservation.id}`);
    }
    ids.add(reservation.id);
  }
}

function assertRawTenantOwnership(
  items: object[] | undefined,
  fieldName: string,
  tenantId: TenantId,
  mismatchMessage: string
): void {
  for (const rawItem of requireArray(items, fieldName)) {
    const item = requireObject(rawItem as { tenantId?: string }, `${fieldName}[]`);
    if (requireNonEmptyString(item.tenantId, `${fieldName}.tenantId`) !== tenantId) {
      throw new ResourcePlanningModelError("tenant_mismatch", mismatchMessage);
    }
  }
}

function toConflictingReservation(reservation: ResourceReservation): ConflictingReservation {
  return {
    id: reservation.id,
    sourceType: reservation.sourceType,
    sourceId: reservation.sourceId,
    roleKey: reservation.roleKey,
    roleLabel: reservation.roleLabel,
    periodStart: reservation.periodStart,
    periodEnd: reservation.periodEnd,
    reservedHours: reservation.reservedHours,
    sourceLabel: reservation.sourceLabel
  };
}

export function assessCapacityFeasibility(input: {
  tenantId: TenantId;
  opportunityId: string;
  expectedWindow: CapacityDateWindow;
  demandEstimate: DemandEstimate;
  capacityBuckets: RoleCapacityBucket[];
  reservations: ResourceReservation[];
}): CapacityFeasibilityResult {
  const rawInput = requireObject(input, "capacityFeasibility");
  const tenantId = requireNonEmptyString(rawInput.tenantId, "tenantId");
  const opportunityId = requireNonEmptyString(rawInput.opportunityId, "capacityFeasibility.opportunityId");
  const expectedWindow = createCapacityDateWindow(rawInput.expectedWindow, "capacityFeasibility.expectedWindow");
  const demandEstimate = cloneDemandEstimateForFeasibility(rawInput.demandEstimate);
  if (demandEstimate.tenantId !== tenantId) {
    throw new ResourcePlanningModelError("tenant_mismatch", "Demand estimate tenant mismatch");
  }
  if (demandEstimate.opportunityId !== opportunityId) {
    throw new ResourcePlanningModelError("validation_error", "Demand estimate opportunity mismatch");
  }

  const roleDemands = aggregateDemandByRole(demandEstimate);
  const totalDemandedHours = roundHours(
    requireFiniteCapacityResult(
      roleDemands.reduce((total, roleDemand) => requireFiniteCapacityResult(total + roleDemand.demandedHours), 0)
    )
  );
  if (totalDemandedHours !== roundHours(demandEstimate.totalPlannedWorkHours)) {
    throw new ResourcePlanningModelError("conflict", "Demand estimate total must match stage-role demand sum");
  }
  assertRawTenantOwnership(
    rawInput.capacityBuckets,
    "capacityFeasibility.capacityBuckets",
    tenantId,
    "Capacity bucket tenant mismatch"
  );
  const rawCapacityBuckets = cloneCapacityBuckets(rawInput.capacityBuckets);
  for (const bucket of rawCapacityBuckets) {
    if (bucket.tenantId !== tenantId) {
      throw new ResourcePlanningModelError("tenant_mismatch", "Capacity bucket tenant mismatch");
    }
    if (overlapsWindow(bucket.periodStart, bucket.periodEnd, expectedWindow)) {
      if (!isInsideWindow(bucket.periodStart, bucket.periodEnd, expectedWindow)) {
        throw new ResourcePlanningModelError(
          "validation_error",
          "Capacity bucket period must be inside expected window"
        );
      }
    }
  }
  assertUniqueCapacityBucketIds(rawCapacityBuckets);
  const capacityBuckets = rawCapacityBuckets
    .filter((bucket) => overlapsWindow(bucket.periodStart, bucket.periodEnd, expectedWindow))
    .sort((left, right) => {
      if (left.roleKey !== right.roleKey) return left.roleKey.localeCompare(right.roleKey);
      if (left.periodStart !== right.periodStart) return left.periodStart.localeCompare(right.periodStart);
      return left.id.localeCompare(right.id);
    });

  assertRawTenantOwnership(
    rawInput.reservations,
    "capacityFeasibility.reservations",
    tenantId,
    "Reservation tenant mismatch"
  );
  const rawReservations = cloneReservations(rawInput.reservations);
  for (const reservation of rawReservations) {
    if (reservation.tenantId !== tenantId) {
      throw new ResourcePlanningModelError("tenant_mismatch", "Reservation tenant mismatch");
    }
    if (reservation.status === "active" && overlapsWindow(reservation.periodStart, reservation.periodEnd, expectedWindow)) {
      if (!isInsideWindow(reservation.periodStart, reservation.periodEnd, expectedWindow)) {
        throw new ResourcePlanningModelError("validation_error", "Reservation period must be inside expected window");
      }
    }
  }
  assertUniqueReservationIds(rawReservations);
  const reservations = rawReservations
    .filter((reservation) => reservation.status === "active")
    .filter((reservation) => overlapsWindow(reservation.periodStart, reservation.periodEnd, expectedWindow))
    .sort((left, right) => {
      if (left.roleKey !== right.roleKey) return left.roleKey.localeCompare(right.roleKey);
      if (left.periodStart !== right.periodStart) return left.periodStart.localeCompare(right.periodStart);
      return left.id.localeCompare(right.id);
    });

  const conflictingReservations = reservations
    .filter((reservation) => reservation.sourceType !== "opportunity" || reservation.sourceId !== opportunityId)
    .map(toConflictingReservation);
  const roleResults: RoleCapacityFeasibility[] = roleDemands.map((demand) => {
    const roleBuckets = capacityBuckets.filter((bucket) => bucket.roleKey === demand.roleKey);
    const roleConflicts = conflictingReservations.filter((reservation) => reservation.roleKey === demand.roleKey);
    const capacityHours = roundHours(
      requireFiniteCapacityResult(roleBuckets.reduce((total, bucket) => total + bucket.capacityHours, 0))
    );
    const committedHours = roundHours(
      requireFiniteCapacityResult(roleBuckets.reduce((total, bucket) => total + bucket.committedHours, 0))
    );
    const conflictingReservedHours = roundHours(
      requireFiniteCapacityResult(roleConflicts.reduce((total, reservation) => total + reservation.reservedHours, 0))
    );
    const availableHours = roundHours(
      requireFiniteCapacityResult(capacityHours - committedHours - conflictingReservedHours)
    );
    const gapHours = roundHours(Math.max(0, requireFiniteCapacityResult(demand.demandedHours - availableHours)));

    return {
      roleKey: demand.roleKey,
      roleLabel: demand.roleLabel,
      demandedHours: roundHours(demand.demandedHours),
      capacityHours,
      committedHours,
      conflictingReservedHours,
      availableHours,
      gapHours,
      severity: gapHours > 0 ? "critical" : roleConflicts.length > 0 ? "warning" : "none",
      conflictingReservationIds: roleConflicts.map((reservation) => reservation.id).sort()
    };
  });
  const blockers = roleResults.flatMap((roleResult): CapacityFeasibilityBlocker[] => {
    if (roleResult.gapHours > 0) {
      return [
        {
          code: "role_capacity_gap",
          severity: "critical",
          roleKey: roleResult.roleKey,
          message: `Недостаточно емкости роли: ${roleResult.roleLabel}, дефицит ${roleResult.gapHours} ч.`,
          gapHours: roleResult.gapHours,
          conflictingReservationIds: roleResult.conflictingReservationIds
        }
      ];
    }
    if (roleResult.conflictingReservationIds.length > 0) {
      return [
        {
          code: "conflicting_reservation",
          severity: "warning",
          roleKey: roleResult.roleKey,
          message: `Есть пересекающиеся резервы роли: ${roleResult.roleLabel}.`,
          gapHours: 0,
          conflictingReservationIds: roleResult.conflictingReservationIds
        }
      ];
    }

    return [];
  });
  const hasCriticalBlocker = blockers.some((blocker) => blocker.severity === "critical");
  const hasWarningBlocker = blockers.some((blocker) => blocker.severity === "warning");
  const status: CapacityFeasibilityStatus = hasCriticalBlocker ? "overloaded" : "fit";
  const severity: CapacitySeverity = hasCriticalBlocker ? "critical" : hasWarningBlocker ? "warning" : "none";

  return {
    tenantId,
    opportunityId,
    expectedWindow,
    status,
    severity,
    roleResults,
    blockers,
    conflictingReservations,
    assumptions: [
      ...demandEstimate.assumptions.map((assumption) => ({ ...assumption })),
      {
        code: "seeded_capacity_window",
        message: `Проверка использует seeded capacity buckets for ${expectedWindow.startDate}..${expectedWindow.endDate}.`
      }
    ],
    trace: [
      `capacity_feasibility:window:${expectedWindow.startDate}..${expectedWindow.endDate}`,
      `capacity_feasibility:demand_roles:${roleResults.length}`,
      `capacity_feasibility:capacity_buckets:${capacityBuckets.length}`,
      `capacity_feasibility:conflicting_reservations:${conflictingReservations.length}`,
      `capacity_feasibility:status:${status}`
    ]
  };
}
