import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";

export type TenantConfigurationStatus = "draft" | "active" | "archived";

export type CustomFieldTargetEntityType = "opportunity" | "project" | "task" | "tenant_user" | "workspace";

export type CustomFieldValueType = "text" | "number" | "date" | "boolean" | "single_select" | "multi_select";

export type CustomFieldMetadataValue = string | number | boolean | string[] | number[];

export type CustomFieldBindingFlags = {
  usableInFilters: boolean;
  usableInControlSurfaces: boolean;
  usableInKpiSourceBindings: boolean;
};

export type CustomFieldVisibilityRule = {
  surfaceKey: string;
  visible: boolean;
};

export type CustomFieldPermissionRules = {
  readPermissionKey?: string;
  writePermissionKey?: string;
};

export type CustomFieldDefinition = {
  id: string;
  tenantId: TenantId;
  targetEntityType: CustomFieldTargetEntityType;
  key: string;
  label: string;
  valueType: CustomFieldValueType;
  required: boolean;
  active: boolean;
  version: number;
  validationRules?: Record<string, CustomFieldMetadataValue>;
  visibilityRules?: CustomFieldVisibilityRule[];
  permissionRules?: CustomFieldPermissionRules;
  bindingFlags: CustomFieldBindingFlags;
  updatedAt: string;
};

export type OpportunityIntakeStandardFieldKey =
  | "account_contact_intent"
  | "planned_dates"
  | "expected_value"
  | "probability"
  | "category"
  | "typology"
  | "scope_hints";

export type OpportunityCategoryDefinition = {
  id: string;
  tenantId: TenantId;
  key: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

export type OpportunityTypologyDefinition = {
  id: string;
  tenantId: TenantId;
  key: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

export type OpportunityIntakeTemplate = {
  id: string;
  tenantId: TenantId;
  key: string;
  label: string;
  categoryKey: string;
  typologyKey: string;
  requiredStandardFieldKeys: OpportunityIntakeStandardFieldKey[];
  requiredCustomFieldKeys: string[];
  active: boolean;
  version: number;
  updatedAt: string;
};

export type OpportunityIntakeMetadataRegistry = {
  tenantId: TenantId;
  version: number;
  categories: OpportunityCategoryDefinition[];
  typologies: OpportunityTypologyDefinition[];
  customFields: CustomFieldDefinition[];
  templates: OpportunityIntakeTemplate[];
  updatedAt: string;
};

export type OpportunityIntakeRequirements = {
  tenantId: TenantId;
  registryVersion: number;
  templateKey: string;
  templateLabel: string;
  category: {
    key: string;
    label: string;
  };
  typology: {
    key: string;
    label: string;
  };
  requiredStandardFieldKeys: OpportunityIntakeStandardFieldKey[];
  requiredCustomFields: Array<{
    definitionId: string;
    key: string;
    label: string;
    valueType: CustomFieldValueType;
  }>;
  trace: string[];
};

export type ProcessTemplateConfigurationRef = {
  id: string;
  tenantId: TenantId;
  key: string;
  label: string;
  version: number;
  active: boolean;
};

export type ProcessTemplateImprovementKey = "add_acceptance_checkpoint";

export type ProcessTemplateImprovementPreview = {
  id: string;
  tenantId: TenantId;
  actorId: TenantUserId;
  sourceInsightId: string;
  sourceTrendId: string;
  sourceSnapshotIds: string[];
  sourceMetricIds: string[];
  improvementKey: ProcessTemplateImprovementKey;
  reason: string;
  mutatesState: false;
  stateVersion: number;
  template: {
    id: string;
    key: string;
    label: string;
    currentVersion: number;
    nextVersion: number;
  };
  before: {
    templateVersion: number;
  };
  after: {
    templateVersion: number;
    addedChecklistItemKey: ProcessTemplateImprovementKey;
    recommendedLabel: string;
  };
  createdAt: string;
};

export type ImprovedProcessTemplateConfigurationRef = ProcessTemplateConfigurationRef & {
  improvementSourceInsightId: string;
  improvementSourceSnapshotIds: string[];
  improvementKey: ProcessTemplateImprovementKey;
  improvedAt: string;
};

export type ProcessTemplateImprovementApplyResult = {
  previousVersion: number;
  template: ImprovedProcessTemplateConfigurationRef;
};

export type ProcessTemplateConfigurationRegistry = {
  tenantId: TenantId;
  version: number;
  processTemplates: ProcessTemplateConfigurationRef[];
  updatedAt: string;
};

export type CustomFieldRegistry = {
  tenantId: TenantId;
  version: number;
  definitions: CustomFieldDefinition[];
  updatedAt: string;
};

export type CustomFieldDefinitionUpdateResult = {
  previousVersion: number;
  definition: CustomFieldDefinition;
};

export type TenantConfiguration = {
  id: string;
  tenantId: TenantId;
  version: number;
  labelSetVersion: number;
  status: TenantConfigurationStatus;
  createdBy: TenantUserId;
  createdAt: string;
  activatedAt?: string;
};

export type TenantLabelSet = {
  tenantId: TenantId;
  configurationVersion: number;
  labels: Record<string, string>;
  updatedAt: string;
};

export type TenantLabelChangeTrace = {
  tenantId: TenantId;
  configurationVersion: number;
  previousConfigurationVersion: number;
  changedLabel: {
    key: string;
    beforeLabel: string;
    afterLabel: string;
  };
  labels: Record<string, string>;
};

export type TenantLabelUpdateResult = {
  labelSet: TenantLabelSet;
  trace: TenantLabelChangeTrace;
};

export class TenantConfigModelError extends Error {
  constructor(
    readonly code: "validation_error" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "TenantConfigModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TenantConfigModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new TenantConfigModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireArray<T>(value: T[] | undefined, fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new TenantConfigModelError("validation_error", `${fieldName} must be an array`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
    timestamp
  );
  if (match === null) {
    throw new TenantConfigModelError("validation_error", `${fieldName} must be a valid timestamp`);
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
    throw new TenantConfigModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireValidStatus(value: TenantConfigurationStatus | undefined): TenantConfigurationStatus {
  if (value !== "draft" && value !== "active" && value !== "archived") {
    throw new TenantConfigModelError("validation_error", "tenantConfiguration.status is invalid");
  }

  return value;
}

function requireBoolean(value: boolean | undefined, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new TenantConfigModelError("validation_error", `${fieldName} must be a boolean`);
  }

  return value;
}

function requireSystemKey(value: string | undefined, fieldName: string): string {
  const key = requireNonEmptyString(value, fieldName);

  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(key)) {
    throw new TenantConfigModelError("validation_error", `${fieldName} must be a stable system key`);
  }

  return key;
}

function requireMetadataKey(value: string | undefined, fieldName: string): string {
  const key = requireNonEmptyString(value, fieldName);

  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/.test(key)) {
    throw new TenantConfigModelError("validation_error", `${fieldName} must be a metadata key`);
  }

  return key;
}

function requireCustomFieldTargetEntityType(value: string | undefined): CustomFieldTargetEntityType {
  if (
    value !== "opportunity" &&
    value !== "project" &&
    value !== "task" &&
    value !== "tenant_user" &&
    value !== "workspace"
  ) {
    throw new TenantConfigModelError("validation_error", `Unsupported custom field target entity type: ${value}`);
  }

  return value;
}

function requireCustomFieldValueType(value: string | undefined): CustomFieldValueType {
  if (
    value !== "text" &&
    value !== "number" &&
    value !== "date" &&
    value !== "boolean" &&
    value !== "single_select" &&
    value !== "multi_select"
  ) {
    throw new TenantConfigModelError("validation_error", `Unsupported custom field value type: ${value}`);
  }

  return value;
}

function requireOpportunityIntakeStandardFieldKey(value: string | undefined): OpportunityIntakeStandardFieldKey {
  if (
    value !== "account_contact_intent" &&
    value !== "planned_dates" &&
    value !== "expected_value" &&
    value !== "probability" &&
    value !== "category" &&
    value !== "typology" &&
    value !== "scope_hints"
  ) {
    throw new TenantConfigModelError("validation_error", `Unsupported opportunity intake standard field: ${value}`);
  }

  return value;
}

function requireProcessTemplateImprovementKey(value: string | undefined): ProcessTemplateImprovementKey {
  if (value !== "add_acceptance_checkpoint") {
    throw new TenantConfigModelError("validation_error", `Unsupported process template improvement: ${value}`);
  }

  return value;
}

function cloneMetadataValue(value: CustomFieldMetadataValue): CustomFieldMetadataValue {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (!Array.isArray(value)) {
    throw new TenantConfigModelError(
      "validation_error",
      "customField.validationRuleValue must be a scalar or homogeneous array"
    );
  }

  if (value.every((item): item is string => typeof item === "string")) {
    return [...value];
  }

  if (value.every((item): item is number => typeof item === "number")) {
    return [...value];
  }

  throw new TenantConfigModelError("validation_error", "customField.validationRuleValue array must not mix value types");
}

function cloneValidationRules(
  rules: Record<string, CustomFieldMetadataValue> | undefined
): Record<string, CustomFieldMetadataValue> | undefined {
  if (rules === undefined) return undefined;

  const cloned: Record<string, CustomFieldMetadataValue> = {};
  for (const [key, value] of Object.entries(rules)) {
    cloned[requireMetadataKey(key, "customField.validationRuleKey")] = cloneMetadataValue(value);
  }

  return cloned;
}

function cloneVisibilityRules(rules: CustomFieldVisibilityRule[] | undefined): CustomFieldVisibilityRule[] | undefined {
  if (rules === undefined) return undefined;

  return rules.map((rule) => ({
    surfaceKey: requireSystemKey(rule.surfaceKey, "customField.visibilityRule.surfaceKey"),
    visible: requireBoolean(rule.visible, "customField.visibilityRule.visible")
  }));
}

function clonePermissionRules(rules: CustomFieldPermissionRules | undefined): CustomFieldPermissionRules | undefined {
  if (rules === undefined) return undefined;

  return {
    ...(rules.readPermissionKey !== undefined
      ? { readPermissionKey: requireSystemKey(rules.readPermissionKey, "customField.permissionRules.readPermissionKey") }
      : {}),
    ...(rules.writePermissionKey !== undefined
      ? {
          writePermissionKey: requireSystemKey(
            rules.writePermissionKey,
            "customField.permissionRules.writePermissionKey"
          )
        }
      : {})
  };
}

function createBindingFlags(input: CustomFieldBindingFlags): CustomFieldBindingFlags {
  return {
    usableInFilters: requireBoolean(input.usableInFilters, "customField.bindingFlags.usableInFilters"),
    usableInControlSurfaces: requireBoolean(
      input.usableInControlSurfaces,
      "customField.bindingFlags.usableInControlSurfaces"
    ),
    usableInKpiSourceBindings: requireBoolean(
      input.usableInKpiSourceBindings,
      "customField.bindingFlags.usableInKpiSourceBindings"
    )
  };
}

function cloneStandardFieldKeys(keys: OpportunityIntakeStandardFieldKey[] | undefined): OpportunityIntakeStandardFieldKey[] {
  const cloned = requireArray(keys, "opportunityIntakeTemplate.requiredStandardFieldKeys").map((key) =>
    requireOpportunityIntakeStandardFieldKey(key)
  );
  if (new Set(cloned).size !== cloned.length) {
    throw new TenantConfigModelError("conflict", "Duplicate opportunity intake standard field key");
  }

  return cloned;
}

function cloneCustomFieldKeys(keys: string[] | undefined): string[] {
  const cloned = requireArray(keys, "opportunityIntakeTemplate.requiredCustomFieldKeys").map((key) =>
    requireSystemKey(key, "opportunityIntakeTemplate.requiredCustomFieldKey")
  );
  if (new Set(cloned).size !== cloned.length) {
    throw new TenantConfigModelError("conflict", "Duplicate opportunity intake custom field key");
  }

  return cloned;
}

function normalizeLabels(labels: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, label] of Object.entries(labels)) {
    normalized[requireNonEmptyString(key, "tenantLabel.key")] = requireNonEmptyString(label, "tenantLabel.label");
  }

  if (Object.keys(normalized).length === 0) {
    throw new TenantConfigModelError("validation_error", "tenantLabelSet.labels must not be empty");
  }

  return normalized;
}

export function createTenantConfiguration(input: {
  id: string;
  tenantId: TenantId;
  version: number;
  labelSetVersion: number;
  status: TenantConfigurationStatus;
  createdBy: TenantUserId;
  createdAt: string;
  activatedAt?: string;
}): TenantConfiguration {
  return {
    id: requireNonEmptyString(input.id, "tenantConfiguration.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    version: requirePositiveInteger(input.version, "tenantConfiguration.version"),
    labelSetVersion: requirePositiveInteger(input.labelSetVersion, "tenantConfiguration.labelSetVersion"),
    status: requireValidStatus(input.status),
    createdBy: requireNonEmptyString(input.createdBy, "tenantConfiguration.createdBy"),
    createdAt: requireValidTimestamp(input.createdAt, "tenantConfiguration.createdAt"),
    ...(input.activatedAt !== undefined
      ? { activatedAt: requireValidTimestamp(input.activatedAt, "tenantConfiguration.activatedAt") }
      : {})
  };
}

export function createOpportunityCategoryDefinition(input: {
  id: string;
  tenantId: TenantId;
  key: string;
  label: string;
  active: boolean;
  sortOrder: number;
}): OpportunityCategoryDefinition {
  return {
    id: requireNonEmptyString(input.id, "opportunityCategory.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    key: requireSystemKey(input.key, "opportunityCategory.key"),
    label: requireNonEmptyString(input.label, "opportunityCategory.label"),
    active: requireBoolean(input.active, "opportunityCategory.active"),
    sortOrder: requirePositiveInteger(input.sortOrder, "opportunityCategory.sortOrder")
  };
}

export function createOpportunityTypologyDefinition(input: {
  id: string;
  tenantId: TenantId;
  key: string;
  label: string;
  active: boolean;
  sortOrder: number;
}): OpportunityTypologyDefinition {
  return {
    id: requireNonEmptyString(input.id, "opportunityTypology.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    key: requireSystemKey(input.key, "opportunityTypology.key"),
    label: requireNonEmptyString(input.label, "opportunityTypology.label"),
    active: requireBoolean(input.active, "opportunityTypology.active"),
    sortOrder: requirePositiveInteger(input.sortOrder, "opportunityTypology.sortOrder")
  };
}

export function createOpportunityIntakeTemplate(input: {
  id: string;
  tenantId: TenantId;
  key: string;
  label: string;
  categoryKey: string;
  typologyKey: string;
  requiredStandardFieldKeys: OpportunityIntakeStandardFieldKey[];
  requiredCustomFieldKeys: string[];
  active: boolean;
  version: number;
  updatedAt: string;
}): OpportunityIntakeTemplate {
  return {
    id: requireNonEmptyString(input.id, "opportunityIntakeTemplate.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    key: requireSystemKey(input.key, "opportunityIntakeTemplate.key"),
    label: requireNonEmptyString(input.label, "opportunityIntakeTemplate.label"),
    categoryKey: requireSystemKey(input.categoryKey, "opportunityIntakeTemplate.categoryKey"),
    typologyKey: requireSystemKey(input.typologyKey, "opportunityIntakeTemplate.typologyKey"),
    requiredStandardFieldKeys: cloneStandardFieldKeys(input.requiredStandardFieldKeys),
    requiredCustomFieldKeys: cloneCustomFieldKeys(input.requiredCustomFieldKeys),
    active: requireBoolean(input.active, "opportunityIntakeTemplate.active"),
    version: requirePositiveInteger(input.version, "opportunityIntakeTemplate.version"),
    updatedAt: requireValidTimestamp(input.updatedAt, "opportunityIntakeTemplate.updatedAt")
  };
}

export function createCustomFieldDefinition(input: {
  id: string;
  tenantId: TenantId;
  targetEntityType: string;
  key: string;
  label: string;
  valueType: string;
  required: boolean;
  active: boolean;
  version: number;
  validationRules?: Record<string, CustomFieldMetadataValue>;
  visibilityRules?: CustomFieldVisibilityRule[];
  permissionRules?: CustomFieldPermissionRules;
  bindingFlags: CustomFieldBindingFlags;
  updatedAt: string;
}): CustomFieldDefinition {
  return {
    id: requireNonEmptyString(input.id, "customField.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    targetEntityType: requireCustomFieldTargetEntityType(input.targetEntityType),
    key: requireSystemKey(input.key, "customField.key"),
    label: requireNonEmptyString(input.label, "customField.label"),
    valueType: requireCustomFieldValueType(input.valueType),
    required: requireBoolean(input.required, "customField.required"),
    active: requireBoolean(input.active, "customField.active"),
    version: requirePositiveInteger(input.version, "customField.version"),
    ...(input.validationRules !== undefined ? { validationRules: cloneValidationRules(input.validationRules) } : {}),
    ...(input.visibilityRules !== undefined ? { visibilityRules: cloneVisibilityRules(input.visibilityRules) } : {}),
    ...(input.permissionRules !== undefined ? { permissionRules: clonePermissionRules(input.permissionRules) } : {}),
    bindingFlags: createBindingFlags(input.bindingFlags),
    updatedAt: requireValidTimestamp(input.updatedAt, "customField.updatedAt")
  };
}

export function createProcessTemplateConfigurationRef(input: {
  id: string;
  tenantId: TenantId;
  key: string;
  label: string;
  version: number;
  active: boolean;
}): ProcessTemplateConfigurationRef {
  return {
    id: requireNonEmptyString(input.id, "processTemplateConfiguration.id"),
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    key: requireSystemKey(input.key, "processTemplateConfiguration.key"),
    label: requireNonEmptyString(input.label, "processTemplateConfiguration.label"),
    version: requirePositiveInteger(input.version, "processTemplateConfiguration.version"),
    active: requireBoolean(input.active, "processTemplateConfiguration.active")
  };
}

export function previewProcessTemplateImprovement(input: {
  id: string;
  tenantId: TenantId;
  actorId: TenantUserId;
  sourceInsightId: string;
  sourceTrendId: string;
  sourceSnapshotIds: string[];
  sourceMetricIds: string[];
  currentTemplate: ProcessTemplateConfigurationRef;
  improvementKey: string;
  reason: string;
  stateVersion: number;
  createdAt: string;
}): ProcessTemplateImprovementPreview {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const currentTemplate = createProcessTemplateConfigurationRef(input.currentTemplate);
  if (currentTemplate.tenantId !== tenantId) {
    throw new TenantConfigModelError("validation_error", "Process template improvement tenant mismatch");
  }
  const sourceSnapshotIds = requireArray(input.sourceSnapshotIds, "processTemplateImprovement.sourceSnapshotIds").map((id) =>
    requireNonEmptyString(id, "processTemplateImprovement.sourceSnapshotId")
  );
  if (sourceSnapshotIds.length === 0) {
    throw new TenantConfigModelError("validation_error", "processTemplateImprovement.sourceSnapshotIds must not be empty");
  }
  const sourceMetricIds = requireArray(input.sourceMetricIds, "processTemplateImprovement.sourceMetricIds").map((id) =>
    requireNonEmptyString(id, "processTemplateImprovement.sourceMetricId")
  );
  if (sourceMetricIds.length === 0) {
    throw new TenantConfigModelError("validation_error", "processTemplateImprovement.sourceMetricIds must not be empty");
  }
  const improvementKey = requireProcessTemplateImprovementKey(input.improvementKey);
  const currentVersion = requirePositiveInteger(currentTemplate.version, "processTemplateConfiguration.version");

  return {
    id: requireNonEmptyString(input.id, "processTemplateImprovement.id"),
    tenantId,
    actorId: requireNonEmptyString(input.actorId, "processTemplateImprovement.actorId"),
    sourceInsightId: requireNonEmptyString(input.sourceInsightId, "processTemplateImprovement.sourceInsightId"),
    sourceTrendId: requireNonEmptyString(input.sourceTrendId, "processTemplateImprovement.sourceTrendId"),
    sourceSnapshotIds,
    sourceMetricIds,
    improvementKey,
    reason: requireNonEmptyString(input.reason, "processTemplateImprovement.reason"),
    mutatesState: false,
    stateVersion: requirePositiveInteger(input.stateVersion, "processTemplateImprovement.stateVersion"),
    template: {
      id: currentTemplate.id,
      key: currentTemplate.key,
      label: currentTemplate.label,
      currentVersion,
      nextVersion: currentVersion + 1
    },
    before: {
      templateVersion: currentVersion
    },
    after: {
      templateVersion: currentVersion + 1,
      addedChecklistItemKey: improvementKey,
      recommendedLabel: "Ранняя приемка результата"
    },
    createdAt: requireValidTimestamp(input.createdAt, "processTemplateImprovement.createdAt")
  };
}

export function applyProcessTemplateImprovementPreview(
  currentTemplateInput: ProcessTemplateConfigurationRef,
  input: {
    preview: ProcessTemplateImprovementPreview;
    expectedStateVersion: number;
    appliedAt: string;
  }
): ProcessTemplateImprovementApplyResult {
  const currentTemplate = createProcessTemplateConfigurationRef(currentTemplateInput);
  const preview = previewProcessTemplateImprovement({
    id: input.preview.id,
    tenantId: input.preview.tenantId,
    actorId: input.preview.actorId,
    sourceInsightId: input.preview.sourceInsightId,
    sourceTrendId: input.preview.sourceTrendId,
    sourceSnapshotIds: input.preview.sourceSnapshotIds,
    sourceMetricIds: input.preview.sourceMetricIds,
    currentTemplate,
    improvementKey: input.preview.improvementKey,
    reason: input.preview.reason,
    stateVersion: input.preview.stateVersion,
    createdAt: input.preview.createdAt
  });
  const expectedStateVersion = requirePositiveInteger(
    input.expectedStateVersion,
    "processTemplateImprovement.expectedStateVersion"
  );
  if (preview.stateVersion !== expectedStateVersion || preview.template.currentVersion !== currentTemplate.version) {
    throw new TenantConfigModelError("conflict", "Process template improvement preview is stale");
  }
  if (preview.template.id !== currentTemplate.id || preview.tenantId !== currentTemplate.tenantId) {
    throw new TenantConfigModelError("validation_error", "Process template improvement tenant mismatch");
  }

  return {
    previousVersion: currentTemplate.version,
    template: {
      ...currentTemplate,
      version: currentTemplate.version + 1,
      improvementSourceInsightId: preview.sourceInsightId,
      improvementSourceSnapshotIds: [...preview.sourceSnapshotIds],
      improvementKey: preview.improvementKey,
      improvedAt: requireValidTimestamp(input.appliedAt, "processTemplateImprovement.appliedAt")
    }
  };
}

export function createProcessTemplateConfigurationRegistry(input: {
  tenantId: TenantId;
  version: number;
  processTemplates: ProcessTemplateConfigurationRef[];
  updatedAt: string;
}): ProcessTemplateConfigurationRegistry {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const processTemplates = requireArray(
    input.processTemplates,
    "processTemplateConfigurationRegistry.processTemplates"
  ).map((template) => createProcessTemplateConfigurationRef(template));
  const activeTemplateIds = new Set<string>();
  const activeTemplateKeys = new Set<string>();

  for (const template of processTemplates) {
    if (template.tenantId !== tenantId) {
      throw new TenantConfigModelError(
        "validation_error",
        `Process template configuration tenant mismatch: ${template.id}`
      );
    }

    if (template.active) {
      if (activeTemplateIds.has(template.id)) {
        throw new TenantConfigModelError("conflict", `Duplicate active process template id: ${template.id}`);
      }
      if (activeTemplateKeys.has(template.key)) {
        throw new TenantConfigModelError("conflict", `Duplicate active process template key: ${template.key}`);
      }
      activeTemplateIds.add(template.id);
      activeTemplateKeys.add(template.key);
    }
  }

  return {
    tenantId,
    version: requirePositiveInteger(input.version, "processTemplateConfigurationRegistry.version"),
    processTemplates,
    updatedAt: requireValidTimestamp(input.updatedAt, "processTemplateConfigurationRegistry.updatedAt")
  };
}

function indexByKey<T extends { key: string }>(items: T[], duplicateMessage: (key: string) => string): Map<string, T> {
  const index = new Map<string, T>();

  for (const item of items) {
    if (index.has(item.key)) {
      throw new TenantConfigModelError("conflict", duplicateMessage(item.key));
    }
    index.set(item.key, item);
  }

  return index;
}

export function createOpportunityIntakeMetadataRegistry(input: {
  tenantId: TenantId;
  version: number;
  categories: OpportunityCategoryDefinition[];
  typologies: OpportunityTypologyDefinition[];
  customFields: CustomFieldDefinition[];
  templates: OpportunityIntakeTemplate[];
  updatedAt: string;
}): OpportunityIntakeMetadataRegistry {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const categories = requireArray(input.categories, "opportunityIntakeMetadata.categories").map((category) =>
    createOpportunityCategoryDefinition(category)
  );
  const typologies = requireArray(input.typologies, "opportunityIntakeMetadata.typologies").map((typology) =>
    createOpportunityTypologyDefinition(typology)
  );
  const customFields = requireArray(input.customFields, "opportunityIntakeMetadata.customFields").map((field) =>
    createCustomFieldDefinition(field)
  );
  const templates = requireArray(input.templates, "opportunityIntakeMetadata.templates").map((template) =>
    createOpportunityIntakeTemplate(template)
  );

  for (const category of categories) {
    if (category.tenantId !== tenantId) {
      throw new TenantConfigModelError("validation_error", `Opportunity category tenant mismatch: ${category.id}`);
    }
  }
  for (const typology of typologies) {
    if (typology.tenantId !== tenantId) {
      throw new TenantConfigModelError("validation_error", `Opportunity typology tenant mismatch: ${typology.id}`);
    }
  }
  for (const field of customFields) {
    if (field.tenantId !== tenantId) {
      throw new TenantConfigModelError("validation_error", `Opportunity intake custom field tenant mismatch: ${field.id}`);
    }
    if (field.targetEntityType !== "opportunity") {
      throw new TenantConfigModelError(
        "validation_error",
        `Opportunity intake custom field must target opportunity: ${field.id}`
      );
    }
  }
  for (const template of templates) {
    if (template.tenantId !== tenantId) {
      throw new TenantConfigModelError("validation_error", `Opportunity intake template tenant mismatch: ${template.id}`);
    }
  }

  const categoryByKey = indexByKey(categories, (key) => `Duplicate opportunity category key: ${key}`);
  const typologyByKey = indexByKey(typologies, (key) => `Duplicate opportunity typology key: ${key}`);
  const customFieldByKey = indexByKey(customFields, (key) => `Duplicate opportunity intake custom field key: ${key}`);
  indexByKey(templates, (key) => `Duplicate opportunity intake template key: ${key}`);

  const activeTemplatePairs = new Set<string>();

  for (const template of templates) {
    const category = categoryByKey.get(template.categoryKey);
    if (category === undefined) {
      throw new TenantConfigModelError(
        "validation_error",
        `Opportunity intake template references unknown category: ${template.categoryKey}`
      );
    }
    if (template.active && !category.active) {
      throw new TenantConfigModelError(
        "validation_error",
        `Opportunity intake template references inactive category: ${template.categoryKey}`
      );
    }

    const typology = typologyByKey.get(template.typologyKey);
    if (typology === undefined) {
      throw new TenantConfigModelError(
        "validation_error",
        `Opportunity intake template references unknown typology: ${template.typologyKey}`
      );
    }
    if (template.active && !typology.active) {
      throw new TenantConfigModelError(
        "validation_error",
        `Opportunity intake template references inactive typology: ${template.typologyKey}`
      );
    }

    if (template.active) {
      const pairKey = `${template.categoryKey}/${template.typologyKey}`;
      if (activeTemplatePairs.has(pairKey)) {
        throw new TenantConfigModelError(
          "conflict",
          `Duplicate active opportunity intake template for ${pairKey}`
        );
      }
      activeTemplatePairs.add(pairKey);
    }

    for (const customFieldKey of template.requiredCustomFieldKeys) {
      const customField = customFieldByKey.get(customFieldKey);
      if (customField === undefined) {
        throw new TenantConfigModelError(
          "validation_error",
          `Opportunity intake template references unknown custom field: ${customFieldKey}`
        );
      }
      if (!customField.active) {
        throw new TenantConfigModelError(
          "validation_error",
          `Opportunity intake template requires inactive custom field: ${customFieldKey}`
        );
      }
    }
  }

  return {
    tenantId,
    version: requirePositiveInteger(input.version, "opportunityIntakeMetadata.version"),
    categories,
    typologies,
    customFields,
    templates,
    updatedAt: requireValidTimestamp(input.updatedAt, "opportunityIntakeMetadata.updatedAt")
  };
}

export function resolveOpportunityIntakeRequirements(
  registry: OpportunityIntakeMetadataRegistry,
  input: {
    categoryKey: string;
    typologyKey: string;
  }
): OpportunityIntakeRequirements {
  const categoryKey = requireSystemKey(input.categoryKey, "opportunityIntakeRequirements.categoryKey");
  const typologyKey = requireSystemKey(input.typologyKey, "opportunityIntakeRequirements.typologyKey");
  const category = registry.categories.find((item) => item.key === categoryKey && item.active);
  if (category === undefined) {
    throw new TenantConfigModelError("validation_error", `Opportunity category is not configured or active: ${categoryKey}`);
  }
  const typology = registry.typologies.find((item) => item.key === typologyKey && item.active);
  if (typology === undefined) {
    throw new TenantConfigModelError("validation_error", `Opportunity typology is not configured or active: ${typologyKey}`);
  }
  const template = registry.templates.find(
    (item) => item.categoryKey === categoryKey && item.typologyKey === typologyKey && item.active
  );
  if (template === undefined) {
    throw new TenantConfigModelError(
      "validation_error",
      `Opportunity intake template is not configured for ${categoryKey}/${typologyKey}`
    );
  }
  const customFieldByKey = new Map(registry.customFields.map((field) => [field.key, field]));

  return {
    tenantId: registry.tenantId,
    registryVersion: registry.version,
    templateKey: template.key,
    templateLabel: template.label,
    category: {
      key: category.key,
      label: category.label
    },
    typology: {
      key: typology.key,
      label: typology.label
    },
    requiredStandardFieldKeys: [...template.requiredStandardFieldKeys],
    requiredCustomFields: template.requiredCustomFieldKeys.map((key) => {
      const field = customFieldByKey.get(key);
      if (field === undefined || !field.active) {
        throw new TenantConfigModelError("validation_error", `Opportunity intake custom field is not active: ${key}`);
      }

      return {
        definitionId: field.id,
        key: field.key,
        label: field.label,
        valueType: field.valueType
      };
    }),
    trace: [
      `opportunity_intake_metadata:registry:${registry.version}`,
      `opportunity_intake_metadata:template:${template.key}`
    ]
  };
}

export function createCustomFieldRegistry(input: {
  tenantId: TenantId;
  version: number;
  definitions: CustomFieldDefinition[];
  updatedAt: string;
}): CustomFieldRegistry {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const definitions = input.definitions.map((definition) =>
    createCustomFieldDefinition({
      ...definition,
      ...(definition.validationRules !== undefined ? { validationRules: definition.validationRules } : {}),
      ...(definition.visibilityRules !== undefined ? { visibilityRules: definition.visibilityRules } : {}),
      ...(definition.permissionRules !== undefined ? { permissionRules: definition.permissionRules } : {})
    })
  );
  const seenTargetKeys = new Set<string>();

  for (const definition of definitions) {
    if (definition.tenantId !== tenantId) {
      throw new TenantConfigModelError("validation_error", `Custom field definition tenant mismatch: ${definition.id}`);
    }

    const targetKey = `${definition.targetEntityType}:${definition.key}`;
    if (seenTargetKeys.has(targetKey)) {
      throw new TenantConfigModelError(
        "conflict",
        `Duplicate custom field key for ${definition.targetEntityType}: ${definition.key}`
      );
    }
    seenTargetKeys.add(targetKey);
  }

  return {
    tenantId,
    version: requirePositiveInteger(input.version, "customFieldRegistry.version"),
    definitions,
    updatedAt: requireValidTimestamp(input.updatedAt, "customFieldRegistry.updatedAt")
  };
}

export function updateCustomFieldDefinitionMetadata(
  current: CustomFieldDefinition,
  input: {
    expectedVersion: number;
    label?: string;
    required?: boolean;
    active?: boolean;
    validationRules?: Record<string, CustomFieldMetadataValue>;
    visibilityRules?: CustomFieldVisibilityRule[];
    permissionRules?: CustomFieldPermissionRules;
    bindingFlags?: CustomFieldBindingFlags;
    updatedAt: string;
  }
): CustomFieldDefinitionUpdateResult {
  const currentVersion = requirePositiveInteger(current.version, "customField.version");
  const expectedVersion = requirePositiveInteger(input.expectedVersion, "expectedVersion");

  if (expectedVersion !== currentVersion) {
    throw new TenantConfigModelError(
      "conflict",
      `Custom field definition version conflict: expected ${expectedVersion}, current ${currentVersion}`
    );
  }

  return {
    previousVersion: currentVersion,
    definition: createCustomFieldDefinition({
      ...current,
      label: input.label ?? current.label,
      required: input.required ?? current.required,
      active: input.active ?? current.active,
      version: currentVersion + 1,
      ...(input.validationRules !== undefined
        ? { validationRules: input.validationRules }
        : current.validationRules !== undefined
          ? { validationRules: current.validationRules }
          : {}),
      ...(input.visibilityRules !== undefined
        ? { visibilityRules: input.visibilityRules }
        : current.visibilityRules !== undefined
          ? { visibilityRules: current.visibilityRules }
          : {}),
      ...(input.permissionRules !== undefined
        ? { permissionRules: input.permissionRules }
        : current.permissionRules !== undefined
          ? { permissionRules: current.permissionRules }
          : {}),
      bindingFlags: input.bindingFlags ?? current.bindingFlags,
      updatedAt: input.updatedAt
    })
  };
}

export function createTenantLabelSet(input: {
  tenantId: TenantId;
  configurationVersion: number;
  labels: Record<string, string>;
  updatedAt: string;
}): TenantLabelSet {
  return {
    tenantId: requireNonEmptyString(input.tenantId, "tenantId"),
    configurationVersion: requirePositiveInteger(input.configurationVersion, "tenantLabelSet.configurationVersion"),
    labels: normalizeLabels(input.labels),
    updatedAt: requireValidTimestamp(input.updatedAt, "tenantLabelSet.updatedAt")
  };
}

export function resolveTenantLabel(labelSet: TenantLabelSet, key: string, fallbackLabel?: string): string {
  const labelKey = requireNonEmptyString(key, "tenantLabel.key");
  const label = labelSet.labels[labelKey];

  if (label !== undefined) {
    return label;
  }

  if (fallbackLabel !== undefined) {
    return requireNonEmptyString(fallbackLabel, "tenantLabel.fallbackLabel");
  }

  throw new TenantConfigModelError("validation_error", `Tenant label is not configured: ${labelKey}`);
}

export function updateTenantLabel(
  current: TenantLabelSet,
  input: {
    key: string;
    label: string;
    expectedConfigurationVersion: number;
    updatedAt: string;
  }
): TenantLabelUpdateResult {
  const key = requireNonEmptyString(input.key, "tenantLabel.key");
  const afterLabel = requireNonEmptyString(input.label, "tenantLabel.label");
  const expectedConfigurationVersion = requirePositiveInteger(
    input.expectedConfigurationVersion,
    "expectedConfigurationVersion"
  );
  const updatedAt = requireValidTimestamp(input.updatedAt, "tenantLabelSet.updatedAt");
  const currentVersion = requirePositiveInteger(current.configurationVersion, "tenantLabelSet.configurationVersion");

  if (expectedConfigurationVersion !== currentVersion) {
    throw new TenantConfigModelError(
      "conflict",
      `Tenant label configuration version conflict: expected ${expectedConfigurationVersion}, current ${currentVersion}`
    );
  }

  const beforeLabel = current.labels[key] ?? "";
  const nextLabels = {
    ...normalizeLabels(current.labels),
    [key]: afterLabel
  };
  const nextVersion = currentVersion + 1;
  const labelSet = createTenantLabelSet({
    tenantId: current.tenantId,
    configurationVersion: nextVersion,
    labels: nextLabels,
    updatedAt
  });

  return {
    labelSet,
    trace: {
      tenantId: labelSet.tenantId,
      configurationVersion: labelSet.configurationVersion,
      previousConfigurationVersion: currentVersion,
      changedLabel: {
        key,
        beforeLabel,
        afterLabel
      },
      labels: { ...labelSet.labels }
    }
  };
}
