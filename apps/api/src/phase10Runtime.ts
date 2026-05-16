import { createActionExecutionLog } from "@kiss-pm/action-engine";
import type { ActionExecutionLog } from "@kiss-pm/action-engine";
import {
  previewControlSurfaceLayoutPublish,
  publishControlSurfaceLayoutPreview
} from "@kiss-pm/control-surfaces";
import type {
  ControlSurfaceDefinition,
  ControlSurfaceLayoutDraft,
  ControlSurfaceLayoutPublishAudit,
  ControlSurfaceLayoutPublishPreview,
  ControlSurfaceLayoutPublishResult
} from "@kiss-pm/control-surfaces";
import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";
import {
  previewKpiThresholdRuleSetPublish,
  publishKpiThresholdRuleSetPreview
} from "@kiss-pm/kpi-engine";
import type {
  KpiThresholdRule,
  KpiThresholdRuleSet,
  KpiThresholdRuleSetPublishAudit,
  KpiThresholdRuleSetPublishPreview,
  KpiThresholdRuleSetPublishResult
} from "@kiss-pm/kpi-engine";
import {
  publishProcessTemplatePreview,
  previewProcessTemplatePublish
} from "@kiss-pm/project-core";
import type {
  ProcessTemplate,
  ProcessTemplateBuilderDraft,
  ProcessTemplatePublishAudit,
  ProcessTemplatePublishPreview,
  ProcessTemplatePublishResult
} from "@kiss-pm/project-core";
import {
  createCustomFieldRegistry,
  createTenantLabelSet,
  publishCustomFieldDefinitionPreview,
  publishTenantLabelSetPreview,
  previewCustomFieldDefinitionPublish,
  previewTenantLabelSetPublish
} from "@kiss-pm/tenant-config";
import type {
  CustomFieldDefinitionDraft,
  CustomFieldDefinitionPublishAudit,
  CustomFieldDefinitionPublishPreview,
  CustomFieldDefinitionPublishResult,
  CustomFieldRegistry,
  TenantLabelSet,
  TenantLabelSetPublishAudit,
  TenantLabelSetPublishPreview,
  TenantLabelSetPublishResult
} from "@kiss-pm/tenant-config";

const PHASE10_TIMESTAMP_START = Date.parse("2026-08-01T00:00:00.000Z");

type Phase10TenantState = {
  labelPreviews: Map<string, TenantLabelSetPublishPreview>;
  labelActionExecutions: ActionExecutionLog[];
  processTemplatePreviews: Map<string, ProcessTemplatePublishPreview>;
  processTemplateActionExecutions: ActionExecutionLog[];
  customFieldRegistry: CustomFieldRegistry;
  customFieldPreviews: Map<string, CustomFieldDefinitionPublishPreview>;
  customFieldActionExecutions: ActionExecutionLog[];
  customFieldValueActionExecutions: ActionExecutionLog[];
  kpiThresholdPreviews: Map<string, KpiThresholdRuleSetPublishPreview>;
  kpiThresholdActionExecutions: ActionExecutionLog[];
  layoutDefinitions: Map<string, ControlSurfaceDefinition>;
  layoutPreviousDefinitions: Map<string, ControlSurfaceDefinition[]>;
  layoutPreviews: Map<string, ControlSurfaceLayoutPublishPreview>;
  layoutActionExecutions: ActionExecutionLog[];
};

export type Phase10RuntimeState = ReturnType<typeof createPhase10RuntimeState>;

function clone<T>(value: T): T {
  return structuredClone(value) as T;
}

function stalePreview(message: string): Error & { code: "stale_preview" } {
  return Object.assign(new Error(message), { code: "stale_preview" as const });
}

export function createPhase10RuntimeState() {
  const states = new Map<TenantId, Phase10TenantState>();
  let timestampCounter = 0;

  function now(): string {
    timestampCounter += 1;
    return new Date(PHASE10_TIMESTAMP_START + timestampCounter * 60_000).toISOString();
  }

  function getState(tenantId: TenantId): Phase10TenantState {
    const existing = states.get(tenantId);
    if (existing !== undefined) return existing;
    const next = {
      labelPreviews: new Map<string, TenantLabelSetPublishPreview>(),
      labelActionExecutions: [],
      processTemplatePreviews: new Map<string, ProcessTemplatePublishPreview>(),
      processTemplateActionExecutions: [],
      customFieldRegistry: createCustomFieldRegistry({
        tenantId,
        version: 1,
        definitions: [],
        updatedAt: new Date(PHASE10_TIMESTAMP_START).toISOString()
      }),
      customFieldPreviews: new Map<string, CustomFieldDefinitionPublishPreview>(),
      customFieldActionExecutions: [],
      customFieldValueActionExecutions: [],
      kpiThresholdPreviews: new Map<string, KpiThresholdRuleSetPublishPreview>(),
      kpiThresholdActionExecutions: [],
      layoutDefinitions: new Map<string, ControlSurfaceDefinition>(),
      layoutPreviousDefinitions: new Map<string, ControlSurfaceDefinition[]>(),
      layoutPreviews: new Map<string, ControlSurfaceLayoutPublishPreview>(),
      layoutActionExecutions: []
    };
    states.set(tenantId, next);

    return next;
  }

  function previewLabels(input: {
    labelSet: TenantLabelSet;
    actorId: TenantUserId;
    changes: Array<{ key: string; label: string }>;
    affectedRuntimeSurfaces: string[];
  }): TenantLabelSetPublishPreview {
    const state = getState(input.labelSet.tenantId);
    const preview = previewTenantLabelSetPublish(input.labelSet, {
      id: `preview-tenant-labels-${input.labelSet.tenantId}-${input.labelSet.configurationVersion}-${state.labelPreviews.size + 1}`,
      actorId: input.actorId,
      changes: input.changes,
      affectedRuntimeSurfaces: input.affectedRuntimeSurfaces,
      createdAt: now()
    });
    state.labelPreviews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function publishLabels(input: {
    labelSet: TenantLabelSet;
    actorId: TenantUserId;
    accessProfileId?: string;
    previewId: string;
    auditEventId: string;
  }): TenantLabelSetPublishResult & { actionExecution: ActionExecutionLog } {
    const state = getState(input.labelSet.tenantId);
    const preview = state.labelPreviews.get(input.previewId);
    if (preview === undefined) {
      throw stalePreview("tenant label preview is missing or stale");
    }
    if (preview.actorId !== input.actorId) {
      throw stalePreview("tenant label preview is stale");
    }

    const result = publishTenantLabelSetPreview(input.labelSet, {
      preview,
      expectedConfigurationVersion: input.labelSet.configurationVersion,
      auditEventId: input.auditEventId,
      publishedAt: now()
    });
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.labelSet.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `tenant-labels-${input.labelSet.tenantId}-${input.labelSet.configurationVersion}`
      },
      commandType: "tenant_label_set.publish",
      requiredPermission: "tenant.config.write",
      status: "succeeded",
      source: { entityType: "tenantLabelSet", entityId: input.labelSet.tenantId },
      target: { entityType: "tenantLabelSet", entityId: input.labelSet.tenantId },
      before: {
        configurationVersion: input.labelSet.configurationVersion,
        labels: clone(input.labelSet.labels),
        preview
      },
      after: {
        configurationVersion: result.labelSet.configurationVersion,
        labels: clone(result.labelSet.labels)
      },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      permissionTrace: ["policy:permission tenant.config.write allowed"],
      preconditionTrace: ["precondition:dry-run preview confirmed", "precondition:label keys configured"],
      trace: ["tenant_labels:preview confirmed", "tenant_labels:runtime projection refreshed"]
    });
    state.labelActionExecutions = [...state.labelActionExecutions, actionExecution];
    state.labelPreviews.clear();

    return { ...result, actionExecution: clone(actionExecution) };
  }

  function listLabelActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).labelActionExecutions.map((entry) => clone(entry));
  }

  function previewProcessTemplate(input: {
    template: ProcessTemplate;
    actorId: TenantUserId;
    expectedTemplateVersion: number;
    draft: ProcessTemplateBuilderDraft;
    activeProjectTemplateVersions: number[];
    affectedRuntimeSurfaces: string[];
  }): ProcessTemplatePublishPreview {
    const state = getState(input.template.tenantId);
    const preview = previewProcessTemplatePublish(input.template, {
      id: `preview-process-template-${input.template.tenantId}-${input.template.version}-${state.processTemplatePreviews.size + 1}`,
      actorId: input.actorId,
      expectedTemplateVersion: input.expectedTemplateVersion,
      draft: input.draft,
      activeProjectTemplateVersions: input.activeProjectTemplateVersions,
      affectedRuntimeSurfaces: input.affectedRuntimeSurfaces,
      createdAt: now()
    });
    state.processTemplatePreviews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function publishProcessTemplate(input: {
    template: ProcessTemplate;
    actorId: TenantUserId;
    accessProfileId?: string;
    previewId: string;
    auditEventId: string;
  }): ProcessTemplatePublishResult & { actionExecution: ActionExecutionLog } {
    const state = getState(input.template.tenantId);
    const preview = state.processTemplatePreviews.get(input.previewId);
    if (preview === undefined) {
      throw stalePreview("process template preview is missing or stale");
    }
    if (preview.actorId !== input.actorId || preview.before.templateId !== input.template.id) {
      throw stalePreview("process template preview is stale");
    }

    const result = publishProcessTemplatePreview(input.template, {
      preview,
      expectedTemplateVersion: input.template.version,
      auditEventId: input.auditEventId,
      publishedAt: now()
    });
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.template.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `process-template-${input.template.tenantId}-${input.template.id}-${input.template.version}`
      },
      commandType: "process_template.publish",
      requiredPermission: "project.template.write",
      status: "succeeded",
      source: { entityType: "processTemplate", entityId: input.template.id },
      target: { entityType: "processTemplate", entityId: input.template.id },
      before: {
        templateVersion: input.template.version,
        label: input.template.label,
        preview
      },
      after: {
        templateVersion: result.template.version,
        label: result.template.label,
        activeStageKeys: result.template.stages.filter((stage) => stage.active).map((stage) => stage.key)
      },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      permissionTrace: ["policy:permission project.template.write allowed"],
      preconditionTrace: ["precondition:dry-run preview confirmed", "precondition:existing active projects retain snapshots"],
      trace: ["process_template:preview confirmed", "process_template:future version published"]
    });
    state.processTemplateActionExecutions = [...state.processTemplateActionExecutions, actionExecution];
    state.processTemplatePreviews.clear();

    return { ...result, actionExecution: clone(actionExecution) };
  }

  function listProcessTemplateActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).processTemplateActionExecutions.map((entry) => clone(entry));
  }

  function getCustomFieldRegistry(tenantId: TenantId): CustomFieldRegistry {
    return createCustomFieldRegistry(getState(tenantId).customFieldRegistry);
  }

  function previewCustomField(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    expectedRegistryVersion: number;
    draft: CustomFieldDefinitionDraft;
    affectedRuntimeSurfaces: string[];
  }): CustomFieldDefinitionPublishPreview {
    const state = getState(input.tenantId);
    const preview = previewCustomFieldDefinitionPublish(state.customFieldRegistry, {
      id: `preview-custom-field-${input.tenantId}-${state.customFieldRegistry.version}-${state.customFieldPreviews.size + 1}`,
      actorId: input.actorId,
      expectedRegistryVersion: input.expectedRegistryVersion,
      draft: input.draft,
      affectedRuntimeSurfaces: input.affectedRuntimeSurfaces,
      createdAt: now()
    });
    state.customFieldPreviews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function publishCustomField(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    previewId: string;
    auditEventId: string;
  }): CustomFieldDefinitionPublishResult & { actionExecution: ActionExecutionLog } {
    const state = getState(input.tenantId);
    const preview = state.customFieldPreviews.get(input.previewId);
    if (preview === undefined) {
      throw stalePreview("custom field preview is missing or stale");
    }
    if (preview.actorId !== input.actorId) {
      throw stalePreview("custom field preview is stale");
    }
    const result = publishCustomFieldDefinitionPreview(state.customFieldRegistry, {
      preview,
      expectedRegistryVersion: state.customFieldRegistry.version,
      auditEventId: input.auditEventId,
      publishedAt: now()
    });
    state.customFieldRegistry = createCustomFieldRegistry(result.registry);
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `custom-field-${input.tenantId}-${preview.definition.id}-${preview.before.registryVersion}`
      },
      commandType: "custom_field.publish",
      requiredPermission: "custom_field.write",
      status: "succeeded",
      source: { entityType: "customFieldDefinition", entityId: preview.definition.id },
      target: { entityType: "customFieldDefinition", entityId: preview.definition.id },
      before: {
        registryVersion: preview.before.registryVersion,
        definitionCount: preview.before.definitionCount,
        preview
      },
      after: {
        registryVersion: result.registry.version,
        definitionCount: result.registry.definitions.length,
        fieldKey: preview.definition.key
      },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      permissionTrace: ["policy:permission custom_field.write allowed"],
      preconditionTrace: ["precondition:dry-run preview confirmed", "precondition:control surface binding validated"],
      trace: ["custom_field:preview confirmed", "custom_field:registry published"]
    });
    state.customFieldActionExecutions = [...state.customFieldActionExecutions, actionExecution];
    state.customFieldPreviews.clear();

    return { ...result, actionExecution: clone(actionExecution) };
  }

  function listCustomFieldActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).customFieldActionExecutions.map((entry) => clone(entry));
  }

  function recordProjectCustomFieldValueAction(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    projectId: string;
    fieldKey: string;
    requiredPermission?: string;
    beforeValue: unknown;
    afterValue: unknown;
    auditEventId: string;
  }): ActionExecutionLog {
    const state = getState(input.tenantId);
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `project-custom-field-${input.tenantId}-${input.projectId}-${input.fieldKey}`
      },
      commandType: "project.custom_field.set",
      requiredPermission: input.requiredPermission ?? "custom_field.write",
      status: "succeeded",
      source: { entityType: "project", entityId: input.projectId },
      target: { entityType: "customFieldValue", entityId: `${input.projectId}:${input.fieldKey}` },
      before: { value: input.beforeValue },
      after: { value: input.afterValue },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      permissionTrace: [`policy:permission ${input.requiredPermission ?? "custom_field.write"} allowed`],
      preconditionTrace: ["precondition:custom field definition is active", "precondition:value validation passed"],
      trace: ["project_custom_field:value stored", "control_surface:projection refresh required"]
    });
    state.customFieldValueActionExecutions = [...state.customFieldValueActionExecutions, actionExecution];

    return clone(actionExecution);
  }

  function listCustomFieldValueActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).customFieldValueActionExecutions.map((entry) => clone(entry));
  }

  function previewKpiThreshold(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    thresholdRuleSet: KpiThresholdRuleSet;
    expectedVersion: number;
    rules: KpiThresholdRule[];
    sampleValue: number;
    affectedRuntimeSurfaces: string[];
  }): KpiThresholdRuleSetPublishPreview {
    const state = getState(input.tenantId);
    const preview = previewKpiThresholdRuleSetPublish(input.thresholdRuleSet, {
      id: `preview-kpi-thresholds-${input.tenantId}-${input.thresholdRuleSet.version}-${state.kpiThresholdPreviews.size + 1}`,
      actorId: input.actorId,
      expectedVersion: input.expectedVersion,
      rules: input.rules,
      sampleValue: input.sampleValue,
      affectedRuntimeSurfaces: input.affectedRuntimeSurfaces,
      createdAt: now()
    });
    state.kpiThresholdPreviews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function publishKpiThreshold(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    definitionId: string;
    thresholdRuleSet: KpiThresholdRuleSet;
    previewId: string;
    auditEventId: string;
  }): KpiThresholdRuleSetPublishResult & { actionExecution: ActionExecutionLog } {
    const state = getState(input.tenantId);
    const preview = state.kpiThresholdPreviews.get(input.previewId);
    if (preview === undefined) {
      throw stalePreview("KPI threshold preview is missing or stale");
    }
    if (preview.actorId !== input.actorId || preview.thresholdRuleSet.id !== input.thresholdRuleSet.id) {
      throw stalePreview("KPI threshold preview is stale");
    }
    const result = publishKpiThresholdRuleSetPreview(input.thresholdRuleSet, {
      preview,
      expectedVersion: input.thresholdRuleSet.version,
      auditEventId: input.auditEventId,
      publishedAt: now()
    });
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `kpi-threshold-${input.tenantId}-${input.thresholdRuleSet.id}-${input.thresholdRuleSet.version}`
      },
      commandType: "kpi_threshold.publish",
      requiredPermission: "kpi.config:write",
      status: "succeeded",
      source: { entityType: "kpiDefinition", entityId: input.definitionId },
      target: { entityType: "kpiThresholdRuleSet", entityId: input.thresholdRuleSet.id },
      before: {
        version: input.thresholdRuleSet.version,
        preview
      },
      after: {
        version: result.thresholdRuleSet.version,
        sampleSeverity: preview.after.severity,
        matchedRuleId: preview.after.matchedRuleId
      },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      permissionTrace: ["policy:permission kpi.config:write allowed"],
      preconditionTrace: ["precondition:dry-run preview confirmed", "precondition:future evaluations only"],
      trace: ["kpi_threshold:preview confirmed", "kpi_threshold:future rule set version published"]
    });
    state.kpiThresholdActionExecutions = [...state.kpiThresholdActionExecutions, actionExecution];
    state.kpiThresholdPreviews.clear();

    return { ...result, actionExecution: clone(actionExecution) };
  }

  function getKpiThresholdPreview(tenantId: TenantId, previewId: string): KpiThresholdRuleSetPublishPreview | undefined {
    const preview = getState(tenantId).kpiThresholdPreviews.get(previewId);
    return preview === undefined ? undefined : clone(preview);
  }

  function listKpiThresholdActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).kpiThresholdActionExecutions.map((entry) => clone(entry));
  }

  function getPublishedControlSurfaceLayout(tenantId: TenantId, surfaceId: string): ControlSurfaceDefinition | undefined {
    const state = getState(tenantId);
    const found =
      state.layoutDefinitions.get(surfaceId) ??
      [...state.layoutDefinitions.values()].find((definition) => definition.key === surfaceId);

    return found === undefined ? undefined : clone(found);
  }

  function listPreviousControlSurfaceLayouts(tenantId: TenantId, surfaceId: string): ControlSurfaceDefinition[] {
    const state = getState(tenantId);
    const active = getPublishedControlSurfaceLayout(tenantId, surfaceId);
    const key = active?.id ?? surfaceId;
    return (state.layoutPreviousDefinitions.get(key) ?? []).map((entry) => clone(entry));
  }

  function previewControlSurfaceLayout(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    definition: ControlSurfaceDefinition;
    expectedSurfaceVersion: number;
    draft: ControlSurfaceLayoutDraft;
    affectedRuntimeSurfaces: string[];
  }): ControlSurfaceLayoutPublishPreview {
    const state = getState(input.tenantId);
    const current = state.layoutDefinitions.get(input.definition.id) ?? input.definition;
    const preview = previewControlSurfaceLayoutPublish(current, {
      id: `preview-layout-${input.tenantId}-${current.version}-${state.layoutPreviews.size + 1}`,
      actorId: input.actorId,
      expectedSurfaceVersion: input.expectedSurfaceVersion,
      draft: input.draft,
      affectedRuntimeSurfaces: input.affectedRuntimeSurfaces,
      createdAt: now()
    });
    state.layoutPreviews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function publishControlSurfaceLayout(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    definition: ControlSurfaceDefinition;
    previewId: string;
    auditEventId: string;
  }): ControlSurfaceLayoutPublishResult & { actionExecution: ActionExecutionLog } {
    const state = getState(input.tenantId);
    const preview = state.layoutPreviews.get(input.previewId);
    if (preview === undefined) {
      throw stalePreview("control surface layout preview is missing or stale");
    }
    const current = state.layoutDefinitions.get(input.definition.id) ?? input.definition;
    if (preview.actorId !== input.actorId || preview.surfaceDefinitionId !== current.id) {
      throw stalePreview("control surface layout preview is stale");
    }
    const result = publishControlSurfaceLayoutPreview(current, {
      preview,
      expectedSurfaceVersion: current.version,
      auditEventId: input.auditEventId,
      publishedAt: now()
    });
    state.layoutDefinitions.set(result.definition.id, clone(result.definition));
    state.layoutPreviousDefinitions.set(result.definition.id, [
      ...(state.layoutPreviousDefinitions.get(result.definition.id) ?? []),
      clone(result.previousDefinition)
    ]);
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `layout-${input.tenantId}-${current.id}-${current.version}`
      },
      commandType: "control_surface_layout.publish",
      requiredPermission: "control_surface.config.write",
      status: "succeeded",
      source: { entityType: "controlSurface", entityId: current.id },
      target: { entityType: "savedView", entityId: result.audit.savedViewKey },
      before: {
        surfaceVersion: result.audit.beforeSurfaceVersion,
        viewVersion: result.previousDefinition.view.version,
        preview
      },
      after: {
        surfaceVersion: result.audit.afterSurfaceVersion,
        viewVersion: result.definition.view.version,
        savedViewKey: result.audit.savedViewKey,
        visibleFieldKeys: result.definition.view.fields.filter((field) => field.visible).map((field) => field.key)
      },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      permissionTrace: ["policy:permission control_surface.config.write allowed"],
      preconditionTrace: ["precondition:dry-run preview confirmed", "precondition:layout references validated"],
      trace: ["control_surface_layout:preview confirmed", "control_surface_layout:runtime projection refreshed"]
    });
    state.layoutActionExecutions = [...state.layoutActionExecutions, actionExecution];
    state.layoutPreviews.clear();

    return { ...result, actionExecution: clone(actionExecution) };
  }

  function getControlSurfaceLayoutPreview(
    tenantId: TenantId,
    previewId: string
  ): ControlSurfaceLayoutPublishPreview | undefined {
    const preview = getState(tenantId).layoutPreviews.get(previewId);
    return preview === undefined ? undefined : clone(preview);
  }

  function listLayoutActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).layoutActionExecutions.map((entry) => clone(entry));
  }

  function cloneLabelSet(labelSet: TenantLabelSet): TenantLabelSet {
    return createTenantLabelSet(labelSet);
  }

  return {
    now,
    cloneLabelSet,
    previewLabels,
    publishLabels,
    listLabelActionExecutions,
    previewProcessTemplate,
    publishProcessTemplate,
    listProcessTemplateActionExecutions,
    getCustomFieldRegistry,
    previewCustomField,
    publishCustomField,
    listCustomFieldActionExecutions,
    recordProjectCustomFieldValueAction,
    listCustomFieldValueActionExecutions,
    previewKpiThreshold,
    publishKpiThreshold,
    getKpiThresholdPreview,
    listKpiThresholdActionExecutions,
    getPublishedControlSurfaceLayout,
    listPreviousControlSurfaceLayouts,
    previewControlSurfaceLayout,
    publishControlSurfaceLayout,
    getControlSurfaceLayoutPreview,
    listLayoutActionExecutions
  };
}

export function buildRuntimeLabelProjection(labelSet: TenantLabelSet) {
  const labels = labelSet.labels;
  return {
    roles: [
      {
        key: "project_manager",
        label: labels["runtime.role.project_manager"] ?? labels["role.project_manager"] ?? "Project manager"
      },
      {
        key: "resource_manager",
        label: labels["runtime.role.resource_manager"] ?? labels["role.resource_manager"] ?? "Resource manager"
      },
      {
        key: "executor",
        label: labels["runtime.role.executor"] ?? labels["role.executor"] ?? "Executor"
      }
    ],
    stages: [
      {
        key: "initiation",
        label: labels["runtime.stage.initiation"] ?? "Initiation"
      },
      {
        key: "delivery",
        label: labels["runtime.stage.delivery"] ?? "Delivery"
      }
    ],
    controlSurfaces: [
      {
        key: "portfolio.control",
        label: labels["navigation.portfolio"] ?? "Portfolio"
      },
      {
        key: "resources.load",
        label: labels["navigation.resources"] ?? "Resources"
      }
    ]
  };
}

export function tenantLabelPublishAuditDto(audit: TenantLabelSetPublishAudit) {
  return {
    ...audit,
    changedKeys: [...audit.changedKeys]
  };
}

export function processTemplatePublishAuditDto(audit: ProcessTemplatePublishAudit) {
  return { ...audit };
}

export function customFieldPublishAuditDto(audit: CustomFieldDefinitionPublishAudit) {
  return { ...audit };
}

export function kpiThresholdPublishAuditDto(audit: KpiThresholdRuleSetPublishAudit) {
  return { ...audit };
}

export function controlSurfaceLayoutPublishAuditDto(audit: ControlSurfaceLayoutPublishAudit) {
  return { ...audit };
}
