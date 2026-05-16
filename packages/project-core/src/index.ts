import type { TenantId, TenantOwned, TenantUserId } from "@kiss-pm/domain-core";

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

export type ManagedProjectLifecycleStatus = "active" | "completed" | "cancelled";
export type ProjectStageStatus = "pending" | "active" | "completed" | "cancelled";
export type ProjectLifecycleTransition = "advance_stage" | "complete_project" | "cancel_project";

export type ProjectStage = TenantOwned & {
  id: string;
  projectId: string;
  templateId: string;
  templateKey: string;
  templateVersion: number;
  label: string;
  sortOrder: number;
  status: ProjectStageStatus;
  startedAt?: string;
  completedAt?: string;
};

export type ProjectStageHistoryEntry = TenantOwned & {
  id: string;
  projectId: string;
  stageId: string;
  transition: "create_from_draft" | ProjectLifecycleTransition;
  fromStatus: ProjectStageStatus | null;
  toStatus: ProjectStageStatus;
  actorId: string;
  occurredAt: string;
  correlationId: string;
};

export type ProjectArtifactStatus = "submitted" | "accepted" | "rejected";

export type ProjectArtifact = TenantOwned & {
  id: string;
  projectId: string;
  stageId: string;
  templateId: string;
  templateKey: string;
  templateVersion: number;
  label: string;
  status: ProjectArtifactStatus;
  evidenceRef?: string;
  actorId: string;
  occurredAt: string;
};

export type ApprovalRequestStatus = "requested" | "approved" | "rejected";

export type ApprovalRequest = TenantOwned & {
  id: string;
  projectId: string;
  stageId: string;
  templateId: string;
  templateKey: string;
  templateVersion: number;
  label: string;
  approverRoleKey: string;
  status: ApprovalRequestStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
};

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";

export type TaskSourceTemplateSnapshot = {
  type: "stage_task_template";
  processTemplateId: string;
  processTemplateVersion: number;
  stageTemplateId: string;
  stageTemplateKey: string;
  stageTemplateVersion: number;
  taskTemplateId: string;
  taskTemplateKey: string;
  taskTemplateLabel: string;
  required: boolean;
  defaultParticipantRoleKeys: string[];
};

export type Task = TenantOwned & {
  id: string;
  projectId: string;
  stageId: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
  plannedWorkHours: number;
  sourceTemplate: TaskSourceTemplateSnapshot;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
};

export type TaskParticipantRole = "executor" | "co_executor" | "requester" | "controller" | "approver" | "observer";

export type TaskParticipant = TenantOwned & {
  id: string;
  projectId: string;
  stageId: string;
  taskId: string;
  userId: TenantUserId;
  role: TaskParticipantRole;
  addedBy: TenantUserId;
  addedAt: string;
  correlationId: string;
};

export type TaskComment = TenantOwned & {
  id: string;
  projectId: string;
  stageId: string;
  taskId: string;
  body: string;
  authorId: TenantUserId;
  createdAt: string;
  correlationId: string;
};

export type TaskStatusHistoryEntry = TenantOwned & {
  id: string;
  projectId: string;
  stageId: string;
  taskId: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  actorId: TenantUserId;
  changedAt: string;
  correlationId: string;
};

export type StageGateBlockerCode = "missing_required_artifact" | "required_approval_not_approved";

export type StageGateBlocker = {
  code: StageGateBlockerCode;
  message: string;
  stageId: string;
  templateId: string;
  templateKey: string;
  templateLabel: string;
};

export type StageGateEvaluation = {
  ok: boolean;
  stageId: string;
  blockers: StageGateBlocker[];
};

export type ManagedProject = TenantOwned & {
  id: string;
  title: string;
  lifecycleStatus: ManagedProjectLifecycleStatus;
  currentStageId: string | null;
  sourceDraftId: string;
  sourceOpportunity: ProjectDraftSourceOpportunity;
  processTemplateSnapshot: ProcessTemplateVersionSnapshot;
  stages: ProjectStage[];
  stageHistory: ProjectStageHistoryEntry[];
  tasks: Task[];
  taskParticipants: TaskParticipant[];
  taskComments: TaskComment[];
  taskStatusHistory: TaskStatusHistoryEntry[];
  artifacts: ProjectArtifact[];
  approvalRequests: ApprovalRequest[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
};

export type ProjectLifecycleTransitionCommand = {
  tenantId: TenantId;
  actorId: string;
  occurredAt: string;
  correlationId: string;
  transition: ProjectLifecycleTransition;
  currentStageId: string;
};

export type ProjectLifecycleTransitionErrorCode =
  | "tenant_mismatch"
  | "invalid_transition"
  | "invalid_project_state"
  | "project_not_active"
  | "current_stage_missing"
  | "stage_not_current"
  | "transition_not_allowed"
  | "stage_gate_blocked"
  | "transition_timestamp_invalid";

export type ProjectLifecycleTransitionError = {
  code: ProjectLifecycleTransitionErrorCode;
  message: string;
  details: Record<string, string | null>;
  blockers?: StageGateBlocker[];
};

export type ProjectLifecycleTransitionResult =
  | {
      ok: true;
      project: ManagedProject;
    }
  | {
      ok: false;
      project: ManagedProject;
      error: ProjectLifecycleTransitionError;
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

function stringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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

function cloneStageTaskTemplateSnapshotsForProject(
  templates: StageTaskTemplateSnapshot[] | undefined
): StageTaskTemplateSnapshot[] {
  const cloned = requireArray(
    templates,
    "managedProject.processTemplateSnapshot.stageTemplate.taskTemplates"
  ).map((rawTaskTemplate) => {
    const taskTemplate = requireObject(
      rawTaskTemplate,
      "managedProject.processTemplateSnapshot.stageTemplate.taskTemplate"
    );
    const defaultParticipantRoleKeys = requireSystemKeyArray(
      taskTemplate.defaultParticipantRoleKeys,
      "managedProject.processTemplateSnapshot.stageTemplate.taskTemplate.defaultParticipantRoleKeys",
      true
    );
    assertUniqueKeys(
      defaultParticipantRoleKeys,
      "managedProject process template snapshot stage task template default participant role keys must be unique"
    );

    return {
      id: requireNonEmptyString(taskTemplate.id, "managedProject.processTemplateSnapshot.stageTemplate.taskTemplate.id"),
      key: requireSystemKey(taskTemplate.key, "managedProject.processTemplateSnapshot.stageTemplate.taskTemplate.key"),
      label: requireNonEmptyString(
        taskTemplate.label,
        "managedProject.processTemplateSnapshot.stageTemplate.taskTemplate.label"
      ),
      defaultParticipantRoleKeys,
      required: requireBoolean(
        taskTemplate.required,
        "managedProject.processTemplateSnapshot.stageTemplate.taskTemplate.required"
      )
    };
  });

  assertUniqueFieldValues(
    cloned,
    (template) => template.id,
    "managedProject process template snapshot stage task template ids must be unique"
  );
  assertUniqueFieldValues(
    cloned,
    (template) => template.key,
    "managedProject process template snapshot stage task template keys must be unique"
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

function cloneProjectStage(stage: ProjectStage): ProjectStage {
  const cloned: ProjectStage = {
    id: requireNonEmptyString(stage.id, "managedProject.stage.id"),
    tenantId: requireNonEmptyString(stage.tenantId, "managedProject.stage.tenantId"),
    projectId: requireNonEmptyString(stage.projectId, "managedProject.stage.projectId"),
    templateId: requireNonEmptyString(stage.templateId, "managedProject.stage.templateId"),
    templateKey: requireSystemKey(stage.templateKey, "managedProject.stage.templateKey"),
    templateVersion: requirePositiveInteger(stage.templateVersion, "managedProject.stage.templateVersion"),
    label: requireNonEmptyString(stage.label, "managedProject.stage.label"),
    sortOrder: requirePositiveInteger(stage.sortOrder, "managedProject.stage.sortOrder"),
    status: requireProjectStageStatus(stage.status, "managedProject.stage.status")
  };

  if (stage.startedAt !== undefined) {
    cloned.startedAt = requireValidTimestamp(stage.startedAt, "managedProject.stage.startedAt");
  }
  if (stage.completedAt !== undefined) {
    cloned.completedAt = requireValidTimestamp(stage.completedAt, "managedProject.stage.completedAt");
  }

  return cloned;
}

function cloneProjectStageHistoryEntry(entry: ProjectStageHistoryEntry): ProjectStageHistoryEntry {
  return {
    id: requireNonEmptyString(entry.id, "managedProject.stageHistory.id"),
    tenantId: requireNonEmptyString(entry.tenantId, "managedProject.stageHistory.tenantId"),
    projectId: requireNonEmptyString(entry.projectId, "managedProject.stageHistory.projectId"),
    stageId: requireNonEmptyString(entry.stageId, "managedProject.stageHistory.stageId"),
    transition: requireProjectStageHistoryTransition(entry.transition),
    fromStatus:
      entry.fromStatus === null ? null : requireProjectStageStatus(entry.fromStatus, "managedProject.stageHistory.fromStatus"),
    toStatus: requireProjectStageStatus(entry.toStatus, "managedProject.stageHistory.toStatus"),
    actorId: requireNonEmptyString(entry.actorId, "managedProject.stageHistory.actorId"),
    occurredAt: requireValidTimestamp(entry.occurredAt, "managedProject.stageHistory.occurredAt"),
    correlationId: requireNonEmptyString(entry.correlationId, "managedProject.stageHistory.correlationId")
  };
}

function requireProjectArtifactStatus(value: ProjectArtifactStatus | undefined): ProjectArtifactStatus {
  if (value !== "submitted" && value !== "accepted" && value !== "rejected") {
    throw new ProjectCoreModelError("validation_error", "projectArtifact.status is invalid");
  }

  return value;
}

function requireApprovalRequestStatus(value: ApprovalRequestStatus | undefined): ApprovalRequestStatus {
  if (value !== "requested" && value !== "approved" && value !== "rejected") {
    throw new ProjectCoreModelError("validation_error", "approvalRequest.status is invalid");
  }

  return value;
}

function cloneProjectArtifact(artifact: ProjectArtifact): ProjectArtifact {
  const cloned: ProjectArtifact = {
    id: requireNonEmptyString(artifact.id, "projectArtifact.id"),
    tenantId: requireNonEmptyString(artifact.tenantId, "projectArtifact.tenantId"),
    projectId: requireNonEmptyString(artifact.projectId, "projectArtifact.projectId"),
    stageId: requireNonEmptyString(artifact.stageId, "projectArtifact.stageId"),
    templateId: requireNonEmptyString(artifact.templateId, "projectArtifact.templateId"),
    templateKey: requireSystemKey(artifact.templateKey, "projectArtifact.templateKey"),
    templateVersion: requirePositiveInteger(artifact.templateVersion, "projectArtifact.templateVersion"),
    label: requireNonEmptyString(artifact.label, "projectArtifact.label"),
    status: requireProjectArtifactStatus(artifact.status),
    actorId: requireNonEmptyString(artifact.actorId, "projectArtifact.actorId"),
    occurredAt: requireValidTimestamp(artifact.occurredAt, "projectArtifact.occurredAt")
  };

  if (artifact.evidenceRef !== undefined) {
    cloned.evidenceRef = requireNonEmptyString(artifact.evidenceRef, "projectArtifact.evidenceRef");
  }

  return cloned;
}

function cloneApprovalRequest(request: ApprovalRequest): ApprovalRequest {
  const cloned: ApprovalRequest = {
    id: requireNonEmptyString(request.id, "approvalRequest.id"),
    tenantId: requireNonEmptyString(request.tenantId, "approvalRequest.tenantId"),
    projectId: requireNonEmptyString(request.projectId, "approvalRequest.projectId"),
    stageId: requireNonEmptyString(request.stageId, "approvalRequest.stageId"),
    templateId: requireNonEmptyString(request.templateId, "approvalRequest.templateId"),
    templateKey: requireSystemKey(request.templateKey, "approvalRequest.templateKey"),
    templateVersion: requirePositiveInteger(request.templateVersion, "approvalRequest.templateVersion"),
    label: requireNonEmptyString(request.label, "approvalRequest.label"),
    approverRoleKey: requireSystemKey(request.approverRoleKey, "approvalRequest.approverRoleKey"),
    status: requireApprovalRequestStatus(request.status),
    requestedBy: requireNonEmptyString(request.requestedBy, "approvalRequest.requestedBy"),
    requestedAt: requireValidTimestamp(request.requestedAt, "approvalRequest.requestedAt")
  };

  if (request.decidedBy !== undefined) {
    cloned.decidedBy = requireNonEmptyString(request.decidedBy, "approvalRequest.decidedBy");
  }
  if (request.decidedAt !== undefined) {
    cloned.decidedAt = requireValidTimestamp(request.decidedAt, "approvalRequest.decidedAt");
  }

  return cloned;
}

function cloneTaskSourceTemplateSnapshot(sourceTemplate: TaskSourceTemplateSnapshot): TaskSourceTemplateSnapshot {
  const source = requireObject(sourceTemplate, "task.sourceTemplate");
  if (source.type !== "stage_task_template") {
    throw new ProjectCoreModelError("validation_error", "task.sourceTemplate.type is invalid");
  }
  const defaultParticipantRoleKeys = requireSystemKeyArray(
    source.defaultParticipantRoleKeys,
    "task.sourceTemplate.defaultParticipantRoleKeys",
    true
  );
  assertUniqueKeys(defaultParticipantRoleKeys, "task.sourceTemplate default participant role keys must be unique");

  return {
    type: "stage_task_template",
    processTemplateId: requireNonEmptyString(source.processTemplateId, "task.sourceTemplate.processTemplateId"),
    processTemplateVersion: requirePositiveInteger(
      source.processTemplateVersion,
      "task.sourceTemplate.processTemplateVersion"
    ),
    stageTemplateId: requireNonEmptyString(source.stageTemplateId, "task.sourceTemplate.stageTemplateId"),
    stageTemplateKey: requireSystemKey(source.stageTemplateKey, "task.sourceTemplate.stageTemplateKey"),
    stageTemplateVersion: requirePositiveInteger(source.stageTemplateVersion, "task.sourceTemplate.stageTemplateVersion"),
    taskTemplateId: requireNonEmptyString(source.taskTemplateId, "task.sourceTemplate.taskTemplateId"),
    taskTemplateKey: requireSystemKey(source.taskTemplateKey, "task.sourceTemplate.taskTemplateKey"),
    taskTemplateLabel: requireNonEmptyString(source.taskTemplateLabel, "task.sourceTemplate.taskTemplateLabel"),
    required: requireBoolean(source.required, "task.sourceTemplate.required"),
    defaultParticipantRoleKeys
  };
}

function cloneTask(task: Task): Task {
  const rawTask = requireObject(task, "task");
  const createdAt = requireValidTimestamp(rawTask.createdAt, "task.createdAt");
  const updatedAt = requireValidTimestamp(rawTask.updatedAt, "task.updatedAt");
  if (timestampIsBefore(updatedAt, createdAt)) {
    throw new ProjectCoreModelError("validation_error", "task.updatedAt cannot be earlier than task.createdAt");
  }

  return {
    id: requireNonEmptyString(rawTask.id, "task.id"),
    tenantId: requireNonEmptyString(rawTask.tenantId, "task.tenantId"),
    projectId: requireNonEmptyString(rawTask.projectId, "task.projectId"),
    stageId: requireNonEmptyString(rawTask.stageId, "task.stageId"),
    title: requireNonEmptyString(rawTask.title, "task.title"),
    status: requireTaskStatus(rawTask.status, "task.status"),
    dueDate: requireDateOnly(rawTask.dueDate, "task.dueDate"),
    plannedWorkHours: requireNonNegativeNumber(rawTask.plannedWorkHours, "task.plannedWorkHours"),
    sourceTemplate: cloneTaskSourceTemplateSnapshot(rawTask.sourceTemplate),
    createdBy: requireNonEmptyString(rawTask.createdBy, "task.createdBy"),
    createdAt,
    updatedAt,
    correlationId: requireNonEmptyString(rawTask.correlationId, "task.correlationId")
  };
}

function cloneTaskParticipant(participant: TaskParticipant): TaskParticipant {
  const rawParticipant = requireObject(participant, "taskParticipant");

  return {
    id: requireNonEmptyString(rawParticipant.id, "taskParticipant.id"),
    tenantId: requireNonEmptyString(rawParticipant.tenantId, "taskParticipant.tenantId"),
    projectId: requireNonEmptyString(rawParticipant.projectId, "taskParticipant.projectId"),
    stageId: requireNonEmptyString(rawParticipant.stageId, "taskParticipant.stageId"),
    taskId: requireNonEmptyString(rawParticipant.taskId, "taskParticipant.taskId"),
    userId: requireNonEmptyString(rawParticipant.userId, "taskParticipant.userId"),
    role: requireTaskParticipantRole(rawParticipant.role, "taskParticipant.role"),
    addedBy: requireNonEmptyString(rawParticipant.addedBy, "taskParticipant.addedBy"),
    addedAt: requireValidTimestamp(rawParticipant.addedAt, "taskParticipant.addedAt"),
    correlationId: requireNonEmptyString(rawParticipant.correlationId, "taskParticipant.correlationId")
  };
}

function cloneTaskComment(comment: TaskComment): TaskComment {
  const rawComment = requireObject(comment, "taskComment");

  return {
    id: requireNonEmptyString(rawComment.id, "taskComment.id"),
    tenantId: requireNonEmptyString(rawComment.tenantId, "taskComment.tenantId"),
    projectId: requireNonEmptyString(rawComment.projectId, "taskComment.projectId"),
    stageId: requireNonEmptyString(rawComment.stageId, "taskComment.stageId"),
    taskId: requireNonEmptyString(rawComment.taskId, "taskComment.taskId"),
    body: requireNonEmptyString(rawComment.body, "taskComment.body"),
    authorId: requireNonEmptyString(rawComment.authorId, "taskComment.authorId"),
    createdAt: requireValidTimestamp(rawComment.createdAt, "taskComment.createdAt"),
    correlationId: requireNonEmptyString(rawComment.correlationId, "taskComment.correlationId")
  };
}

function cloneTaskStatusHistoryEntry(entry: TaskStatusHistoryEntry): TaskStatusHistoryEntry {
  const rawEntry = requireObject(entry, "taskStatusHistory");

  return {
    id: requireNonEmptyString(rawEntry.id, "taskStatusHistory.id"),
    tenantId: requireNonEmptyString(rawEntry.tenantId, "taskStatusHistory.tenantId"),
    projectId: requireNonEmptyString(rawEntry.projectId, "taskStatusHistory.projectId"),
    stageId: requireNonEmptyString(rawEntry.stageId, "taskStatusHistory.stageId"),
    taskId: requireNonEmptyString(rawEntry.taskId, "taskStatusHistory.taskId"),
    fromStatus: requireTaskStatus(rawEntry.fromStatus, "taskStatusHistory.fromStatus"),
    toStatus: requireTaskStatus(rawEntry.toStatus, "taskStatusHistory.toStatus"),
    actorId: requireNonEmptyString(rawEntry.actorId, "taskStatusHistory.actorId"),
    changedAt: requireValidTimestamp(rawEntry.changedAt, "taskStatusHistory.changedAt"),
    correlationId: requireNonEmptyString(rawEntry.correlationId, "taskStatusHistory.correlationId")
  };
}

function cloneManagedProject(project: ManagedProject): ManagedProject {
  const managedProject = requireObject(project, "managedProject");
  const tenantId = requireNonEmptyString(managedProject.tenantId, "managedProject.tenantId");
  const id = requireNonEmptyString(managedProject.id, "managedProject.id");
  const createdAt = requireValidTimestamp(managedProject.createdAt, "managedProject.createdAt");
  const updatedAt = requireValidTimestamp(managedProject.updatedAt, "managedProject.updatedAt");
  if (timestampIsBefore(updatedAt, createdAt)) {
    throw new ProjectCoreModelError("validation_error", "managedProject.updatedAt cannot be earlier than managedProject.createdAt");
  }
  const stages = requireArray(managedProject.stages, "managedProject.stages").map(cloneProjectStage);
  const stageHistory = requireArray(managedProject.stageHistory, "managedProject.stageHistory").map(
    cloneProjectStageHistoryEntry
  );
  const artifacts = requireArray(managedProject.artifacts, "managedProject.artifacts").map(cloneProjectArtifact);
  const approvalRequests = requireArray(managedProject.approvalRequests, "managedProject.approvalRequests").map(
    cloneApprovalRequest
  );
  const tasks = requireArray(managedProject.tasks, "managedProject.tasks").map(cloneTask);
  const taskParticipants = requireArray(
    managedProject.taskParticipants,
    "managedProject.taskParticipants"
  ).map(cloneTaskParticipant);
  const taskComments = requireArray(managedProject.taskComments, "managedProject.taskComments").map(cloneTaskComment);
  const taskStatusHistory = requireArray(
    managedProject.taskStatusHistory,
    "managedProject.taskStatusHistory"
  ).map(cloneTaskStatusHistoryEntry);
  const processTemplateSnapshot = cloneProcessTemplateVersionSnapshotForProject(tenantId, managedProject.processTemplateSnapshot);

  for (const stage of stages) {
    assertTenantId(tenantId, stage.tenantId, `managedProject stage tenant mismatch: ${stage.id}`);
    if (stage.projectId !== id) {
      throw new ProjectCoreModelError("validation_error", `managedProject stage project mismatch: ${stage.id}`);
    }
    if (
      !processTemplateSnapshot.stageTemplates.some(
        (stageTemplate) =>
          stageTemplate.id === stage.templateId &&
          stageTemplate.key === stage.templateKey &&
          stageTemplate.version === stage.templateVersion
      )
    ) {
      throw new ProjectCoreModelError("validation_error", `managedProject stage template snapshot mismatch: ${stage.id}`);
    }
  }
  for (const entry of stageHistory) {
    assertTenantId(tenantId, entry.tenantId, `managedProject stage history tenant mismatch: ${entry.id}`);
    if (entry.projectId !== id) {
      throw new ProjectCoreModelError("validation_error", `managedProject stage history project mismatch: ${entry.id}`);
    }
  }
  for (const artifact of artifacts) {
    assertTenantId(tenantId, artifact.tenantId, `managedProject artifact tenant mismatch: ${artifact.id}`);
    if (artifact.projectId !== id) {
      throw new ProjectCoreModelError("validation_error", `managedProject artifact project mismatch: ${artifact.id}`);
    }
  }
  for (const request of approvalRequests) {
    assertTenantId(tenantId, request.tenantId, `managedProject approval request tenant mismatch: ${request.id}`);
    if (request.projectId !== id) {
      throw new ProjectCoreModelError(
        "validation_error",
        `managedProject approval request project mismatch: ${request.id}`
      );
    }
  }
  for (const task of tasks) {
    assertTenantId(tenantId, task.tenantId, `managedProject task tenant mismatch: ${task.id}`);
    if (task.projectId !== id) {
      throw new ProjectCoreModelError("validation_error", `managedProject task project mismatch: ${task.id}`);
    }
    if (!stages.some((stage) => stage.id === task.stageId)) {
      throw new ProjectCoreModelError("validation_error", `managedProject task stage mismatch: ${task.id}`);
    }
    if (timestampIsBefore(updatedAt, task.updatedAt)) {
      throw new ProjectCoreModelError(
        "validation_error",
        "managedProject task updatedAt cannot be later than project.updatedAt"
      );
    }
    const stage = stages.find((candidate) => candidate.id === task.stageId);
    const stageTemplate =
      stage === undefined
        ? undefined
        : processTemplateSnapshot.stageTemplates.find(
            (candidate) =>
              candidate.id === stage.templateId &&
              candidate.key === stage.templateKey &&
              candidate.version === stage.templateVersion
          );
    const taskTemplate = stageTemplate?.taskTemplates.find(
      (candidate) => candidate.id === task.sourceTemplate.taskTemplateId && candidate.key === task.sourceTemplate.taskTemplateKey
    );
    const sourceTemplateMatches =
      task.sourceTemplate.processTemplateId === processTemplateSnapshot.templateId &&
      task.sourceTemplate.processTemplateVersion === processTemplateSnapshot.version &&
      task.sourceTemplate.stageTemplateId === stageTemplate?.id &&
      task.sourceTemplate.stageTemplateKey === stageTemplate?.key &&
      task.sourceTemplate.stageTemplateVersion === stageTemplate?.version &&
      task.sourceTemplate.taskTemplateId === taskTemplate?.id &&
      task.sourceTemplate.taskTemplateKey === taskTemplate?.key &&
      task.sourceTemplate.taskTemplateLabel === taskTemplate?.label &&
      task.sourceTemplate.required === taskTemplate?.required &&
      stringArraysEqual(task.sourceTemplate.defaultParticipantRoleKeys, taskTemplate?.defaultParticipantRoleKeys ?? []);
    if (!sourceTemplateMatches) {
      throw new ProjectCoreModelError(
        "validation_error",
        `managedProject task source template mismatch: ${task.id}`
      );
    }
  }
  for (const participant of taskParticipants) {
    assertTenantId(tenantId, participant.tenantId, `managedProject task participant tenant mismatch: ${participant.id}`);
    if (participant.projectId !== id) {
      throw new ProjectCoreModelError(
        "validation_error",
        `managedProject task participant project mismatch: ${participant.id}`
      );
    }
    const task = tasks.find((candidate) => candidate.id === participant.taskId);
    if (task === undefined) {
      throw new ProjectCoreModelError("validation_error", "managedProject task participant task mismatch");
    }
    if (participant.stageId !== task.stageId) {
      throw new ProjectCoreModelError("validation_error", "managedProject task participant stage mismatch");
    }
    if (timestampIsBefore(updatedAt, participant.addedAt)) {
      throw new ProjectCoreModelError(
        "validation_error",
        "managedProject task participant addedAt cannot be later than project.updatedAt"
      );
    }
    if (timestampIsBefore(participant.addedAt, task.createdAt)) {
      throw new ProjectCoreModelError(
        "validation_error",
        "managedProject task participant addedAt cannot be earlier than task.createdAt"
      );
    }
  }
  let previousTaskCommentCreatedAt: string | undefined;
  for (const comment of taskComments) {
    assertTenantId(tenantId, comment.tenantId, `managedProject task comment tenant mismatch: ${comment.id}`);
    if (comment.projectId !== id) {
      throw new ProjectCoreModelError("validation_error", `managedProject task comment project mismatch: ${comment.id}`);
    }
    const task = tasks.find((candidate) => candidate.id === comment.taskId);
    if (task === undefined) {
      throw new ProjectCoreModelError("validation_error", "managedProject task comment task mismatch");
    }
    if (comment.stageId !== task.stageId) {
      throw new ProjectCoreModelError("validation_error", "managedProject task comment stage mismatch");
    }
    if (timestampIsBefore(comment.createdAt, task.createdAt)) {
      throw new ProjectCoreModelError(
        "validation_error",
        "managedProject task comment createdAt cannot be earlier than task.createdAt"
      );
    }
    if (timestampIsBefore(updatedAt, comment.createdAt)) {
      throw new ProjectCoreModelError(
        "validation_error",
        "managedProject task comment createdAt cannot be later than project.updatedAt"
      );
    }
    if (previousTaskCommentCreatedAt !== undefined && timestampIsBefore(comment.createdAt, previousTaskCommentCreatedAt)) {
      throw new ProjectCoreModelError("validation_error", "managedProject task comments are not append-only");
    }
    previousTaskCommentCreatedAt = comment.createdAt;
  }
  const taskStatusHistoriesByTaskId = new Map<string, TaskStatusHistoryEntry[]>();
  let previousTaskStatusHistoryChangedAt: string | undefined;
  for (const entry of taskStatusHistory) {
    assertTenantId(tenantId, entry.tenantId, `managedProject task status history tenant mismatch: ${entry.id}`);
    if (entry.projectId !== id) {
      throw new ProjectCoreModelError(
        "validation_error",
        `managedProject task status history project mismatch: ${entry.id}`
      );
    }
    const task = tasks.find((candidate) => candidate.id === entry.taskId);
    if (task === undefined) {
      throw new ProjectCoreModelError("validation_error", "managedProject task status history task mismatch");
    }
    if (entry.stageId !== task.stageId) {
      throw new ProjectCoreModelError("validation_error", "managedProject task status history stage mismatch");
    }
    if (entry.fromStatus === entry.toStatus) {
      throw new ProjectCoreModelError("validation_error", "managedProject task status history must change status");
    }
    if (timestampIsBefore(entry.changedAt, task.createdAt)) {
      throw new ProjectCoreModelError(
        "validation_error",
        "managedProject task status history changedAt cannot be earlier than task.createdAt"
      );
    }
    if (timestampIsBefore(task.updatedAt, entry.changedAt)) {
      throw new ProjectCoreModelError(
        "validation_error",
        "managedProject task status history changedAt cannot be later than task.updatedAt"
      );
    }
    if (
      previousTaskStatusHistoryChangedAt !== undefined &&
      timestampIsBefore(entry.changedAt, previousTaskStatusHistoryChangedAt)
    ) {
      throw new ProjectCoreModelError("validation_error", "managedProject task status history is not append-only");
    }
    previousTaskStatusHistoryChangedAt = entry.changedAt;
    const entries = taskStatusHistoriesByTaskId.get(entry.taskId) ?? [];
    entries.push(entry);
    taskStatusHistoriesByTaskId.set(entry.taskId, entries);
  }
  for (const [taskId, entries] of taskStatusHistoriesByTaskId) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (task === undefined) {
      throw new ProjectCoreModelError("validation_error", "managedProject task status history task mismatch");
    }
    let expectedFromStatus = entries[0]?.fromStatus;
    let previousChangedAt = entries[0]?.changedAt;
    for (const entry of entries) {
      if (expectedFromStatus !== undefined && entry.fromStatus !== expectedFromStatus) {
        throw new ProjectCoreModelError("validation_error", "managedProject task status history chain mismatch");
      }
      if (previousChangedAt !== undefined && timestampIsBefore(entry.changedAt, previousChangedAt)) {
        throw new ProjectCoreModelError("validation_error", "managedProject task status history is not append-only");
      }
      expectedFromStatus = entry.toStatus;
      previousChangedAt = entry.changedAt;
    }
    const lastEntry = entries[entries.length - 1];
    if (lastEntry !== undefined && lastEntry.toStatus !== task.status) {
      throw new ProjectCoreModelError("validation_error", "managedProject task status history final status mismatch");
    }
  }

  assertUniqueFieldValues(stages, (stage) => stage.id, "managedProject stage ids must be unique");
  assertUniqueFieldValues(stages, (stage) => stage.sortOrder, "managedProject stage sort orders must be unique");
  assertUniqueFieldValues(tasks, (task) => task.id, "managedProject task ids must be unique");
  assertUniqueFieldValues(
    taskParticipants,
    (participant) => participant.id,
    "managedProject task participant ids must be unique"
  );
  assertUniqueFieldValues(
    taskParticipants,
    (participant) => taskParticipantAssignmentKey(participant),
    "managedProject task participant assignments must be unique per task, role, and user"
  );
  assertUniqueFieldValues(taskComments, (comment) => comment.id, "managedProject task comment ids must be unique");
  assertUniqueFieldValues(
    taskStatusHistory,
    (entry) => entry.id,
    "managedProject task status history ids must be unique"
  );
  assertUniqueFieldValues(artifacts, (artifact) => artifact.id, "managedProject artifact ids must be unique");
  assertUniqueFieldValues(approvalRequests, (request) => request.id, "managedProject approval request ids must be unique");

  return {
    id,
    tenantId,
    title: requireNonEmptyString(managedProject.title, "managedProject.title"),
    lifecycleStatus: requireManagedProjectLifecycleStatus(
      managedProject.lifecycleStatus,
      "managedProject.lifecycleStatus"
    ),
    currentStageId:
      managedProject.currentStageId === null
        ? null
        : requireNonEmptyString(managedProject.currentStageId, "managedProject.currentStageId"),
    sourceDraftId: requireNonEmptyString(managedProject.sourceDraftId, "managedProject.sourceDraftId"),
    sourceOpportunity: cloneProjectDraftSourceOpportunity(tenantId, managedProject.sourceOpportunity),
    processTemplateSnapshot,
    stages: [...stages].sort((left, right) => left.sortOrder - right.sortOrder),
    stageHistory,
    tasks,
    taskParticipants,
    taskComments,
    taskStatusHistory,
    artifacts,
    approvalRequests,
    createdBy: requireNonEmptyString(managedProject.createdBy, "managedProject.createdBy"),
    createdAt,
    updatedAt,
    correlationId: requireNonEmptyString(managedProject.correlationId, "managedProject.correlationId")
  };
}

function validateProjectLifecycleState(project: ManagedProject): ProjectLifecycleTransitionError | null {
  const activeStageIds = project.stages.filter((stage) => stage.status === "active").map((stage) => stage.id);
  const currentStageIndex =
    project.currentStageId === null ? -1 : project.stages.findIndex((stage) => stage.id === project.currentStageId);

  if (project.lifecycleStatus === "active") {
    const currentStageIsActive =
      project.currentStageId !== null && activeStageIds.length === 1 && activeStageIds[0] === project.currentStageId;
    if (!currentStageIsActive) {
      return createTransitionError("invalid_project_state", "Project lifecycle state is internally inconsistent", {
        lifecycleStatus: project.lifecycleStatus,
        currentStageId: project.currentStageId,
        activeStageIds: activeStageIds.join(",")
      });
    }
    const blockingStageIds =
      currentStageIndex < 0
        ? []
        : project.stages
            .slice(0, currentStageIndex)
            .filter((stage) => stage.status !== "completed")
            .map((stage) => stage.id);
    if (blockingStageIds.length > 0) {
      return createTransitionError("invalid_project_state", "Project lifecycle state is internally inconsistent", {
        lifecycleStatus: project.lifecycleStatus,
        currentStageId: project.currentStageId,
        activeStageIds: activeStageIds.join(","),
        blockingStageIds: blockingStageIds.join(",")
      });
    }

    return null;
  }

  if (project.currentStageId !== null || activeStageIds.length > 0) {
    return createTransitionError("invalid_project_state", "Project lifecycle terminal state is internally inconsistent", {
      lifecycleStatus: project.lifecycleStatus,
      currentStageId: project.currentStageId,
      activeStageIds: activeStageIds.join(",")
    });
  }

  return null;
}

function cloneProcessTemplateVersionSnapshotForProject(
  tenantId: TenantId,
  snapshot: ProcessTemplateVersionSnapshot
): ProcessTemplateVersionSnapshot {
  const rawSnapshot = requireObject(snapshot, "managedProject.processTemplateSnapshot");
  assertTenantId(tenantId, rawSnapshot.tenantId, "managedProject process template snapshot tenant mismatch");
  const stageTemplates = requireArray(rawSnapshot.stageTemplates, "managedProject.processTemplateSnapshot.stageTemplates").map(
    (stage) => ({
      id: requireNonEmptyString(stage.id, "managedProject.processTemplateSnapshot.stageTemplate.id"),
      key: requireSystemKey(stage.key, "managedProject.processTemplateSnapshot.stageTemplate.key"),
      label: requireNonEmptyString(stage.label, "managedProject.processTemplateSnapshot.stageTemplate.label"),
      sortOrder: requirePositiveInteger(
        stage.sortOrder,
        "managedProject.processTemplateSnapshot.stageTemplate.sortOrder"
      ),
      active: requireBoolean(stage.active, "managedProject.processTemplateSnapshot.stageTemplate.active"),
      version: requirePositiveInteger(stage.version, "managedProject.processTemplateSnapshot.stageTemplate.version"),
      updatedAt: requireValidTimestamp(stage.updatedAt, "managedProject.processTemplateSnapshot.stageTemplate.updatedAt"),
      requiredArtifactTemplates: requireArray(
        stage.requiredArtifactTemplates,
        "managedProject.processTemplateSnapshot.stageTemplate.requiredArtifactTemplates"
      ).map((rawArtifactTemplate) => {
        const artifactTemplate = requireObject(
          rawArtifactTemplate,
          "managedProject.processTemplateSnapshot.stageTemplate.requiredArtifactTemplate"
        );

        return {
          id: requireNonEmptyString(
            artifactTemplate.id,
            "managedProject.processTemplateSnapshot.stageTemplate.requiredArtifactTemplate.id"
          ),
          key: requireSystemKey(
            artifactTemplate.key,
            "managedProject.processTemplateSnapshot.stageTemplate.requiredArtifactTemplate.key"
          ),
          label: requireNonEmptyString(
            artifactTemplate.label,
            "managedProject.processTemplateSnapshot.stageTemplate.requiredArtifactTemplate.label"
          ),
          required: requireBoolean(
            artifactTemplate.required,
            "managedProject.processTemplateSnapshot.stageTemplate.requiredArtifactTemplate.required"
          )
        };
      }),
      approvalTemplates: requireArray(
        stage.approvalTemplates,
        "managedProject.processTemplateSnapshot.stageTemplate.approvalTemplates"
      ).map((rawApprovalTemplate) => {
        const approvalTemplate = requireObject(
          rawApprovalTemplate,
          "managedProject.processTemplateSnapshot.stageTemplate.approvalTemplate"
        );

        return {
          id: requireNonEmptyString(
            approvalTemplate.id,
            "managedProject.processTemplateSnapshot.stageTemplate.approvalTemplate.id"
          ),
          key: requireSystemKey(
            approvalTemplate.key,
            "managedProject.processTemplateSnapshot.stageTemplate.approvalTemplate.key"
          ),
          label: requireNonEmptyString(
            approvalTemplate.label,
            "managedProject.processTemplateSnapshot.stageTemplate.approvalTemplate.label"
          ),
          approverRoleKey: requireSystemKey(
            approvalTemplate.approverRoleKey,
            "managedProject.processTemplateSnapshot.stageTemplate.approvalTemplate.approverRoleKey"
          ),
          required: requireBoolean(
            approvalTemplate.required,
            "managedProject.processTemplateSnapshot.stageTemplate.approvalTemplate.required"
          )
        };
      }),
      taskTemplates: cloneStageTaskTemplateSnapshotsForProject(stage.taskTemplates)
    })
  );
  assertUniqueFieldValues(
    stageTemplates,
    (stage) => stage.id,
    "managedProject process template snapshot stage ids must be unique"
  );
  assertUniqueFieldValues(
    stageTemplates,
    (stage) => stage.key,
    "managedProject process template snapshot stage keys must be unique"
  );

  return {
    tenantId,
    templateId: requireNonEmptyString(rawSnapshot.templateId, "managedProject.processTemplateSnapshot.templateId"),
    key: requireSystemKey(rawSnapshot.key, "managedProject.processTemplateSnapshot.key"),
    label: requireNonEmptyString(rawSnapshot.label, "managedProject.processTemplateSnapshot.label"),
    version: requirePositiveInteger(rawSnapshot.version, "managedProject.processTemplateSnapshot.version"),
    active: requireBoolean(rawSnapshot.active, "managedProject.processTemplateSnapshot.active"),
    updatedAt: requireValidTimestamp(rawSnapshot.updatedAt, "managedProject.processTemplateSnapshot.updatedAt"),
    stageTemplates
  };
}

function requireManagedProjectLifecycleStatus(
  value: ManagedProjectLifecycleStatus | undefined,
  fieldName: string
): ManagedProjectLifecycleStatus {
  if (value !== "active" && value !== "completed" && value !== "cancelled") {
    throw new ProjectCoreModelError("validation_error", `${fieldName} is invalid`);
  }

  return value;
}

function requireProjectStageStatus(value: ProjectStageStatus | undefined, fieldName: string): ProjectStageStatus {
  if (value !== "pending" && value !== "active" && value !== "completed" && value !== "cancelled") {
    throw new ProjectCoreModelError("validation_error", `${fieldName} is invalid`);
  }

  return value;
}

function requireTaskStatus(value: TaskStatus | undefined, fieldName: string): TaskStatus {
  if (
    value !== "todo" &&
    value !== "in_progress" &&
    value !== "blocked" &&
    value !== "done" &&
    value !== "cancelled"
  ) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} is invalid`);
  }

  return value;
}

function requireTaskParticipantRole(
  value: TaskParticipantRole | undefined,
  fieldName: string
): TaskParticipantRole {
  if (
    value !== "executor" &&
    value !== "co_executor" &&
    value !== "requester" &&
    value !== "controller" &&
    value !== "approver" &&
    value !== "observer"
  ) {
    throw new ProjectCoreModelError("validation_error", `${fieldName} is invalid`);
  }

  return value;
}

function parseProjectLifecycleTransition(value: string | undefined): ProjectLifecycleTransition | null {
  if (value === "advance_stage" || value === "complete_project" || value === "cancel_project") {
    return value;
  }

  return null;
}

function requireProjectStageHistoryTransition(
  value: ProjectStageHistoryEntry["transition"] | undefined
): ProjectStageHistoryEntry["transition"] {
  if (
    value !== "create_from_draft" &&
    value !== "advance_stage" &&
    value !== "complete_project" &&
    value !== "cancel_project"
  ) {
    throw new ProjectCoreModelError("validation_error", "managedProject.stageHistory.transition is invalid");
  }

  return value;
}

function createTransitionError(
  code: ProjectLifecycleTransitionErrorCode,
  message: string,
  details: Record<string, string | null>,
  blockers?: StageGateBlocker[]
): ProjectLifecycleTransitionError {
  return blockers === undefined ? { code, message, details } : { code, message, details, blockers };
}

function findCurrentStageIndex(project: ManagedProject): number {
  if (project.currentStageId === null) {
    return -1;
  }

  return project.stages.findIndex((stage) => stage.id === project.currentStageId);
}

function createStageHistoryEntry(input: {
  project: ManagedProject;
  stageId: string;
  transition: ProjectStageHistoryEntry["transition"];
  fromStatus: ProjectStageStatus | null;
  toStatus: ProjectStageStatus;
  actorId: string;
  occurredAt: string;
  correlationId: string;
}): ProjectStageHistoryEntry {
  const localStageId = input.stageId.startsWith(`${input.project.id}:`)
    ? input.stageId.slice(input.project.id.length + 1)
    : input.stageId;
  const historyKey =
    input.transition === "create_from_draft"
      ? `created:${localStageId}`
      : `${input.correlationId}:${input.stageId}:${input.toStatus}`;

  return {
    id: `${input.project.id}:history:${historyKey}`,
    tenantId: input.project.tenantId,
    projectId: input.project.id,
    stageId: input.stageId,
    transition: input.transition,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId
  };
}

function timestampIsBefore(left: string, right: string): boolean {
  return Date.parse(left) < Date.parse(right);
}

function findProjectStage(project: ManagedProject, stageId: string): ProjectStage {
  const stage = project.stages.find((candidate) => candidate.id === stageId);
  if (stage === undefined) {
    throw new ProjectCoreModelError("validation_error", "projectStage not found");
  }

  return stage;
}

function findTask(project: ManagedProject, taskId: string): Task {
  const task = project.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    throw new ProjectCoreModelError("validation_error", "task not found");
  }

  return task;
}

function taskParticipantAssignmentKey(participant: TaskParticipant): string {
  return `${participant.taskId}:${participant.role}:${participant.userId}`;
}

function findStageTemplateSnapshot(project: ManagedProject, stage: ProjectStage): StageTemplateSnapshot {
  const stageTemplate = project.processTemplateSnapshot.stageTemplates.find(
    (candidate) =>
      candidate.id === stage.templateId &&
      candidate.key === stage.templateKey &&
      candidate.version === stage.templateVersion
  );
  if (stageTemplate === undefined) {
    throw new ProjectCoreModelError("validation_error", "projectStage template snapshot not found");
  }

  return stageTemplate;
}

function findArtifactTemplateSnapshot(
  project: ManagedProject,
  stageId: string,
  templateId: string,
  templateKey: string
): ArtifactTemplateSnapshot {
  const stage = findProjectStage(project, stageId);
  const stageTemplate = findStageTemplateSnapshot(project, stage);
  const artifactTemplate = stageTemplate.requiredArtifactTemplates.find(
    (candidate) => candidate.id === templateId && candidate.key === templateKey
  );
  if (artifactTemplate === undefined) {
    throw new ProjectCoreModelError("validation_error", "projectArtifact template is not valid for stage");
  }

  return artifactTemplate;
}

function findApprovalTemplateSnapshot(
  project: ManagedProject,
  stageId: string,
  templateId: string,
  templateKey: string
): ApprovalTemplateSnapshot {
  const stage = findProjectStage(project, stageId);
  const stageTemplate = findStageTemplateSnapshot(project, stage);
  const approvalTemplate = stageTemplate.approvalTemplates.find(
    (candidate) => candidate.id === templateId && candidate.key === templateKey
  );
  if (approvalTemplate === undefined) {
    throw new ProjectCoreModelError("validation_error", "approvalRequest template is not valid for stage");
  }

  return approvalTemplate;
}

function findStageTaskTemplateSnapshot(
  project: ManagedProject,
  stageId: string,
  templateId: string,
  templateKey: string
): StageTaskTemplateSnapshot {
  const stage = findProjectStage(project, stageId);
  const stageTemplate = findStageTemplateSnapshot(project, stage);
  const taskTemplate = stageTemplate.taskTemplates.find(
    (candidate) => candidate.id === templateId && candidate.key === templateKey
  );
  if (taskTemplate === undefined) {
    throw new ProjectCoreModelError("validation_error", "task template is not valid for stage");
  }

  return taskTemplate;
}

function createStageGateBlocker(input: {
  code: StageGateBlockerCode;
  stageId: string;
  templateId: string;
  templateKey: string;
  templateLabel: string;
}): StageGateBlocker {
  const prefix = input.code === "missing_required_artifact" ? "Требуется артефакт" : "Требуется согласование";

  return {
    code: input.code,
    message: `${prefix}: ${input.templateLabel}`,
    stageId: input.stageId,
    templateId: input.templateId,
    templateKey: input.templateKey,
    templateLabel: input.templateLabel
  };
}

function assertStageCanReceiveGateEvidence(project: ManagedProject, stage: ProjectStage, occurredAt: string, fieldName: string): void {
  if (project.lifecycleStatus !== "active") {
    throw new ProjectCoreModelError("validation_error", `${fieldName} project must be active`);
  }
  if (stage.status !== "active") {
    throw new ProjectCoreModelError("validation_error", `${fieldName} stage must be active`);
  }
  if (
    timestampIsBefore(occurredAt, project.updatedAt) ||
    (stage.startedAt !== undefined && timestampIsBefore(occurredAt, stage.startedAt))
  ) {
    throw new ProjectCoreModelError(
      "validation_error",
      `${fieldName} timestamp cannot be earlier than project or stage state`
    );
  }
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

export function createManagedProjectFromDraft(input: {
  id: string;
  draft: ProjectDraft;
  processTemplate: ProcessTemplate;
  createdBy: string;
  createdAt: string;
  correlationId: string;
}): ManagedProject {
  const id = requireNonEmptyString(input.id, "managedProject.id");
  const draft = createProjectDraftFromOpportunity(input.draft);
  const processTemplate = createProcessTemplate(input.processTemplate);
  const createdAt = requireValidTimestamp(input.createdAt, "managedProject.createdAt");

  if (processTemplate.tenantId !== draft.tenantId) {
    throw new ProjectCoreModelError("validation_error", "managedProject process template tenant mismatch");
  }
  if (!processTemplate.active) {
    throw new ProjectCoreModelError("validation_error", "managedProject process template must be active");
  }
  if (
    processTemplate.id !== draft.processTemplate.templateId ||
    processTemplate.key !== draft.processTemplate.key ||
    processTemplate.version !== draft.processTemplate.version
  ) {
    throw new ProjectCoreModelError("validation_error", "managedProject process template does not match draft snapshot");
  }

  const processTemplateSnapshot = createProcessTemplateVersionSnapshot(processTemplate);
  const activeStageTemplates = processTemplateSnapshot.stageTemplates.filter((stageTemplate) => stageTemplate.active);
  if (activeStageTemplates.length === 0) {
    throw new ProjectCoreModelError("validation_error", "managedProject process template must have at least one active stage");
  }

  const stages = activeStageTemplates.map((stageTemplate, index): ProjectStage => {
    const stageId = `${id}:${stageTemplate.id}`;

    return {
      id: stageId,
      tenantId: draft.tenantId,
      projectId: id,
      templateId: stageTemplate.id,
      templateKey: stageTemplate.key,
      templateVersion: stageTemplate.version,
      label: stageTemplate.label,
      sortOrder: stageTemplate.sortOrder,
      status: index === 0 ? "active" : "pending",
      ...(index === 0 ? { startedAt: createdAt } : {})
    };
  });
  const currentStage = stages[0];
  if (currentStage === undefined) {
    throw new ProjectCoreModelError("validation_error", "managedProject process template must have at least one active stage");
  }
  const createdBy = requireNonEmptyString(input.createdBy, "managedProject.createdBy");
  const correlationId = requireNonEmptyString(input.correlationId, "managedProject.correlationId");
  const projectBase: ManagedProject = {
    id,
    tenantId: draft.tenantId,
    title: draft.title,
    lifecycleStatus: "active",
    currentStageId: currentStage.id,
    sourceDraftId: draft.id,
    sourceOpportunity: draft.sourceOpportunity,
    processTemplateSnapshot,
    stages,
    stageHistory: [],
    tasks: [],
    taskParticipants: [],
    taskComments: [],
    taskStatusHistory: [],
    artifacts: [],
    approvalRequests: [],
    createdBy,
    createdAt,
    updatedAt: createdAt,
    correlationId
  };

  return {
    ...projectBase,
    stageHistory: [
      createStageHistoryEntry({
        project: projectBase,
        stageId: currentStage.id,
        transition: "create_from_draft",
        fromStatus: null,
        toStatus: "active",
        actorId: createdBy,
        occurredAt: createdAt,
        correlationId
      })
    ]
  };
}

export function getAllowedProjectLifecycleTransitions(project: ManagedProject): ProjectLifecycleTransition[] {
  const managedProject = cloneManagedProject(project);
  if (validateProjectLifecycleState(managedProject) !== null) {
    return [];
  }
  if (managedProject.lifecycleStatus !== "active") {
    return [];
  }

  const currentStageIndex = findCurrentStageIndex(managedProject);
  if (currentStageIndex < 0) {
    return [];
  }

  const hasNextStage = managedProject.stages[currentStageIndex + 1] !== undefined;
  return hasNextStage ? ["advance_stage", "cancel_project"] : ["complete_project", "cancel_project"];
}

export function evaluateStageGate(project: ManagedProject, stageId: string): StageGateEvaluation {
  const managedProject = cloneManagedProject(project);
  const stage = findProjectStage(managedProject, requireNonEmptyString(stageId, "stageGate.stageId"));
  const stageTemplate = findStageTemplateSnapshot(managedProject, stage);
  const blockers: StageGateBlocker[] = [];

  for (const artifactTemplate of stageTemplate.requiredArtifactTemplates.filter((template) => template.required)) {
    const satisfied = managedProject.artifacts.some(
      (artifact) =>
        artifact.stageId === stage.id &&
        artifact.templateId === artifactTemplate.id &&
        artifact.templateKey === artifactTemplate.key &&
        artifact.templateVersion === stage.templateVersion &&
        artifact.status === "accepted"
    );
    if (!satisfied) {
      blockers.push(
        createStageGateBlocker({
          code: "missing_required_artifact",
          stageId: stage.id,
          templateId: artifactTemplate.id,
          templateKey: artifactTemplate.key,
          templateLabel: artifactTemplate.label
        })
      );
    }
  }

  for (const approvalTemplate of stageTemplate.approvalTemplates.filter((template) => template.required)) {
    const satisfied = managedProject.approvalRequests.some(
      (request) =>
        request.stageId === stage.id &&
        request.templateId === approvalTemplate.id &&
        request.templateKey === approvalTemplate.key &&
        request.templateVersion === stage.templateVersion &&
        request.approverRoleKey === approvalTemplate.approverRoleKey &&
        request.status === "approved"
    );
    if (!satisfied) {
      blockers.push(
        createStageGateBlocker({
          code: "required_approval_not_approved",
          stageId: stage.id,
          templateId: approvalTemplate.id,
          templateKey: approvalTemplate.key,
          templateLabel: approvalTemplate.label
        })
      );
    }
  }

  return {
    ok: blockers.length === 0,
    stageId: stage.id,
    blockers
  };
}

export function listProjectTasks(project: ManagedProject): Task[] {
  return cloneManagedProject(project).tasks.map(cloneTask);
}

export function listTaskParticipants(
  project: ManagedProject,
  input: {
    tenantId?: TenantId;
    taskId?: string;
    userId?: TenantUserId;
    roles?: TaskParticipantRole[];
  } = {}
): TaskParticipant[] {
  const managedProject = cloneManagedProject(project);
  if (input.tenantId !== undefined) {
    const tenantId = requireNonEmptyString(input.tenantId, "taskParticipant.tenantId");
    assertTenantId(tenantId, managedProject.tenantId, "taskParticipant tenant mismatch");
  }
  const taskId = input.taskId === undefined ? undefined : requireNonEmptyString(input.taskId, "taskParticipant.taskId");
  const userId = input.userId === undefined ? undefined : requireNonEmptyString(input.userId, "taskParticipant.userId");
  const roles =
    input.roles === undefined
      ? undefined
      : input.roles.map((role) => requireTaskParticipantRole(role, "taskParticipant.role"));

  return managedProject.taskParticipants
    .filter((participant) => taskId === undefined || participant.taskId === taskId)
    .filter((participant) => userId === undefined || participant.userId === userId)
    .filter((participant) => roles === undefined || roles.includes(participant.role))
    .map(cloneTaskParticipant);
}

export function listTasksByParticipant(
  project: ManagedProject,
  input: {
    tenantId: TenantId;
    userId: TenantUserId;
    roles?: TaskParticipantRole[];
  }
): Task[] {
  const managedProject = cloneManagedProject(project);
  const tenantId = requireNonEmptyString(input.tenantId, "taskParticipant.tenantId");
  assertTenantId(tenantId, managedProject.tenantId, "taskParticipant tenant mismatch");
  const participantTaskIds = new Set(
    listTaskParticipants(managedProject, {
      tenantId,
      userId: requireNonEmptyString(input.userId, "taskParticipant.userId"),
      ...(input.roles !== undefined ? { roles: input.roles } : {})
    }).map((participant) => participant.taskId)
  );

  return managedProject.tasks.filter((task) => participantTaskIds.has(task.id)).map(cloneTask);
}

export function listTaskComments(
  project: ManagedProject,
  input: {
    tenantId?: TenantId;
    taskId?: string;
    authorId?: TenantUserId;
  } = {}
): TaskComment[] {
  const managedProject = cloneManagedProject(project);
  if (input.tenantId !== undefined) {
    const tenantId = requireNonEmptyString(input.tenantId, "taskComment.tenantId");
    assertTenantId(tenantId, managedProject.tenantId, "taskComment tenant mismatch");
  }
  const taskId = input.taskId === undefined ? undefined : requireNonEmptyString(input.taskId, "taskComment.taskId");
  const authorId =
    input.authorId === undefined ? undefined : requireNonEmptyString(input.authorId, "taskComment.authorId");

  return managedProject.taskComments
    .filter((comment) => taskId === undefined || comment.taskId === taskId)
    .filter((comment) => authorId === undefined || comment.authorId === authorId)
    .map(cloneTaskComment);
}

export function listTaskStatusHistory(
  project: ManagedProject,
  input: {
    tenantId?: TenantId;
    taskId?: string;
    actorId?: TenantUserId;
  } = {}
): TaskStatusHistoryEntry[] {
  const managedProject = cloneManagedProject(project);
  if (input.tenantId !== undefined) {
    const tenantId = requireNonEmptyString(input.tenantId, "taskStatusHistory.tenantId");
    assertTenantId(tenantId, managedProject.tenantId, "taskStatusHistory tenant mismatch");
  }
  const taskId =
    input.taskId === undefined ? undefined : requireNonEmptyString(input.taskId, "taskStatusHistory.taskId");
  const actorId =
    input.actorId === undefined ? undefined : requireNonEmptyString(input.actorId, "taskStatusHistory.actorId");

  return managedProject.taskStatusHistory
    .filter((entry) => taskId === undefined || entry.taskId === taskId)
    .filter((entry) => actorId === undefined || entry.actorId === actorId)
    .map(cloneTaskStatusHistoryEntry);
}

export function createTaskFromStageTaskTemplate(
  project: ManagedProject,
  input: {
    id: string;
    tenantId: TenantId;
    stageId: string;
    taskTemplateId: string;
    taskTemplateKey: string;
    title?: string;
    status?: TaskStatus;
    dueDate: string;
    plannedWorkHours: number;
    actorId: string;
    createdAt: string;
    correlationId: string;
  }
): ManagedProject {
  const managedProject = cloneManagedProject(project);
  const tenantId = requireNonEmptyString(input.tenantId, "task.tenantId");
  assertTenantId(tenantId, managedProject.tenantId, "task tenant mismatch");
  if (managedProject.lifecycleStatus !== "active") {
    throw new ProjectCoreModelError("validation_error", "task project must be active");
  }

  const stageId = requireNonEmptyString(input.stageId, "task.stageId");
  const stage = findProjectStage(managedProject, stageId);
  if (stage.status === "completed" || stage.status === "cancelled") {
    throw new ProjectCoreModelError("validation_error", "task stage must be open");
  }
  const taskTemplateId = requireNonEmptyString(input.taskTemplateId, "task.taskTemplateId");
  const taskTemplateKey = requireSystemKey(input.taskTemplateKey, "task.taskTemplateKey");
  const stageTemplate = findStageTemplateSnapshot(managedProject, stage);
  const taskTemplate = findStageTaskTemplateSnapshot(managedProject, stageId, taskTemplateId, taskTemplateKey);
  const createdAt = requireValidTimestamp(input.createdAt, "task.createdAt");
  if (
    timestampIsBefore(createdAt, managedProject.updatedAt) ||
    (stage.startedAt !== undefined && timestampIsBefore(createdAt, stage.startedAt))
  ) {
    throw new ProjectCoreModelError("validation_error", "task createdAt cannot be earlier than current project or stage state");
  }

  const task: Task = {
    id: requireNonEmptyString(input.id, "task.id"),
    tenantId,
    projectId: managedProject.id,
    stageId: stage.id,
    title:
      input.title !== undefined
        ? requireNonEmptyString(input.title, "task.title")
        : taskTemplate.label,
    status: requireTaskStatus(input.status ?? "todo", "task.status"),
    dueDate: requireDateOnly(input.dueDate, "task.dueDate"),
    plannedWorkHours: requireNonNegativeNumber(input.plannedWorkHours, "task.plannedWorkHours"),
    sourceTemplate: {
      type: "stage_task_template",
      processTemplateId: managedProject.processTemplateSnapshot.templateId,
      processTemplateVersion: managedProject.processTemplateSnapshot.version,
      stageTemplateId: stageTemplate.id,
      stageTemplateKey: stageTemplate.key,
      stageTemplateVersion: stageTemplate.version,
      taskTemplateId: taskTemplate.id,
      taskTemplateKey: taskTemplate.key,
      taskTemplateLabel: taskTemplate.label,
      required: taskTemplate.required,
      defaultParticipantRoleKeys: [...taskTemplate.defaultParticipantRoleKeys]
    },
    createdBy: requireNonEmptyString(input.actorId, "task.actorId"),
    createdAt,
    updatedAt: createdAt,
    correlationId: requireNonEmptyString(input.correlationId, "task.correlationId")
  };

  if (managedProject.tasks.some((existing) => existing.id === task.id)) {
    throw new ProjectCoreModelError("conflict", "task id must be unique");
  }

  return {
    ...managedProject,
    updatedAt: createdAt,
    tasks: [...managedProject.tasks, task]
  };
}

export function updateTaskPlanningFields(
  project: ManagedProject,
  input: {
    tenantId: TenantId;
    taskId: string;
    dueDate?: string;
    plannedWorkHours?: number;
    actorId: string;
    updatedAt: string;
    correlationId: string;
  }
): ManagedProject {
  const managedProject = cloneManagedProject(project);
  const tenantId = requireNonEmptyString(input.tenantId, "task.tenantId");
  assertTenantId(tenantId, managedProject.tenantId, "task tenant mismatch");
  if (managedProject.lifecycleStatus !== "active") {
    throw new ProjectCoreModelError("validation_error", "task project must be active");
  }

  const taskId = requireNonEmptyString(input.taskId, "task.id");
  const task = findTask(managedProject, taskId);
  const stage = findProjectStage(managedProject, task.stageId);
  if (stage.status === "completed" || stage.status === "cancelled") {
    throw new ProjectCoreModelError("validation_error", "task stage must be open");
  }

  const updatedAt = requireValidTimestamp(input.updatedAt, "task.updatedAt");
  if (timestampIsBefore(updatedAt, managedProject.updatedAt) || timestampIsBefore(updatedAt, task.createdAt)) {
    throw new ProjectCoreModelError("validation_error", "task updatedAt cannot be earlier than current project or task state");
  }

  const nextTask: Task = {
    ...task,
    ...(input.dueDate !== undefined ? { dueDate: requireDateOnly(input.dueDate, "task.dueDate") } : {}),
    ...(input.plannedWorkHours !== undefined
      ? { plannedWorkHours: requireNonNegativeNumber(input.plannedWorkHours, "task.plannedWorkHours") }
      : {}),
    updatedAt,
    correlationId: requireNonEmptyString(input.correlationId, "task.correlationId")
  };
  requireNonEmptyString(input.actorId, "task.actorId");

  return {
    ...managedProject,
    updatedAt,
    tasks: managedProject.tasks.map((candidate) => (candidate.id === taskId ? nextTask : candidate))
  };
}

export function addTaskParticipant(
  project: ManagedProject,
  input: {
    id: string;
    tenantId: TenantId;
    taskId: string;
    userId: TenantUserId;
    role: TaskParticipantRole;
    addedBy: TenantUserId;
    addedAt: string;
    correlationId: string;
  }
): ManagedProject {
  const managedProject = cloneManagedProject(project);
  const tenantId = requireNonEmptyString(input.tenantId, "taskParticipant.tenantId");
  assertTenantId(tenantId, managedProject.tenantId, "taskParticipant tenant mismatch");
  if (managedProject.lifecycleStatus !== "active") {
    throw new ProjectCoreModelError("validation_error", "taskParticipant project must be active");
  }
  const task = findTask(managedProject, requireNonEmptyString(input.taskId, "taskParticipant.taskId"));
  const stage = findProjectStage(managedProject, task.stageId);
  if (stage.status === "completed" || stage.status === "cancelled") {
    throw new ProjectCoreModelError("validation_error", "taskParticipant stage must be open");
  }
  const addedAt = requireValidTimestamp(input.addedAt, "taskParticipant.addedAt");
  if (timestampIsBefore(addedAt, managedProject.updatedAt) || timestampIsBefore(addedAt, task.createdAt)) {
    throw new ProjectCoreModelError(
      "validation_error",
      "taskParticipant addedAt cannot be earlier than current project or task state"
    );
  }

  const participant: TaskParticipant = {
    id: requireNonEmptyString(input.id, "taskParticipant.id"),
    tenantId,
    projectId: managedProject.id,
    stageId: task.stageId,
    taskId: task.id,
    userId: requireNonEmptyString(input.userId, "taskParticipant.userId"),
    role: requireTaskParticipantRole(input.role, "taskParticipant.role"),
    addedBy: requireNonEmptyString(input.addedBy, "taskParticipant.addedBy"),
    addedAt,
    correlationId: requireNonEmptyString(input.correlationId, "taskParticipant.correlationId")
  };

  if (managedProject.taskParticipants.some((existing) => existing.id === participant.id)) {
    throw new ProjectCoreModelError("conflict", "task participant id must be unique");
  }
  if (
    managedProject.taskParticipants.some(
      (existing) => taskParticipantAssignmentKey(existing) === taskParticipantAssignmentKey(participant)
    )
  ) {
    throw new ProjectCoreModelError("conflict", "task participant assignment must be unique per task, role, and user");
  }

  return {
    ...managedProject,
    updatedAt: addedAt,
    taskParticipants: [...managedProject.taskParticipants, participant]
  };
}

export function addTaskComment(
  project: ManagedProject,
  input: {
    id: string;
    tenantId: TenantId;
    taskId: string;
    body: string;
    authorId: TenantUserId;
    createdAt: string;
    correlationId: string;
  }
): ManagedProject {
  const managedProject = cloneManagedProject(project);
  const tenantId = requireNonEmptyString(input.tenantId, "taskComment.tenantId");
  assertTenantId(tenantId, managedProject.tenantId, "taskComment tenant mismatch");
  if (managedProject.lifecycleStatus !== "active") {
    throw new ProjectCoreModelError("validation_error", "taskComment project must be active");
  }
  const task = findTask(managedProject, requireNonEmptyString(input.taskId, "taskComment.taskId"));
  const stage = findProjectStage(managedProject, task.stageId);
  if (stage.status === "completed" || stage.status === "cancelled") {
    throw new ProjectCoreModelError("validation_error", "taskComment stage must be open");
  }
  const createdAt = requireValidTimestamp(input.createdAt, "taskComment.createdAt");
  if (timestampIsBefore(createdAt, managedProject.updatedAt) || timestampIsBefore(createdAt, task.createdAt)) {
    throw new ProjectCoreModelError(
      "validation_error",
      "taskComment createdAt cannot be earlier than current project or task state"
    );
  }

  const comment: TaskComment = {
    id: requireNonEmptyString(input.id, "taskComment.id"),
    tenantId,
    projectId: managedProject.id,
    stageId: task.stageId,
    taskId: task.id,
    body: requireNonEmptyString(input.body, "taskComment.body"),
    authorId: requireNonEmptyString(input.authorId, "taskComment.authorId"),
    createdAt,
    correlationId: requireNonEmptyString(input.correlationId, "taskComment.correlationId")
  };

  if (managedProject.taskComments.some((existing) => existing.id === comment.id)) {
    throw new ProjectCoreModelError("conflict", "task comment id must be unique");
  }

  return {
    ...managedProject,
    updatedAt: createdAt,
    taskComments: [...managedProject.taskComments, comment]
  };
}

export function changeTaskStatus(
  project: ManagedProject,
  input: {
    id: string;
    tenantId: TenantId;
    taskId: string;
    toStatus: TaskStatus;
    actorId: TenantUserId;
    changedAt: string;
    correlationId: string;
  }
): ManagedProject {
  const managedProject = cloneManagedProject(project);
  const tenantId = requireNonEmptyString(input.tenantId, "taskStatusHistory.tenantId");
  assertTenantId(tenantId, managedProject.tenantId, "taskStatusHistory tenant mismatch");
  if (managedProject.lifecycleStatus !== "active") {
    throw new ProjectCoreModelError("validation_error", "taskStatusHistory project must be active");
  }
  const task = findTask(managedProject, requireNonEmptyString(input.taskId, "taskStatusHistory.taskId"));
  const stage = findProjectStage(managedProject, task.stageId);
  if (stage.status === "completed" || stage.status === "cancelled") {
    throw new ProjectCoreModelError("validation_error", "taskStatusHistory stage must be open");
  }
  const toStatus = requireTaskStatus(input.toStatus, "task.status");
  if (task.status === toStatus) {
    throw new ProjectCoreModelError("validation_error", "task status transition must change status");
  }
  const changedAt = requireValidTimestamp(input.changedAt, "taskStatusHistory.changedAt");
  if (timestampIsBefore(changedAt, managedProject.updatedAt) || timestampIsBefore(changedAt, task.updatedAt)) {
    throw new ProjectCoreModelError(
      "validation_error",
      "taskStatusHistory changedAt cannot be earlier than current project or task state"
    );
  }

  const entry: TaskStatusHistoryEntry = {
    id: requireNonEmptyString(input.id, "taskStatusHistory.id"),
    tenantId,
    projectId: managedProject.id,
    stageId: task.stageId,
    taskId: task.id,
    fromStatus: task.status,
    toStatus,
    actorId: requireNonEmptyString(input.actorId, "taskStatusHistory.actorId"),
    changedAt,
    correlationId: requireNonEmptyString(input.correlationId, "taskStatusHistory.correlationId")
  };

  if (managedProject.taskStatusHistory.some((existing) => existing.id === entry.id)) {
    throw new ProjectCoreModelError("conflict", "task status history id must be unique");
  }

  return {
    ...managedProject,
    updatedAt: changedAt,
    tasks: managedProject.tasks.map((candidate) =>
      candidate.id === task.id ? { ...candidate, status: toStatus, updatedAt: changedAt } : candidate
    ),
    taskStatusHistory: [...managedProject.taskStatusHistory, entry]
  };
}

export function recordProjectArtifactEvidence(
  project: ManagedProject,
  input: {
    id: string;
    tenantId: TenantId;
    stageId: string;
    templateId: string;
    templateKey: string;
    status: ProjectArtifactStatus;
    evidenceRef?: string;
    actorId: string;
    occurredAt: string;
  }
): ManagedProject {
  const managedProject = cloneManagedProject(project);
  const tenantId = requireNonEmptyString(input.tenantId, "projectArtifact.tenantId");
  assertTenantId(tenantId, managedProject.tenantId, "projectArtifact tenant mismatch");
  const stageId = requireNonEmptyString(input.stageId, "projectArtifact.stageId");
  const templateId = requireNonEmptyString(input.templateId, "projectArtifact.templateId");
  const templateKey = requireSystemKey(input.templateKey, "projectArtifact.templateKey");
  const artifactTemplate = findArtifactTemplateSnapshot(managedProject, stageId, templateId, templateKey);
  const stage = findProjectStage(managedProject, stageId);
  const occurredAt = requireValidTimestamp(input.occurredAt, "projectArtifact.occurredAt");
  assertStageCanReceiveGateEvidence(managedProject, stage, occurredAt, "projectArtifact");
  const artifact: ProjectArtifact = {
    id: requireNonEmptyString(input.id, "projectArtifact.id"),
    tenantId,
    projectId: managedProject.id,
    stageId,
    templateId: artifactTemplate.id,
    templateKey: artifactTemplate.key,
    templateVersion: stage.templateVersion,
    label: artifactTemplate.label,
    status: requireProjectArtifactStatus(input.status),
    actorId: requireNonEmptyString(input.actorId, "projectArtifact.actorId"),
    occurredAt,
    ...(input.evidenceRef !== undefined
      ? { evidenceRef: requireNonEmptyString(input.evidenceRef, "projectArtifact.evidenceRef") }
      : {})
  };

  if (managedProject.artifacts.some((existing) => existing.id === artifact.id)) {
    throw new ProjectCoreModelError("conflict", "projectArtifact id must be unique");
  }

  return {
    ...managedProject,
    updatedAt: artifact.occurredAt,
    artifacts: [...managedProject.artifacts, artifact]
  };
}

export function createStageApprovalRequest(
  project: ManagedProject,
  input: {
    id: string;
    tenantId: TenantId;
    stageId: string;
    templateId: string;
    templateKey: string;
    requestedBy: string;
    requestedAt: string;
  }
): ManagedProject {
  const managedProject = cloneManagedProject(project);
  const tenantId = requireNonEmptyString(input.tenantId, "approvalRequest.tenantId");
  assertTenantId(tenantId, managedProject.tenantId, "approvalRequest tenant mismatch");
  const stageId = requireNonEmptyString(input.stageId, "approvalRequest.stageId");
  const templateId = requireNonEmptyString(input.templateId, "approvalRequest.templateId");
  const templateKey = requireSystemKey(input.templateKey, "approvalRequest.templateKey");
  const approvalTemplate = findApprovalTemplateSnapshot(managedProject, stageId, templateId, templateKey);
  const stage = findProjectStage(managedProject, stageId);
  const requestedAt = requireValidTimestamp(input.requestedAt, "approvalRequest.requestedAt");
  assertStageCanReceiveGateEvidence(managedProject, stage, requestedAt, "approvalRequest");
  const request: ApprovalRequest = {
    id: requireNonEmptyString(input.id, "approvalRequest.id"),
    tenantId,
    projectId: managedProject.id,
    stageId,
    templateId: approvalTemplate.id,
    templateKey: approvalTemplate.key,
    templateVersion: stage.templateVersion,
    label: approvalTemplate.label,
    approverRoleKey: approvalTemplate.approverRoleKey,
    status: "requested",
    requestedBy: requireNonEmptyString(input.requestedBy, "approvalRequest.requestedBy"),
    requestedAt
  };

  if (managedProject.approvalRequests.some((existing) => existing.id === request.id)) {
    throw new ProjectCoreModelError("conflict", "approvalRequest id must be unique");
  }

  return {
    ...managedProject,
    updatedAt: request.requestedAt,
    approvalRequests: [...managedProject.approvalRequests, request]
  };
}

export function approveStageApprovalRequest(
  project: ManagedProject,
  input: {
    tenantId: TenantId;
    approvalRequestId: string;
    decidedBy: string;
    decidedAt: string;
  }
): ManagedProject {
  const managedProject = cloneManagedProject(project);
  const tenantId = requireNonEmptyString(input.tenantId, "approvalRequest.tenantId");
  assertTenantId(tenantId, managedProject.tenantId, "approvalRequest tenant mismatch");
  const approvalRequestId = requireNonEmptyString(input.approvalRequestId, "approvalRequest.id");
  const decidedAt = requireValidTimestamp(input.decidedAt, "approvalRequest.decidedAt");
  const request = managedProject.approvalRequests.find((candidate) => candidate.id === approvalRequestId);
  if (request === undefined) {
    throw new ProjectCoreModelError("validation_error", "approvalRequest not found");
  }
  if (timestampIsBefore(decidedAt, request.requestedAt)) {
    throw new ProjectCoreModelError(
      "validation_error",
      "approvalRequest decision timestamp cannot be earlier than request timestamp"
    );
  }
  const stage = findProjectStage(managedProject, request.stageId);
  assertStageCanReceiveGateEvidence(managedProject, stage, decidedAt, "approvalRequest");

  return {
    ...managedProject,
    updatedAt: decidedAt,
    approvalRequests: managedProject.approvalRequests.map((candidate) =>
      candidate.id === approvalRequestId
        ? {
            ...candidate,
            status: "approved",
            decidedBy: requireNonEmptyString(input.decidedBy, "approvalRequest.decidedBy"),
            decidedAt
          }
        : candidate
    )
  };
}

export function advanceManagedProjectLifecycle(
  project: ManagedProject,
  command: ProjectLifecycleTransitionCommand
): ProjectLifecycleTransitionResult {
  const tenantId = requireNonEmptyString(command.tenantId, "projectLifecycle.tenantId");
  const actorId = requireNonEmptyString(command.actorId, "projectLifecycle.actorId");
  const occurredAt = requireValidTimestamp(command.occurredAt, "projectLifecycle.occurredAt");
  const correlationId = requireNonEmptyString(command.correlationId, "projectLifecycle.correlationId");
  const requestedCurrentStageId = requireNonEmptyString(command.currentStageId, "projectLifecycle.currentStageId");
  const managedProject = cloneManagedProject(project);
  const transition = parseProjectLifecycleTransition(command.transition);

  if (tenantId !== managedProject.tenantId) {
    return {
      ok: false,
      project,
      error: createTransitionError("tenant_mismatch", "Project lifecycle transition tenant does not match project", {
        tenantId,
        projectTenantId: managedProject.tenantId
      })
    };
  }
  if (transition === null) {
    return {
      ok: false,
      project,
      error: createTransitionError("invalid_transition", "Project lifecycle transition command is invalid", {
        transition: typeof command.transition === "string" ? command.transition : null,
        lifecycleStatus: managedProject.lifecycleStatus,
        currentStageId: managedProject.currentStageId
      })
    };
  }
  const projectStateError = validateProjectLifecycleState(managedProject);
  if (projectStateError !== null) {
    return {
      ok: false,
      project,
      error: projectStateError
    };
  }
  if (managedProject.lifecycleStatus !== "active") {
    return {
      ok: false,
      project,
      error: createTransitionError("project_not_active", "Project lifecycle transition requires an active project", {
        transition,
        lifecycleStatus: managedProject.lifecycleStatus,
        currentStageId: managedProject.currentStageId
      })
    };
  }

  const currentStageIndex = findCurrentStageIndex(managedProject);
  if (currentStageIndex < 0) {
    return {
      ok: false,
      project,
      error: createTransitionError("current_stage_missing", "Project lifecycle current stage is missing", {
        transition,
        lifecycleStatus: managedProject.lifecycleStatus,
        currentStageId: managedProject.currentStageId
      })
    };
  }
  const currentStage = managedProject.stages[currentStageIndex];
  if (currentStage === undefined) {
    return {
      ok: false,
      project,
      error: createTransitionError("current_stage_missing", "Project lifecycle current stage is missing", {
        transition,
        lifecycleStatus: managedProject.lifecycleStatus,
        currentStageId: managedProject.currentStageId
      })
    };
  }
  if (requestedCurrentStageId !== currentStage.id) {
    return {
      ok: false,
      project,
      error: createTransitionError("stage_not_current", "Project lifecycle transition stage is not current", {
        transition,
        lifecycleStatus: managedProject.lifecycleStatus,
        currentStageId: managedProject.currentStageId
      })
    };
  }
  if (
    timestampIsBefore(occurredAt, managedProject.updatedAt) ||
    (currentStage.startedAt !== undefined && timestampIsBefore(occurredAt, currentStage.startedAt))
  ) {
    return {
      ok: false,
      project,
      error: createTransitionError(
        "transition_timestamp_invalid",
        "Project lifecycle transition timestamp cannot be earlier than current project or stage state",
        {
          occurredAt,
          projectUpdatedAt: managedProject.updatedAt,
          currentStageStartedAt: currentStage.startedAt ?? null
        }
      )
    };
  }
  const allowedTransitions = getAllowedProjectLifecycleTransitions(managedProject);
  if (!allowedTransitions.includes(transition)) {
    return {
      ok: false,
      project,
      error: createTransitionError(
        "transition_not_allowed",
        "Project lifecycle transition is not allowed from the current state",
        {
          transition,
          lifecycleStatus: managedProject.lifecycleStatus,
          currentStageId: managedProject.currentStageId
        }
      )
    };
  }
  if (transition === "advance_stage" || transition === "complete_project") {
    const gateEvaluation = evaluateStageGate(managedProject, currentStage.id);
    if (!gateEvaluation.ok) {
      return {
        ok: false,
        project,
        error: createTransitionError(
          "stage_gate_blocked",
          "Project stage gate blocks lifecycle transition",
          {
            transition,
            lifecycleStatus: managedProject.lifecycleStatus,
            currentStageId: managedProject.currentStageId,
            blockerCodes: gateEvaluation.blockers.map((blocker) => blocker.code).join(",")
          },
          gateEvaluation.blockers
        )
      };
    }
  }

  if (transition === "advance_stage") {
    const nextStage = managedProject.stages[currentStageIndex + 1];
    if (nextStage === undefined) {
      return {
        ok: false,
        project,
        error: createTransitionError(
          "transition_not_allowed",
          "Project lifecycle transition is not allowed from the current state",
          {
            transition,
            lifecycleStatus: managedProject.lifecycleStatus,
            currentStageId: managedProject.currentStageId
          }
        )
      };
    }

    const nextProject: ManagedProject = {
      ...managedProject,
      currentStageId: nextStage.id,
      updatedAt: occurredAt,
      stages: managedProject.stages.map((stage) => {
        if (stage.id === currentStage.id) {
          return { ...stage, status: "completed", completedAt: occurredAt };
        }
        if (stage.id === nextStage.id) {
          return { ...stage, status: "active", startedAt: occurredAt };
        }
        return { ...stage };
      })
    };

    return {
      ok: true,
      project: {
        ...nextProject,
        stageHistory: [
          ...nextProject.stageHistory,
          createStageHistoryEntry({
            project: nextProject,
            stageId: currentStage.id,
            transition,
            fromStatus: "active",
            toStatus: "completed",
            actorId,
            occurredAt,
            correlationId
          }),
          createStageHistoryEntry({
            project: nextProject,
            stageId: nextStage.id,
            transition,
            fromStatus: "pending",
            toStatus: "active",
            actorId,
            occurredAt,
            correlationId
          })
        ]
      }
    };
  }

  const terminalStageStatus: ProjectStageStatus = transition === "complete_project" ? "completed" : "cancelled";
  const terminalLifecycleStatus: ManagedProjectLifecycleStatus = transition === "complete_project" ? "completed" : "cancelled";
  const nextProject: ManagedProject = {
    ...managedProject,
    lifecycleStatus: terminalLifecycleStatus,
    currentStageId: null,
    updatedAt: occurredAt,
    stages: managedProject.stages.map((stage) =>
      stage.id === currentStage.id ? { ...stage, status: terminalStageStatus, completedAt: occurredAt } : { ...stage }
    )
  };

  return {
    ok: true,
    project: {
      ...nextProject,
      stageHistory: [
        ...nextProject.stageHistory,
        createStageHistoryEntry({
          project: nextProject,
          stageId: currentStage.id,
          transition,
          fromStatus: "active",
          toStatus: terminalStageStatus,
          actorId,
          occurredAt,
          correlationId
        })
      ]
    }
  };
}
