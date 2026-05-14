import type { TenantId, TenantOwned } from "@kiss-pm/domain-core";

export const packageName = "@kiss-pm/project-core";

export type ProjectProcessTemplateId = string;

export type ProjectProcessTemplateAssumption = {
  code: string;
  message: string;
};

export type ProjectProcessTemplateDraft = TenantOwned & {
  id: ProjectProcessTemplateId;
  key: string;
  label: string;
  categoryKeys: string[];
  typologyKeys: string[];
  requiredScopeHintKeys: string[];
  optionalScopeHintKeys: string[];
  baseConfidence: number;
  priority: number;
  active: boolean;
  version: number;
  assumptions: ProjectProcessTemplateAssumption[];
  updatedAt: string;
};

export type ArtifactTemplate = TenantOwned & {
  id: string;
  key: string;
  label: string;
  required: boolean;
};

export type ApprovalTemplate = TenantOwned & {
  id: string;
  key: string;
  label: string;
  approverRoleKey: string;
  required: boolean;
};

export type StageTaskTemplate = TenantOwned & {
  id: string;
  key: string;
  label: string;
  defaultParticipantRoleKeys: string[];
  required: boolean;
};

export type StageTemplate = TenantOwned & {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  active: boolean;
  version: number;
  updatedAt: string;
  requiredArtifactTemplates: ArtifactTemplate[];
  approvalTemplates: ApprovalTemplate[];
  taskTemplates: StageTaskTemplate[];
};

export type ProcessTemplate = TenantOwned & {
  id: string;
  key: string;
  label: string;
  active: boolean;
  version: number;
  updatedAt: string;
  stages: StageTemplate[];
};

export type ArtifactTemplateSnapshot = Omit<ArtifactTemplate, "tenantId">;
export type ApprovalTemplateSnapshot = Omit<ApprovalTemplate, "tenantId">;
export type StageTaskTemplateSnapshot = Omit<StageTaskTemplate, "tenantId">;

export type StageTemplateSnapshot = Omit<StageTemplate, "tenantId" | "requiredArtifactTemplates" | "approvalTemplates" | "taskTemplates"> & {
  requiredArtifactTemplates: ArtifactTemplateSnapshot[];
  approvalTemplates: ApprovalTemplateSnapshot[];
  taskTemplates: StageTaskTemplateSnapshot[];
};

export type ProcessTemplateVersionSnapshot = TenantOwned & {
  templateId: string;
  key: string;
  label: string;
  version: number;
  active: boolean;
  updatedAt: string;
  stageTemplates: StageTemplateSnapshot[];
};

export type ProjectDraftStatus = "draft";

export type ProjectDraftSourceOpportunity = TenantOwned & {
  type: "crm_opportunity";
  opportunityId: string;
  title: string;
  accountId?: string;
  contactIds: string[];
  plannedStartDate: string;
  desiredFinishDate: string;
};

export type ProjectDraftTemplateSnapshot = TenantOwned & {
  templateId: string;
  key: string;
  label: string;
  version: number;
  matchConfidence: number;
  assumptions: ProjectProcessTemplateAssumption[];
};

export type ProjectDraftStageRoleDemand = {
  stageKey: string;
  stageLabel: string;
  roleKey: string;
  roleLabel: string;
  plannedWorkHours: number;
};

export type ProjectDraftDemandSnapshot = TenantOwned & {
  totalPlannedWorkHours: number;
  scenarioKey: string;
  scenarioLabel: string;
  formulaKey: string;
  formulaVersion: number;
  confidence: number;
  stageRoleDemands: ProjectDraftStageRoleDemand[];
};

export type ProjectDraftFeasibilitySnapshot = TenantOwned & {
  status: "fit" | "overloaded";
  severity: "none" | "warning" | "critical";
  expectedWindow: {
    startDate: string;
    endDate: string;
  };
  blockerCodes: string[];
};

export type ProjectDraft = TenantOwned & {
  id: string;
  title: string;
  status: ProjectDraftStatus;
  sourceOpportunity: ProjectDraftSourceOpportunity;
  processTemplate: ProjectDraftTemplateSnapshot;
  demand: ProjectDraftDemandSnapshot;
  feasibility: ProjectDraftFeasibilitySnapshot;
  createdBy: string;
  createdAt: string;
  correlationId: string;
};

export class ProjectCoreModelError extends Error {
  constructor(
    readonly code: "validation_error" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "ProjectCoreModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireBoolean(value: boolean | undefined, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a boolean`);
  }

  return value;
}

function requireProbability(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be between 0 and 1`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
    timestamp
  );
  if (match === null) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  const isValidCalendarDate =
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day;

  if (
    !isValidCalendarDate ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    Number.isNaN(Date.parse(timestamp))
  ) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireDateOnly(value: string | undefined, fieldName: string): string {
  const date = requireNonEmptyString(value, fieldName);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a YYYY-MM-DD date`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a valid calendar date`);
  }

  return date;
}

function requireSystemKey(value: string | undefined, fieldName: string): string {
  const key = requireNonEmptyString(value, fieldName);
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(key)) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a stable system key`);
  }

  return key;
}

function requireObject<T extends object>(value: T | undefined, fieldName: string): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be an object`);
  }

  return value;
}

function requireArray<T>(value: T[] | undefined, fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be an array`);
  }

  return value;
}

function requireNonNegativeNumber(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be a non-negative number`);
  }

  return value;
}

function requireSystemKeyArray(value: string[] | undefined, fieldName: string, allowEmpty: boolean): string[] {
  if (!Array.isArray(value)) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be an array`);
  }
  if (!allowEmpty && value.length === 0) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must not be empty`);
  }

  return value.map((key) => requireSystemKey(key, `${fieldName}[]`));
}

function assertUniqueKeys(keys: string[], message: string): void {
  if (new Set(keys).size !== keys.length) {
    throw new ProjectCoreModelError("conflict", message);
  }
}

function cloneAssumptions(
  assumptions: ProjectProcessTemplateAssumption[] | undefined,
  fieldName = "projectProcessTemplate.assumptions",
  itemFieldName = "projectProcessTemplate.assumption"
): ProjectProcessTemplateAssumption[] {
  if (!Array.isArray(assumptions)) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} must be an array`);
  }

  return assumptions.map((rawAssumption) => {
    const assumption = requireObject(rawAssumption, itemFieldName);

    return {
      code: requireSystemKey(assumption.code, `${itemFieldName}.code`),
      message: requireNonEmptyString(assumption.message, `${itemFieldName}.message`)
    };
  });
}

function assertTenantId(tenantId: TenantId, entityTenantId: TenantId, message: string): void {
  if (entityTenantId !== tenantId) {
    throw new ProjectCoreModelError("validation_error", message);
  }
}

function assertTenant(tenantId: TenantId, entity: TenantOwned, fieldName: string): void {
  if (entity.tenantId !== tenantId) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} tenant mismatch`);
  }
}

function assertUniqueFieldValues<T>(
  items: T[],
  getValue: (item: T) => string | number,
  message: string
): void {
  const values = items.map(getValue);
  if (new Set(values).size !== values.length) {
    throw new ProjectCoreModelError("conflict", message);
  }
}

function cloneArtifactTemplates(
  tenantId: TenantId,
  stageKey: string,
  templates: ArtifactTemplate[] | undefined
): ArtifactTemplate[] {
  const cloned = requireArray(templates, "stageTemplate.requiredArtifactTemplates").map((rawTemplate) => {
    const template = requireObject(rawTemplate, "stageTemplate.requiredArtifactTemplate");
    const id = requireNonEmptyString(template.id, "stageTemplate.requiredArtifactTemplate.id");
    const templateTenantId = requireNonEmptyString(template.tenantId, "stageTemplate.requiredArtifactTemplate.tenantId");
    assertTenantId(tenantId, templateTenantId, `stageTemplate.requiredArtifactTemplate tenant mismatch: ${id}`);

    return {
      id,
      tenantId,
      key: requireSystemKey(template.key, "stageTemplate.requiredArtifactTemplate.key"),
      label: requireNonEmptyString(template.label, "stageTemplate.requiredArtifactTemplate.label"),
      required: requireBoolean(template.required, "stageTemplate.requiredArtifactTemplate.required")
    };
  });

  assertUniqueFieldValues(
    cloned,
    (template) => template.id,
    `stageTemplate.requiredArtifactTemplates ids must be unique: ${stageKey}`
  );
  assertUniqueFieldValues(
    cloned,
    (template) => template.key,
    `stageTemplate.requiredArtifactTemplates keys must be unique: ${stageKey}`
  );

  return cloned;
}

function cloneApprovalTemplates(
  tenantId: TenantId,
  stageKey: string,
  templates: ApprovalTemplate[] | undefined
): ApprovalTemplate[] {
  const cloned = requireArray(templates, "stageTemplate.approvalTemplates").map((rawTemplate) => {
    const template = requireObject(rawTemplate, "stageTemplate.approvalTemplate");
    const id = requireNonEmptyString(template.id, "stageTemplate.approvalTemplate.id");
    const templateTenantId = requireNonEmptyString(template.tenantId, "stageTemplate.approvalTemplate.tenantId");
    assertTenantId(tenantId, templateTenantId, `stageTemplate.approvalTemplate tenant mismatch: ${id}`);

    return {
      id,
      tenantId,
      key: requireSystemKey(template.key, "stageTemplate.approvalTemplate.key"),
      label: requireNonEmptyString(template.label, "stageTemplate.approvalTemplate.label"),
      approverRoleKey: requireSystemKey(
        template.approverRoleKey,
        "stageTemplate.approvalTemplate.approverRoleKey"
      ),
      required: requireBoolean(template.required, "stageTemplate.approvalTemplate.required")
    };
  });

  assertUniqueFieldValues(
    cloned,
    (template) => template.id,
    `stageTemplate.approvalTemplates ids must be unique: ${stageKey}`
  );
  assertUniqueFieldValues(
    cloned,
    (template) => template.key,
    `stageTemplate.approvalTemplates keys must be unique: ${stageKey}`
  );

  return cloned;
}

function cloneStageTaskTemplates(
  tenantId: TenantId,
  stageKey: string,
  templates: StageTaskTemplate[] | undefined
): StageTaskTemplate[] {
  const cloned = requireArray(templates, "stageTemplate.taskTemplates").map((rawTemplate) => {
    const template = requireObject(rawTemplate, "stageTemplate.taskTemplate");
    const id = requireNonEmptyString(template.id, "stageTemplate.taskTemplate.id");
    const templateTenantId = requireNonEmptyString(template.tenantId, "stageTemplate.taskTemplate.tenantId");
    assertTenantId(tenantId, templateTenantId, `stageTemplate.taskTemplate tenant mismatch: ${id}`);
    const defaultParticipantRoleKeys = requireSystemKeyArray(
      template.defaultParticipantRoleKeys,
      "stageTemplate.taskTemplate.defaultParticipantRoleKeys",
      true
    );
    assertUniqueKeys(defaultParticipantRoleKeys, "stageTemplate.taskTemplate default participant role keys must be unique");

    return {
      id,
      tenantId,
      key: requireSystemKey(template.key, "stageTemplate.taskTemplate.key"),
      label: requireNonEmptyString(template.label, "stageTemplate.taskTemplate.label"),
      defaultParticipantRoleKeys,
      required: requireBoolean(template.required, "stageTemplate.taskTemplate.required")
    };
  });

  assertUniqueFieldValues(
    cloned,
    (template) => template.id,
    `stageTemplate.taskTemplates ids must be unique: ${stageKey}`
  );
  assertUniqueFieldValues(
    cloned,
    (template) => template.key,
    `stageTemplate.taskTemplates keys must be unique: ${stageKey}`
  );

  return cloned;
}

function cloneStageTemplates(tenantId: TenantId, stages: StageTemplate[] | undefined): StageTemplate[] {
  const cloned = requireArray(stages, "processTemplate.stages").map((rawStage) => {
    const stage = requireObject(rawStage, "processTemplate.stageTemplate");
    const id = requireNonEmptyString(stage.id, "processTemplate.stageTemplate.id");
    const stageTenantId = requireNonEmptyString(stage.tenantId, "processTemplate.stageTemplate.tenantId");
    assertTenantId(tenantId, stageTenantId, `processTemplate.stageTemplate tenant mismatch: ${id}`);
    const key = requireSystemKey(stage.key, "processTemplate.stageTemplate.key");

    return {
      id,
      tenantId,
      key,
      label: requireNonEmptyString(stage.label, "processTemplate.stageTemplate.label"),
      sortOrder: requirePositiveInteger(stage.sortOrder, "processTemplate.stageTemplate.sortOrder"),
      active: requireBoolean(stage.active, "processTemplate.stageTemplate.active"),
      version: requirePositiveInteger(stage.version, "processTemplate.stageTemplate.version"),
      updatedAt: requireValidTimestamp(stage.updatedAt, "processTemplate.stageTemplate.updatedAt"),
      requiredArtifactTemplates: cloneArtifactTemplates(tenantId, key, stage.requiredArtifactTemplates),
      approvalTemplates: cloneApprovalTemplates(tenantId, key, stage.approvalTemplates),
      taskTemplates: cloneStageTaskTemplates(tenantId, key, stage.taskTemplates)
    };
  });

  if (cloned.length === 0) {
    throw new ProjectCoreModelError("validation_error", "processTemplate.stages must not be empty");
  }
  assertUniqueFieldValues(cloned, (stage) => stage.id, "processTemplate stage ids must be unique");
  assertUniqueFieldValues(cloned, (stage) => stage.key, "processTemplate stage keys must be unique");
  assertUniqueFieldValues(cloned, (stage) => stage.sortOrder, "processTemplate stage sort orders must be unique");

  return [...cloned].sort((left, right) => left.sortOrder - right.sortOrder);
}

function cloneProjectDraftSourceOpportunity(
  tenantId: TenantId,
  sourceOpportunity: ProjectDraftSourceOpportunity
): ProjectDraftSourceOpportunity {
  const source = requireObject(sourceOpportunity, "projectDraft.sourceOpportunity");
  assertTenant(tenantId, source, "projectDraft.sourceOpportunity");
  const contactIds = requireArray(source.contactIds, "projectDraft.sourceOpportunity.contactIds").map((contactId) =>
    requireNonEmptyString(contactId, "projectDraft.sourceOpportunity.contactIds[]")
  );

  return {
    tenantId,
    type: "crm_opportunity",
    opportunityId: requireNonEmptyString(source.opportunityId, "projectDraft.sourceOpportunity.opportunityId"),
    title: requireNonEmptyString(source.title, "projectDraft.sourceOpportunity.title"),
    ...(source.accountId !== undefined
      ? { accountId: requireNonEmptyString(source.accountId, "projectDraft.sourceOpportunity.accountId") }
      : {}),
    contactIds,
    plannedStartDate: requireDateOnly(source.plannedStartDate, "projectDraft.sourceOpportunity.plannedStartDate"),
    desiredFinishDate: requireDateOnly(source.desiredFinishDate, "projectDraft.sourceOpportunity.desiredFinishDate")
  };
}

function cloneProjectDraftTemplateSnapshot(
  tenantId: TenantId,
  processTemplate: ProjectDraftTemplateSnapshot
): ProjectDraftTemplateSnapshot {
  const template = requireObject(processTemplate, "projectDraft.processTemplate");
  assertTenant(tenantId, template, "projectDraft.processTemplate");

  return {
    tenantId,
    templateId: requireNonEmptyString(template.templateId, "projectDraft.processTemplate.templateId"),
    key: requireSystemKey(template.key, "projectDraft.processTemplate.key"),
    label: requireNonEmptyString(template.label, "projectDraft.processTemplate.label"),
    version: requirePositiveInteger(template.version, "projectDraft.processTemplate.version"),
    matchConfidence: requireProbability(template.matchConfidence, "projectDraft.processTemplate.matchConfidence"),
    assumptions: cloneAssumptions(template.assumptions, "projectDraft.processTemplate.assumptions")
  };
}

function cloneProjectDraftStageRoleDemands(
  demands: ProjectDraftStageRoleDemand[] | undefined
): ProjectDraftStageRoleDemand[] {
  return requireArray(demands, "projectDraft.demand.stageRoleDemands").map((rawDemand) => {
    const demand = requireObject(rawDemand, "projectDraft.demand.stageRoleDemand");

    return {
      stageKey: requireSystemKey(demand.stageKey, "projectDraft.demand.stageRoleDemand.stageKey"),
      stageLabel: requireNonEmptyString(demand.stageLabel, "projectDraft.demand.stageRoleDemand.stageLabel"),
      roleKey: requireSystemKey(demand.roleKey, "projectDraft.demand.stageRoleDemand.roleKey"),
      roleLabel: requireNonEmptyString(demand.roleLabel, "projectDraft.demand.stageRoleDemand.roleLabel"),
      plannedWorkHours: requireNonNegativeNumber(
        demand.plannedWorkHours,
        "projectDraft.demand.stageRoleDemand.plannedWorkHours"
      )
    };
  });
}

function cloneProjectDraftDemandSnapshot(
  tenantId: TenantId,
  demandSnapshot: ProjectDraftDemandSnapshot
): ProjectDraftDemandSnapshot {
  const demand = requireObject(demandSnapshot, "projectDraft.demand");
  assertTenant(tenantId, demand, "projectDraft.demand");

  return {
    tenantId,
    totalPlannedWorkHours: requireNonNegativeNumber(
      demand.totalPlannedWorkHours,
      "projectDraft.demand.totalPlannedWorkHours"
    ),
    scenarioKey: requireSystemKey(demand.scenarioKey, "projectDraft.demand.scenarioKey"),
    scenarioLabel: requireNonEmptyString(demand.scenarioLabel, "projectDraft.demand.scenarioLabel"),
    formulaKey: requireSystemKey(demand.formulaKey, "projectDraft.demand.formulaKey"),
    formulaVersion: requirePositiveInteger(demand.formulaVersion, "projectDraft.demand.formulaVersion"),
    confidence: requireProbability(demand.confidence, "projectDraft.demand.confidence"),
    stageRoleDemands: cloneProjectDraftStageRoleDemands(demand.stageRoleDemands)
  };
}

function requireFeasibilityStatus(value: ProjectDraftFeasibilitySnapshot["status"] | undefined): "fit" | "overloaded" {
  if (value !== "fit" && value !== "overloaded") {
    throw new ProjectCoreModelError("validation_error", "projectDraft.feasibility.status is invalid");
  }

  return value;
}

function requireFeasibilitySeverity(
  value: ProjectDraftFeasibilitySnapshot["severity"] | undefined
): "none" | "warning" | "critical" {
  if (value !== "none" && value !== "warning" && value !== "critical") {
    throw new ProjectCoreModelError("validation_error", "projectDraft.feasibility.severity is invalid");
  }

  return value;
}

function cloneProjectDraftFeasibilitySnapshot(
  tenantId: TenantId,
  feasibilitySnapshot: ProjectDraftFeasibilitySnapshot
): ProjectDraftFeasibilitySnapshot {
  const feasibility = requireObject(feasibilitySnapshot, "projectDraft.feasibility");
  assertTenant(tenantId, feasibility, "projectDraft.feasibility");
  const expectedWindow = requireObject(feasibility.expectedWindow, "projectDraft.feasibility.expectedWindow");

  return {
    tenantId,
    status: requireFeasibilityStatus(feasibility.status),
    severity: requireFeasibilitySeverity(feasibility.severity),
    expectedWindow: {
      startDate: requireDateOnly(expectedWindow.startDate, "projectDraft.feasibility.expectedWindow.startDate"),
      endDate: requireDateOnly(expectedWindow.endDate, "projectDraft.feasibility.expectedWindow.endDate")
    },
    blockerCodes: requireArray(feasibility.blockerCodes, "projectDraft.feasibility.blockerCodes").map((code) =>
      requireSystemKey(code, "projectDraft.feasibility.blockerCodes[]")
    )
  };
}

export function createProjectProcessTemplateDraft(input: {
  id: ProjectProcessTemplateId;
  tenantId: TenantId;
  key: string;
  label: string;
  categoryKeys: string[];
  typologyKeys: string[];
  requiredScopeHintKeys: string[];
  optionalScopeHintKeys: string[];
  baseConfidence: number;
  priority: number;
  active: boolean;
  version: number;
  assumptions: ProjectProcessTemplateAssumption[];
  updatedAt: string;
}): ProjectProcessTemplateDraft {
  const categoryKeys = requireSystemKeyArray(input.categoryKeys, "projectProcessTemplate.categoryKeys", false);
  const typologyKeys = requireSystemKeyArray(input.typologyKeys, "projectProcessTemplate.typologyKeys", false);
  const requiredScopeHintKeys = requireSystemKeyArray(
    input.requiredScopeHintKeys,
    "projectProcessTemplate.requiredScopeHintKeys",
    true
  );
  const optionalScopeHintKeys = requireSystemKeyArray(
    input.optionalScopeHintKeys,
    "projectProcessTemplate.optionalScopeHintKeys",
    true
  );
  assertUniqueKeys(categoryKeys, "projectProcessTemplate category keys must be unique");
  assertUniqueKeys(typologyKeys, "projectProcessTemplate typology keys must be unique");
  assertUniqueKeys(
    [...requiredScopeHintKeys, ...optionalScopeHintKeys],
    "projectProcessTemplate scope hint keys must be unique"
  );

  return {
    id: requireNonEmptyString(input.id, "projectProcessTemplate.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    key: requireSystemKey(input.key, "projectProcessTemplate.key"),
    label: requireNonEmptyString(input.label, "projectProcessTemplate.label"),
    categoryKeys,
    typologyKeys,
    requiredScopeHintKeys,
    optionalScopeHintKeys,
    baseConfidence: requireProbability(input.baseConfidence, "projectProcessTemplate.baseConfidence"),
    priority: requirePositiveInteger(input.priority, "projectProcessTemplate.priority"),
    active: requireBoolean(input.active, "projectProcessTemplate.active"),
    version: requirePositiveInteger(input.version, "projectProcessTemplate.version"),
    assumptions: cloneAssumptions(input.assumptions),
    updatedAt: requireValidTimestamp(input.updatedAt, "projectProcessTemplate.updatedAt")
  };
}

export function createProcessTemplate(input: {
  id: string;
  tenantId: TenantId;
  key: string;
  label: string;
  active: boolean;
  version: number;
  updatedAt: string;
  stages: StageTemplate[];
}): ProcessTemplate {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");

  return {
    id: requireNonEmptyString(input.id, "processTemplate.id"),
    tenantId,
    key: requireSystemKey(input.key, "processTemplate.key"),
    label: requireNonEmptyString(input.label, "processTemplate.label"),
    active: requireBoolean(input.active, "processTemplate.active"),
    version: requirePositiveInteger(input.version, "processTemplate.version"),
    updatedAt: requireValidTimestamp(input.updatedAt, "processTemplate.updatedAt"),
    stages: cloneStageTemplates(tenantId, input.stages)
  };
}

export function createProcessTemplateVersionSnapshot(template: ProcessTemplate): ProcessTemplateVersionSnapshot {
  const processTemplate = createProcessTemplate(template);

  return {
    tenantId: processTemplate.tenantId,
    templateId: processTemplate.id,
    key: processTemplate.key,
    label: processTemplate.label,
    version: processTemplate.version,
    active: processTemplate.active,
    updatedAt: processTemplate.updatedAt,
    stageTemplates: processTemplate.stages.map((stage) => ({
      id: stage.id,
      key: stage.key,
      label: stage.label,
      sortOrder: stage.sortOrder,
      active: stage.active,
      version: stage.version,
      updatedAt: stage.updatedAt,
      requiredArtifactTemplates: stage.requiredArtifactTemplates.map((artifactTemplate) => ({
        id: artifactTemplate.id,
        key: artifactTemplate.key,
        label: artifactTemplate.label,
        required: artifactTemplate.required
      })),
      approvalTemplates: stage.approvalTemplates.map((approvalTemplate) => ({
        id: approvalTemplate.id,
        key: approvalTemplate.key,
        label: approvalTemplate.label,
        approverRoleKey: approvalTemplate.approverRoleKey,
        required: approvalTemplate.required
      })),
      taskTemplates: stage.taskTemplates.map((taskTemplate) => ({
        id: taskTemplate.id,
        key: taskTemplate.key,
        label: taskTemplate.label,
        defaultParticipantRoleKeys: [...taskTemplate.defaultParticipantRoleKeys],
        required: taskTemplate.required
      }))
    }))
  };
}

export function createProjectDraftFromOpportunity(input: {
  id: string;
  tenantId: TenantId;
  title: string;
  createdBy: string;
  createdAt: string;
  correlationId: string;
  sourceOpportunity: ProjectDraftSourceOpportunity;
  processTemplate: ProjectDraftTemplateSnapshot;
  demand: ProjectDraftDemandSnapshot;
  feasibility: ProjectDraftFeasibilitySnapshot;
}): ProjectDraft {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const sourceOpportunity = cloneProjectDraftSourceOpportunity(tenantId, input.sourceOpportunity);
  const processTemplate = cloneProjectDraftTemplateSnapshot(tenantId, input.processTemplate);
  const demand = cloneProjectDraftDemandSnapshot(tenantId, input.demand);
  const feasibility = cloneProjectDraftFeasibilitySnapshot(tenantId, input.feasibility);

  if (sourceOpportunity.desiredFinishDate < sourceOpportunity.plannedStartDate) {
    throw new ProjectCoreModelError("validation_error", "projectDraft source date window is invalid");
  }
  if (feasibility.expectedWindow.startDate !== sourceOpportunity.plannedStartDate) {
    throw new ProjectCoreModelError("validation_error", "projectDraft feasibility start date does not match source");
  }
  if (feasibility.expectedWindow.endDate !== sourceOpportunity.desiredFinishDate) {
    throw new ProjectCoreModelError("validation_error", "projectDraft feasibility end date does not match source");
  }

  return {
    id: requireNonEmptyString(input.id, "projectDraft.id"),
    tenantId,
    title: requireNonEmptyString(input.title, "projectDraft.title"),
    status: "draft",
    sourceOpportunity,
    processTemplate,
    demand,
    feasibility,
    createdBy: requireNonEmptyString(input.createdBy, "projectDraft.createdBy"),
    createdAt: requireValidTimestamp(input.createdAt, "projectDraft.createdAt"),
    correlationId: requireNonEmptyString(input.correlationId, "projectDraft.correlationId")
  };
}
