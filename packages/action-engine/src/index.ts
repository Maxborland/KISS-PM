import type { ActorContext, TenantId, TenantOwned } from "@kiss-pm/domain-core";
import { createProjectDraftFromOpportunity } from "@kiss-pm/project-core";
import type {
  ProjectDraft,
  ProjectDraftDemandSnapshot,
  ProjectDraftFeasibilitySnapshot,
  ProjectDraftSourceOpportunity,
  ProjectDraftTemplateSnapshot
} from "@kiss-pm/project-core";

export const packageName = "@kiss-pm/action-engine";

export type ActionExecutionStatus = "succeeded" | "failed" | "denied";
export type ActionDefinitionStatus = "draft" | "active" | "archived";
export type ActionInputValueType = "text" | "number" | "date" | "boolean" | "severity" | "entity_ref";

export type ActionEntityRef = {
  entityType: string;
  entityId: string;
};

export type ActionInputFieldDefinition = {
  key: string;
  label: string;
  valueType: ActionInputValueType;
  required: boolean;
  summary: boolean;
};

export type ActionInputSchema = {
  fields: readonly ActionInputFieldDefinition[];
};

export type ActionCommandBinding = {
  commandType: string;
  handlerKey: string;
  targetEntityType: string;
  resultEntityType?: string;
};

export type ActionCommandBindingRegistry = {
  resolveByHandler(handlerKey: string): ActionCommandBinding | undefined;
  resolveByCommandType(commandType: string): ActionCommandBinding | undefined;
  validateDefinition(definition: ActionDefinition): string[];
};

export type ActionAuditPolicy = {
  required: boolean;
  includeInputSummary: boolean;
  includeBeforeAfter: boolean;
};

export type ActionDefinition = TenantOwned & {
  id: string;
  key: string;
  label: string;
  description: string;
  version: number;
  status: ActionDefinitionStatus;
  targetEntityType: string;
  sourceSurfaceKey: string;
  commandBinding: ActionCommandBinding;
  requiredPermission: string;
  dryRunRequired: boolean;
  inputSchema: ActionInputSchema;
  auditPolicy: ActionAuditPolicy;
  createdAt: string;
  updatedAt: string;
};

export type ActionFormFieldConfig = {
  fieldKey: string;
  label?: string;
  defaultValue?: string | number | boolean;
};

export type ActionConfiguration = {
  actionKey: string;
  enabled: boolean;
  formFields: readonly ActionFormFieldConfig[];
};

export type ActionConfigurationSet = TenantOwned & {
  version: number;
  actionConfigs: readonly ActionConfiguration[];
  updatedAt: string;
};

export type ActionConfigurationDraft = {
  actionConfigs: readonly ActionConfiguration[];
  affectedRuntimeSurfaces: readonly string[];
};

export type ActionConfigurationPublishPreview = TenantOwned & {
  id: string;
  actorId: string;
  mutatesState: false;
  configuration: ActionConfigurationSet;
  before: {
    version: number;
    disabledActionKeys: readonly string[];
  };
  after: {
    version: number;
    disabledActionKeys: readonly string[];
  };
  formChanges: readonly { actionKey: string; fieldKeys: readonly string[] }[];
  affectedRuntimeSurfaces: readonly string[];
  createdAt: string;
};

export type ActionConfigurationPublishAudit = TenantOwned & {
  actorId: string;
  auditEventId: string;
  commandType: "action_configuration.publish";
  beforeVersion: number;
  afterVersion: number;
  disabledActionKeys: readonly string[];
  publishedAt: string;
};

export type ActionConfigurationPublishResult = {
  configuration: ActionConfigurationSet;
  previousConfiguration: ActionConfigurationSet;
  audit: ActionConfigurationPublishAudit;
};

export type ActionSourceSurfaceRef = {
  surfaceId: string;
  surfaceKey: string;
  rowId: string;
  actionSlotKey: string;
};

export type ActionExecutionLog = TenantOwned & {
  id: string;
  actorId: string;
  commandType: string;
  requiredPermission: string;
  status: ActionExecutionStatus;
  source: ActionEntityRef;
  target?: ActionEntityRef;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  correlationId: string;
  sourceSurface?: ActionSourceSurfaceRef;
  inputSummary?: Record<string, unknown>;
  auditEventIds?: string[];
  permissionTrace?: string[];
  preconditionTrace?: string[];
  trace: string[];
};

export type ProjectDraftReadinessSnapshot = {
  ready: boolean;
  nextAction: string;
  trace: string[];
};

export type CreateProjectDraftFromOpportunityCommandInput = {
  actor: ActorContext;
  requiredPermission: "project_draft.create";
  now: string;
  readiness: ProjectDraftReadinessSnapshot;
  sourceOpportunity: ProjectDraftSourceOpportunity;
  processTemplate: ProjectDraftTemplateSnapshot;
  demand: ProjectDraftDemandSnapshot;
  feasibility: ProjectDraftFeasibilitySnapshot;
  existingDraft?: ProjectDraft;
};

export type CreateProjectDraftFromOpportunityCommandResult = {
  projectDraft: ProjectDraft;
  actionExecution: ActionExecutionLog;
};

export class ActionEngineModelError extends Error {
  constructor(
    readonly code: "validation_error" | "tenant_mismatch" | "conflict" | "precondition_failed",
    message: string
  ) {
    super(message);
    this.name = "ActionEngineModelError";
  }
}

const actionStatuses = new Set<ActionDefinitionStatus>(["draft", "active", "archived"]);
const inputValueTypes = new Set<ActionInputValueType>(["text", "number", "date", "boolean", "severity", "entity_ref"]);

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ActionEngineModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new ActionEngineModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ActionEngineModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireBoolean(value: boolean | undefined, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new ActionEngineModelError("validation_error", `${fieldName} must be a boolean`);
  }

  return value;
}

function requireAllowed<T extends string>(value: T | undefined, allowed: ReadonlySet<T>, fieldName: string): T {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new ActionEngineModelError("validation_error", `${fieldName} is invalid`);
  }

  return value;
}

function requireObject<T extends object>(value: T | undefined, fieldName: string): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ActionEngineModelError("validation_error", `${fieldName} must be an object`);
  }

  return value;
}

function requireStringArray(value: string[] | undefined, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new ActionEngineModelError("validation_error", `${fieldName} must be an array`);
  }

  return value.map((entry) => requireNonEmptyString(entry, `${fieldName}[]`));
}

function requireOptionalStringArray(value: string[] | undefined, fieldName: string): string[] | undefined {
  if (value === undefined) return undefined;
  return requireStringArray(value, fieldName);
}

function requireNonEmptyStringArray(value: string[] | undefined, fieldName: string): string[] {
  const items = requireStringArray(value, fieldName);
  if (items.length === 0) {
    throw new ActionEngineModelError("validation_error", `${fieldName} must not be empty`);
  }

  return items;
}

function requireArray<T>(value: readonly T[] | undefined, fieldName: string): readonly T[] {
  if (!Array.isArray(value)) {
    throw new ActionEngineModelError("validation_error", `${fieldName} must be an array`);
  }

  return value;
}

function assertTenant(tenantId: TenantId, entity: TenantOwned, fieldName: string): void {
  if (entity.tenantId !== tenantId) {
    throw new ActionEngineModelError("tenant_mismatch", `${fieldName} tenant mismatch`);
  }
}

function createInputField(input: ActionInputFieldDefinition): ActionInputFieldDefinition {
  return {
    key: requireNonEmptyString(input.key, "actionDefinition.inputField.key"),
    label: requireNonEmptyString(input.label, "actionDefinition.inputField.label"),
    valueType: requireAllowed(input.valueType, inputValueTypes, "actionDefinition.inputField.valueType"),
    required: requireBoolean(input.required, "actionDefinition.inputField.required"),
    summary: requireBoolean(input.summary, "actionDefinition.inputField.summary")
  };
}

function createInputSchema(input: ActionInputSchema): ActionInputSchema {
  const schema = requireObject(input, "actionDefinition.inputSchema");
  const fields = requireArray(schema.fields, "actionDefinition.inputSchema.fields").map(createInputField);
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.key)) {
      throw new ActionEngineModelError("conflict", `Duplicate action input field key: ${field.key}`);
    }
    seen.add(field.key);
  }

  return { fields };
}

function validateDefaultValue(field: ActionInputFieldDefinition, value: string | number | boolean): void {
  if (field.valueType === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ActionEngineModelError("validation_error", `defaultValue for ${field.key} must be a number`);
    }
    return;
  }

  if (field.valueType === "boolean") {
    if (typeof value !== "boolean") {
      throw new ActionEngineModelError("validation_error", `defaultValue for ${field.key} must be a boolean`);
    }
    return;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ActionEngineModelError("validation_error", `defaultValue for ${field.key} must be a string`);
  }
  if (field.valueType === "date" && Number.isNaN(Date.parse(value))) {
    throw new ActionEngineModelError("validation_error", `defaultValue for ${field.key} must be a valid date`);
  }
}

function createActionFormFieldConfig(
  input: ActionFormFieldConfig,
  definition: ActionDefinition
): ActionFormFieldConfig {
  const fieldKey = requireNonEmptyString(input.fieldKey, "actionConfiguration.formField.fieldKey");
  const field = definition.inputSchema.fields.find((candidate) => candidate.key === fieldKey);
  if (field === undefined) {
    throw new ActionEngineModelError("validation_error", `Unknown action form field: ${fieldKey}`);
  }
  if (input.defaultValue !== undefined) {
    validateDefaultValue(field, input.defaultValue);
  }

  return {
    fieldKey,
    ...(input.label !== undefined
      ? { label: requireNonEmptyString(input.label, "actionConfiguration.formField.label") }
      : {}),
    ...(input.defaultValue !== undefined ? { defaultValue: input.defaultValue } : {})
  };
}

function createActionConfiguration(
  input: ActionConfiguration,
  definitionsByKey: ReadonlyMap<string, ActionDefinition>
): ActionConfiguration {
  const actionKey = requireNonEmptyString(input.actionKey, "actionConfiguration.actionKey");
  const definition = definitionsByKey.get(actionKey);
  if (definition === undefined) {
    throw new ActionEngineModelError("validation_error", `Unknown action key: ${actionKey}`);
  }
  const formFields = requireArray(input.formFields, "actionConfiguration.formFields").map((field) =>
    createActionFormFieldConfig(field, definition)
  );
  const seen = new Set<string>();
  for (const field of formFields) {
    if (seen.has(field.fieldKey)) {
      throw new ActionEngineModelError("conflict", `Duplicate action form field: ${field.fieldKey}`);
    }
    seen.add(field.fieldKey);
  }

  return {
    actionKey,
    enabled: requireBoolean(input.enabled, "actionConfiguration.enabled"),
    formFields
  };
}

function definitionsByActionKey(definitions: readonly ActionDefinition[], tenantId: TenantId): Map<string, ActionDefinition> {
  const byKey = new Map<string, ActionDefinition>();
  for (const input of definitions) {
    const definition = createActionDefinition(input);
    assertTenant(tenantId, definition, "actionDefinition");
    if (byKey.has(definition.key)) {
      throw new ActionEngineModelError("conflict", `Duplicate action key: ${definition.key}`);
    }
    byKey.set(definition.key, definition);
  }

  return byKey;
}

function disabledKeys(configuration: ActionConfigurationSet): string[] {
  return configuration.actionConfigs
    .filter((entry) => entry.enabled === false)
    .map((entry) => entry.actionKey)
    .sort();
}

export function createActionConfigurationSet(
  input: ActionConfigurationSet,
  definitions: readonly ActionDefinition[] = []
): ActionConfigurationSet {
  const tenantId = requireNonEmptyString(input.tenantId, "tenantId");
  const definitionMap = definitions.length > 0 ? definitionsByActionKey(definitions, tenantId) : new Map<string, ActionDefinition>();
  const actionConfigs = requireArray(input.actionConfigs, "actionConfigurationSet.actionConfigs").map((entry) => {
    if (definitionMap.size === 0) {
      return {
        actionKey: requireNonEmptyString(entry.actionKey, "actionConfiguration.actionKey"),
        enabled: requireBoolean(entry.enabled, "actionConfiguration.enabled"),
        formFields: requireArray(entry.formFields, "actionConfiguration.formFields").map((field) => ({
          fieldKey: requireNonEmptyString(field.fieldKey, "actionConfiguration.formField.fieldKey"),
          ...(field.label !== undefined ? { label: requireNonEmptyString(field.label, "actionConfiguration.formField.label") } : {}),
          ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {})
        }))
      };
    }

    return createActionConfiguration(entry, definitionMap);
  });
  const seen = new Set<string>();
  for (const config of actionConfigs) {
    if (seen.has(config.actionKey)) {
      throw new ActionEngineModelError("conflict", `Duplicate action configuration key: ${config.actionKey}`);
    }
    seen.add(config.actionKey);
  }

  return {
    tenantId,
    version: requirePositiveInteger(input.version, "actionConfigurationSet.version"),
    actionConfigs,
    updatedAt: requireValidTimestamp(input.updatedAt, "actionConfigurationSet.updatedAt")
  };
}

export function previewActionConfigurationPublish(
  current: ActionConfigurationSet,
  input: {
    id: string;
    actorId: string;
    expectedVersion: number;
    actionDefinitions: readonly ActionDefinition[];
    draft: ActionConfigurationDraft;
    createdAt: string;
  }
): ActionConfigurationPublishPreview {
  const currentConfiguration = createActionConfigurationSet(current);
  if (currentConfiguration.version !== input.expectedVersion) {
    throw new ActionEngineModelError("conflict", "action configuration preview is stale");
  }
  const definitions = definitionsByActionKey(input.actionDefinitions, currentConfiguration.tenantId);
  const draft = requireObject(input.draft, "actionConfigurationDraft");
  const nextConfiguration = createActionConfigurationSet(
    {
      tenantId: currentConfiguration.tenantId,
      version: currentConfiguration.version + 1,
      actionConfigs: requireArray(draft.actionConfigs, "actionConfigurationDraft.actionConfigs").map((entry) =>
        createActionConfiguration(entry, definitions)
      ),
      updatedAt: input.createdAt
    },
    input.actionDefinitions
  );
  const affectedRuntimeSurfaces = requireNonEmptyStringArray(
    [...requireArray(draft.affectedRuntimeSurfaces, "actionConfigurationDraft.affectedRuntimeSurfaces")],
    "actionConfigurationDraft.affectedRuntimeSurfaces"
  );

  return {
    id: requireNonEmptyString(input.id, "actionConfigurationPreview.id"),
    tenantId: currentConfiguration.tenantId,
    actorId: requireNonEmptyString(input.actorId, "actionConfigurationPreview.actorId"),
    mutatesState: false,
    configuration: nextConfiguration,
    before: {
      version: currentConfiguration.version,
      disabledActionKeys: disabledKeys(currentConfiguration)
    },
    after: {
      version: nextConfiguration.version,
      disabledActionKeys: disabledKeys(nextConfiguration)
    },
    formChanges: nextConfiguration.actionConfigs
      .filter((entry) => entry.formFields.length > 0)
      .map((entry) => ({ actionKey: entry.actionKey, fieldKeys: entry.formFields.map((field) => field.fieldKey) })),
    affectedRuntimeSurfaces,
    createdAt: requireValidTimestamp(input.createdAt, "actionConfigurationPreview.createdAt")
  };
}

export function publishActionConfigurationPreview(
  current: ActionConfigurationSet,
  input: {
    preview: ActionConfigurationPublishPreview;
    expectedVersion: number;
    auditEventId: string;
    publishedAt: string;
  }
): ActionConfigurationPublishResult {
  const currentConfiguration = createActionConfigurationSet(current);
  if (
    input.preview.tenantId !== currentConfiguration.tenantId ||
    input.preview.before.version !== currentConfiguration.version ||
    input.expectedVersion !== currentConfiguration.version
  ) {
    throw new ActionEngineModelError("conflict", "action configuration preview is stale");
  }
  const configuration = createActionConfigurationSet({
    ...input.preview.configuration,
    updatedAt: input.publishedAt
  });
  const auditEventId = requireNonEmptyString(input.auditEventId, "actionConfigurationPublish.auditEventId");
  const publishedAt = requireValidTimestamp(input.publishedAt, "actionConfigurationPublish.publishedAt");

  return {
    configuration,
    previousConfiguration: currentConfiguration,
    audit: {
      tenantId: currentConfiguration.tenantId,
      actorId: requireNonEmptyString(input.preview.actorId, "actionConfigurationPublish.actorId"),
      auditEventId,
      commandType: "action_configuration.publish",
      beforeVersion: currentConfiguration.version,
      afterVersion: configuration.version,
      disabledActionKeys: disabledKeys(configuration),
      publishedAt
    }
  };
}

function createCommandBinding(input: ActionCommandBinding): ActionCommandBinding {
  const binding = requireObject(input, "actionDefinition.commandBinding");
  return {
    commandType: requireNonEmptyString(binding.commandType, "actionDefinition.commandBinding.commandType"),
    handlerKey: requireNonEmptyString(binding.handlerKey, "actionDefinition.commandBinding.handlerKey"),
    targetEntityType: requireNonEmptyString(binding.targetEntityType, "actionDefinition.commandBinding.targetEntityType"),
    ...(binding.resultEntityType !== undefined
      ? { resultEntityType: requireNonEmptyString(binding.resultEntityType, "actionDefinition.commandBinding.resultEntityType") }
      : {})
  };
}

function sameBinding(left: ActionCommandBinding, right: ActionCommandBinding): boolean {
  return (
    left.commandType === right.commandType &&
    left.handlerKey === right.handlerKey &&
    left.targetEntityType === right.targetEntityType &&
    left.resultEntityType === right.resultEntityType
  );
}

export function createActionCommandBindingRegistry(bindings: readonly ActionCommandBinding[]): ActionCommandBindingRegistry {
  const byHandler = new Map<string, ActionCommandBinding>();
  const byCommandType = new Map<string, ActionCommandBinding>();

  for (const input of bindings) {
    const binding = createCommandBinding(input);
    if (byHandler.has(binding.handlerKey)) {
      throw new ActionEngineModelError("conflict", `Duplicate action command handler key: ${binding.handlerKey}`);
    }
    if (byCommandType.has(binding.commandType)) {
      throw new ActionEngineModelError("conflict", `Duplicate action command type: ${binding.commandType}`);
    }
    byHandler.set(binding.handlerKey, binding);
    byCommandType.set(binding.commandType, binding);
  }

  return {
    resolveByHandler(handlerKey: string): ActionCommandBinding | undefined {
      const binding = byHandler.get(requireNonEmptyString(handlerKey, "handlerKey"));
      return binding ? structuredClone(binding) : undefined;
    },
    resolveByCommandType(commandType: string): ActionCommandBinding | undefined {
      const binding = byCommandType.get(requireNonEmptyString(commandType, "commandType"));
      return binding ? structuredClone(binding) : undefined;
    },
    validateDefinition(definition: ActionDefinition): string[] {
      const errors = validateActionDefinition(definition);
      if (errors.length > 0) return errors;
      const binding = byHandler.get(definition.commandBinding.handlerKey);
      if (binding === undefined) {
        return ["validation_error: actionDefinition.commandBinding.handlerKey is not registered"];
      }
      if (!sameBinding(binding, definition.commandBinding)) {
        return ["validation_error: actionDefinition.commandBinding does not match registry"];
      }

      return [];
    }
  };
}

function createAuditPolicy(input: ActionAuditPolicy): ActionAuditPolicy {
  const policy = requireObject(input, "actionDefinition.auditPolicy");
  return {
    required: requireBoolean(policy.required, "actionDefinition.auditPolicy.required"),
    includeInputSummary: requireBoolean(policy.includeInputSummary, "actionDefinition.auditPolicy.includeInputSummary"),
    includeBeforeAfter: requireBoolean(policy.includeBeforeAfter, "actionDefinition.auditPolicy.includeBeforeAfter")
  };
}

export function createActionDefinition(input: ActionDefinition): ActionDefinition {
  const definition = requireObject(input, "actionDefinition");
  const commandBinding = createCommandBinding(definition.commandBinding);
  const auditPolicy = createAuditPolicy(definition.auditPolicy);
  const dryRunRequired = requireBoolean(definition.dryRunRequired, "actionDefinition.dryRunRequired");

  if (commandBinding.commandType === "risk.accept" && dryRunRequired !== true) {
    throw new ActionEngineModelError("validation_error", "risk.accept actions must require dry-run");
  }
  if (auditPolicy.required !== true) {
    throw new ActionEngineModelError("validation_error", "actionDefinition.auditPolicy.required must be true");
  }

  return {
    id: requireNonEmptyString(definition.id, "actionDefinition.id"),
    tenantId: requireNonEmptyString(definition.tenantId, "tenantId"),
    key: requireNonEmptyString(definition.key, "actionDefinition.key"),
    label: requireNonEmptyString(definition.label, "actionDefinition.label"),
    description: requireNonEmptyString(definition.description, "actionDefinition.description"),
    version: requirePositiveInteger(definition.version, "actionDefinition.version"),
    status: requireAllowed(definition.status, actionStatuses, "actionDefinition.status"),
    targetEntityType: requireNonEmptyString(definition.targetEntityType, "actionDefinition.targetEntityType"),
    sourceSurfaceKey: requireNonEmptyString(definition.sourceSurfaceKey, "actionDefinition.sourceSurfaceKey"),
    commandBinding,
    requiredPermission: requireNonEmptyString(definition.requiredPermission, "actionDefinition.requiredPermission"),
    dryRunRequired,
    inputSchema: createInputSchema(definition.inputSchema),
    auditPolicy,
    createdAt: requireValidTimestamp(definition.createdAt, "actionDefinition.createdAt"),
    updatedAt: requireValidTimestamp(definition.updatedAt, "actionDefinition.updatedAt")
  };
}

export function validateActionDefinition(input: ActionDefinition): string[] {
  try {
    createActionDefinition(input);
    return [];
  } catch (error) {
    if (error instanceof ActionEngineModelError) {
      return [`${error.code}: ${error.message}`];
    }
    throw error;
  }
}

export function createActionExecutionLog(input: {
  actor: ActorContext;
  commandType: string;
  requiredPermission: string;
  status: ActionExecutionStatus;
  source: ActionEntityRef;
  target?: ActionEntityRef;
  sourceSurface?: ActionSourceSurfaceRef;
  inputSummary?: Record<string, unknown>;
  auditEventIds?: string[];
  permissionTrace?: string[];
  preconditionTrace?: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  trace: string[];
}): ActionExecutionLog {
  const tenantId = requireNonEmptyString(input.actor.tenantId, "actor.tenantId");
  const actorId = requireNonEmptyString(input.actor.actorId, "actor.actorId");
  const correlationId = requireNonEmptyString(input.actor.correlationId, "actor.correlationId");
  const source = requireObject(input.source, "actionExecution.source");
  const target = input.target !== undefined ? requireObject(input.target, "actionExecution.target") : undefined;
  const sourceSurface =
    input.sourceSurface !== undefined ? requireObject(input.sourceSurface, "actionExecution.sourceSurface") : undefined;
  const permissionTrace = requireOptionalStringArray(input.permissionTrace, "actionExecution.permissionTrace");
  const preconditionTrace = requireOptionalStringArray(input.preconditionTrace, "actionExecution.preconditionTrace");
  const auditEventIds = requireOptionalStringArray(input.auditEventIds, "actionExecution.auditEventIds");
  if (sourceSurface !== undefined && (permissionTrace === undefined || permissionTrace.length === 0)) {
    throw new ActionEngineModelError(
      "validation_error",
      "actionExecution.permissionTrace must not be empty for source-surface actions"
    );
  }
  if (
    sourceSurface !== undefined &&
    (input.status === "succeeded" || input.status === "failed") &&
    (preconditionTrace === undefined || preconditionTrace.length === 0)
  ) {
    throw new ActionEngineModelError(
      "validation_error",
      "actionExecution.preconditionTrace must not be empty for source-surface actions"
    );
  }
  if (input.status === "denied" && (permissionTrace === undefined || permissionTrace.length === 0)) {
    throw new ActionEngineModelError("validation_error", "actionExecution.permissionTrace must not be empty for denied actions");
  }
  if (input.status === "failed" && (preconditionTrace === undefined || preconditionTrace.length === 0)) {
    throw new ActionEngineModelError("validation_error", "actionExecution.preconditionTrace must not be empty for failed actions");
  }
  if (
    input.status === "succeeded" &&
    sourceSurface !== undefined &&
    (input.before !== null || input.after !== null) &&
    (auditEventIds === undefined || auditEventIds.length === 0)
  ) {
    throw new ActionEngineModelError(
      "validation_error",
      "actionExecution.auditEventIds must not be empty for state-changing succeeded actions"
    );
  }

  return {
    id: `action-${correlationId}`,
    tenantId,
    actorId,
    commandType: requireNonEmptyString(input.commandType, "actionExecution.commandType"),
    requiredPermission: requireNonEmptyString(input.requiredPermission, "actionExecution.requiredPermission"),
    status: input.status,
    source: {
      entityType: requireNonEmptyString(source.entityType, "actionExecution.source.entityType"),
      entityId: requireNonEmptyString(source.entityId, "actionExecution.source.entityId")
    },
    ...(target !== undefined
      ? {
          target: {
            entityType: requireNonEmptyString(target.entityType, "actionExecution.target.entityType"),
            entityId: requireNonEmptyString(target.entityId, "actionExecution.target.entityId")
          }
        }
      : {}),
    before: input.before === null ? null : structuredClone(input.before),
    after: input.after === null ? null : structuredClone(input.after),
    timestamp: requireValidTimestamp(input.timestamp, "actionExecution.timestamp"),
    correlationId,
    ...(sourceSurface !== undefined
      ? {
          sourceSurface: {
            surfaceId: requireNonEmptyString(sourceSurface.surfaceId, "actionExecution.sourceSurface.surfaceId"),
            surfaceKey: requireNonEmptyString(sourceSurface.surfaceKey, "actionExecution.sourceSurface.surfaceKey"),
            rowId: requireNonEmptyString(sourceSurface.rowId, "actionExecution.sourceSurface.rowId"),
            actionSlotKey: requireNonEmptyString(sourceSurface.actionSlotKey, "actionExecution.sourceSurface.actionSlotKey")
          }
        }
      : {}),
    ...(input.inputSummary !== undefined
      ? { inputSummary: structuredClone(requireObject(input.inputSummary, "actionExecution.inputSummary")) }
      : {}),
    ...(auditEventIds !== undefined ? { auditEventIds: requireNonEmptyStringArray(auditEventIds, "actionExecution.auditEventIds") } : {}),
    ...(permissionTrace !== undefined ? { permissionTrace } : {}),
    ...(preconditionTrace !== undefined ? { preconditionTrace } : {}),
    trace: requireStringArray(input.trace, "actionExecution.trace")
  };
}

function projectDraftSummary(projectDraft: ProjectDraft): Record<string, unknown> {
  return {
    projectDraftId: projectDraft.id,
    status: projectDraft.status,
    sourceOpportunityId: projectDraft.sourceOpportunity.opportunityId,
    processTemplate: {
      templateId: projectDraft.processTemplate.templateId,
      key: projectDraft.processTemplate.key,
      version: projectDraft.processTemplate.version,
      matchConfidence: projectDraft.processTemplate.matchConfidence,
      assumptions: projectDraft.processTemplate.assumptions.map((assumption) => ({ ...assumption }))
    },
    totalPlannedWorkHours: projectDraft.demand.totalPlannedWorkHours,
    feasibilityStatus: projectDraft.feasibility.status
  };
}

export function executeCreateProjectDraftFromOpportunity(
  input: CreateProjectDraftFromOpportunityCommandInput
): CreateProjectDraftFromOpportunityCommandResult {
  const actor = requireObject(input.actor, "projectDraftCommand.actor");
  const tenantId = requireNonEmptyString(actor.tenantId, "actor.tenantId");
  const actorId = requireNonEmptyString(actor.actorId, "actor.actorId");
  const correlationId = requireNonEmptyString(actor.correlationId, "actor.correlationId");
  if (input.requiredPermission !== "project_draft.create") {
    throw new ActionEngineModelError("validation_error", "projectDraftCommand.requiredPermission is invalid");
  }
  assertTenant(tenantId, input.sourceOpportunity, "projectDraftCommand.sourceOpportunity");
  assertTenant(tenantId, input.processTemplate, "projectDraftCommand.processTemplate");
  assertTenant(tenantId, input.demand, "projectDraftCommand.demand");
  assertTenant(tenantId, input.feasibility, "projectDraftCommand.feasibility");
  if (input.existingDraft !== undefined) {
    assertTenant(tenantId, input.existingDraft, "projectDraftCommand.existingDraft");
    throw new ActionEngineModelError("conflict", "Project draft already exists for this opportunity");
  }
  const readiness = requireObject(input.readiness, "projectDraftCommand.readiness");
  if (readiness.ready !== true) {
    throw new ActionEngineModelError("precondition_failed", "Opportunity readiness is not complete");
  }
  if (input.feasibility.status !== "fit") {
    throw new ActionEngineModelError("precondition_failed", "Opportunity feasibility does not allow project draft creation");
  }

  const projectDraft = createProjectDraftFromOpportunity({
    id: `project-draft-${input.sourceOpportunity.opportunityId}`,
    tenantId,
    title: input.sourceOpportunity.title,
    createdBy: actorId,
    createdAt: input.now,
    correlationId,
    sourceOpportunity: input.sourceOpportunity,
    processTemplate: input.processTemplate,
    demand: input.demand,
    feasibility: input.feasibility
  });
  const actionExecution = createActionExecutionLog({
    actor,
    commandType: "project_draft.create_from_opportunity",
    requiredPermission: input.requiredPermission,
    status: "succeeded",
    source: {
      entityType: "opportunity",
      entityId: input.sourceOpportunity.opportunityId
    },
    target: {
      entityType: "projectDraft",
      entityId: projectDraft.id
    },
    before: null,
    after: projectDraftSummary(projectDraft),
    auditEventIds: [`audit-${correlationId}`],
    permissionTrace: ["policy:permission project_draft.create delegated by application service"],
    preconditionTrace: [
      "precondition:opportunity readiness ready",
      "precondition:feasibility fit",
      "precondition:project draft absent"
    ],
    timestamp: input.now,
    trace: [
      "action:permission:project_draft.create",
      ...readiness.trace,
      "action:project_draft:created"
    ]
  });

  return { projectDraft, actionExecution };
}
