import {
  createActionDefinition,
  type ActionDefinition,
  type ActionExecutionLog
} from "@kiss-pm/action-engine";
import {
  createControlSurfaceDefinition,
  createControlSurfaceReadModel,
  type ControlSurfaceActionSlot,
  type ControlSurfaceDefinition,
  type ControlSurfaceDrilldownTarget,
  type ControlSurfaceReadModel,
  type ControlSurfaceSourceRecord
} from "@kiss-pm/control-surfaces";
import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";

import type { Phase6RuntimeState } from "./phase6Runtime";
import type { Phase7RuntimeState } from "./phase7Runtime";

export type Phase8RuntimeState = ReturnType<typeof createPhase8RuntimeState>;

type BuildReadModelInput = {
  tenantId: TenantId;
  surfaceId: string;
  actorPermissionKeys: readonly string[];
  phase6Runtime: Phase6RuntimeState;
  phase7Runtime: Phase7RuntimeState;
  page?: { offset: number; limit: number };
  isActionAllowed?: (record: ControlSurfaceSourceRecord, slot: ControlSurfaceActionSlot) => boolean;
  isDrilldownAllowed?: (record: ControlSurfaceSourceRecord, drilldown: ControlSurfaceDrilldownTarget) => boolean;
};

export type Phase8ActionTargetInput = {
  surfaceId: string;
  surfaceKey: string;
  rowId: string;
  entityType: string;
  entityId: string;
};

export type Phase8ActionPreview = {
  id: string;
  tenantId: TenantId;
  actionDefinitionId: string;
  actionKey: string;
  commandType: string;
  target: Phase8ActionTargetInput;
  input: Record<string, unknown>;
  mutatesState: false;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  requiredPermission: string;
  stateVersion: number;
};

type Phase8TenantActionState = {
  previews: Map<string, Phase8ActionPreview>;
  actionExecutions: ActionExecutionLog[];
  version: number;
};

function notFound(message: string): Error & { code: "not_found" } {
  return Object.assign(new Error(message), { code: "not_found" as const });
}

function preconditionFailed(message: string, code = "precondition_failed"): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function notImplemented(message: string): Error & { code: "not_implemented" } {
  return Object.assign(new Error(message), { code: "not_implemented" as const });
}

function clone<T>(value: T): T {
  return structuredClone(value) as T;
}

function requireActionInput(definition: ActionDefinition, input: Record<string, unknown>): void {
  for (const field of definition.inputSchema.fields) {
    const value = input[field.key];
    if (field.required && (value === undefined || value === null || value === "")) {
      throw preconditionFailed(`action input field is required: ${field.key}`, "validation_error");
    }
    if (value === undefined || value === null) continue;
    if (field.valueType === "text" || field.valueType === "date" || field.valueType === "severity" || field.valueType === "entity_ref") {
      if (typeof value !== "string" || value.trim().length === 0) {
        throw preconditionFailed(`action input field must be a string: ${field.key}`, "validation_error");
      }
    } else if (field.valueType === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw preconditionFailed(`action input field must be a number: ${field.key}`, "validation_error");
      }
    } else if (field.valueType === "boolean" && typeof value !== "boolean") {
      throw preconditionFailed(`action input field must be a boolean: ${field.key}`, "validation_error");
    }
  }
}

function actionDefinitions(tenantId: TenantId): ActionDefinition[] {
  return [
    createActionDefinition({
      id: "action-create-corrective-task",
      tenantId,
      key: "create_corrective_action",
      label: "Создать корректирующую задачу",
      description: "Создает каноническую задачу из контрольного сигнала",
      version: 1,
      status: "active",
      targetEntityType: "kpi_signal",
      sourceSurfaceKey: "portfolio.control",
      commandBinding: {
        commandType: "corrective_task.create",
        handlerKey: "project.task.create_corrective",
        targetEntityType: "task",
        resultEntityType: "task"
      },
      requiredPermission: "control.action:write",
      dryRunRequired: false,
      inputSchema: {
        fields: [
          { key: "title", label: "Название", valueType: "text", required: true, summary: true },
          { key: "dueDate", label: "Срок", valueType: "date", required: true, summary: true }
        ]
      },
      auditPolicy: { required: true, includeInputSummary: true, includeBeforeAfter: true },
      createdAt: "2026-05-16T14:20:00.000Z",
      updatedAt: "2026-05-16T14:20:00.000Z"
    }),
    createActionDefinition({
      id: "action-accept-risk",
      tenantId,
      key: "accept_risk",
      label: "Принять риск",
      description: "Фиксирует принятие видимого риска с причиной",
      version: 1,
      status: "active",
      targetEntityType: "kpi_signal",
      sourceSurfaceKey: "portfolio.control",
      commandBinding: {
        commandType: "risk.accept",
        handlerKey: "kpi_signal.accept_risk",
        targetEntityType: "kpi_signal",
        resultEntityType: "action_execution"
      },
      requiredPermission: "risk:accept",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "reason", label: "Причина", valueType: "text", required: true, summary: true },
          { key: "expiresAt", label: "Действует до", valueType: "date", required: false, summary: true }
        ]
      },
      auditPolicy: { required: true, includeInputSummary: true, includeBeforeAfter: true },
      createdAt: "2026-05-16T14:20:00.000Z",
      updatedAt: "2026-05-16T14:20:00.000Z"
    }),
    createActionDefinition({
      id: "action-reassign-resource",
      tenantId,
      key: "reassign_resource",
      label: "Переназначить ресурс",
      description: "Готовит управляемое переназначение перегруженного ресурса",
      version: 1,
      status: "active",
      targetEntityType: "resource_overload",
      sourceSurfaceKey: "portfolio.control",
      commandBinding: {
        commandType: "resource_resolution.reassign_resource",
        handlerKey: "resource.overload.reassign",
        targetEntityType: "resource_overload",
        resultEntityType: "action_execution"
      },
      requiredPermission: "resource.write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "targetResourceProfileId", label: "Новый ресурс", valueType: "text", required: true, summary: true },
          { key: "reason", label: "Причина", valueType: "text", required: true, summary: true }
        ]
      },
      auditPolicy: { required: true, includeInputSummary: true, includeBeforeAfter: true },
      createdAt: "2026-05-16T14:20:00.000Z",
      updatedAt: "2026-05-16T14:20:00.000Z"
    })
  ];
}

function portfolioControlDefinition(tenantId: TenantId): ControlSurfaceDefinition {
  return createControlSurfaceDefinition({
    id: "portfolio-control",
    tenantId,
    key: "portfolio.control",
    label: "Контроль портфеля",
    version: 1,
    status: "active",
    surfaceType: "portfolio",
    dataSource: {
      type: "composite",
      key: "portfolio_operational_signals",
      entityTypes: ["project", "kpi_signal", "resource_overload"],
      traceKeys: ["project.id", "kpiSignal.id", "resourceOverload.id"]
    },
    view: {
      id: "portfolio-control-default-view",
      tenantId,
      surfaceDefinitionId: "portfolio-control",
      key: "default",
      label: "Операционный контроль",
      viewType: "hybrid",
      version: 1,
      fields: [
        {
          id: "portfolio-field-project",
          key: "project_label",
          label: "Проект",
          entityType: "project",
          valueType: "text",
          visible: true,
          sortable: true,
          filterable: true
        },
        {
          id: "portfolio-field-signal",
          key: "signal_label",
          label: "Сигнал",
          entityType: "control_signal",
          valueType: "text",
          visible: true,
          sortable: false,
          filterable: true
        },
        {
          id: "portfolio-field-severity",
          key: "severity",
          label: "Риск",
          entityType: "control_signal",
          valueType: "severity",
          visible: true,
          sortable: true,
          filterable: true
        }
      ],
      widgets: [
        {
          id: "portfolio-widget-critical",
          key: "critical_signal_count",
          label: "Критичные сигналы",
          widgetType: "severity_summary",
          sourceFieldKey: "severity",
          severity: "critical"
        }
      ],
      actionSlots: [
        {
          id: "portfolio-action-corrective",
          key: "create_corrective_action",
          label: "Создать корректирующую задачу",
          actionDefinitionKey: "create_corrective_action",
          slotType: "primary",
          targetEntityType: "control_signal",
          requiredPermission: "control.action:write",
          dryRunRequired: false
        },
        {
          id: "portfolio-action-risk",
          key: "accept_risk",
          label: "Принять риск",
          actionDefinitionKey: "accept_risk",
          slotType: "row",
          targetEntityType: "control_signal",
          requiredPermission: "risk:accept",
          dryRunRequired: true
        },
        {
          id: "portfolio-action-resource-reassign",
          key: "reassign_resource",
          label: "Переназначить ресурс",
          actionDefinitionKey: "reassign_resource",
          slotType: "row",
          targetEntityType: "resource_overload",
          requiredPermission: "resource.write",
          dryRunRequired: true
        }
      ],
      drilldowns: [
        {
          id: "portfolio-drilldown-gantt",
          key: "open_project_gantt",
          label: "Открыть Гантт",
          targetSurfaceKey: "project.gantt",
          targetEntityType: "project",
          routeTemplate: "/projects/:projectId/gantt",
          requiredPermission: "schedule:read"
        }
      ],
      savedViews: [],
      permissionRequirements: {
        read: "control.surface:read",
        actions: ["control.action:write", "risk:accept", "resource.write"],
        audit: "audit.read"
      }
    },
    updatedAt: "2026-05-16T14:00:00.000Z"
  });
}

function kpiRows(tenantId: TenantId, phase7Runtime: Phase7RuntimeState): ControlSurfaceSourceRecord[] {
  return phase7Runtime.listSignals(tenantId).map((signal) => ({
    id: `row-kpi-${signal.id}`,
    tenantId,
    entityType: "kpi_signal",
    entityId: signal.id,
    label: signal.explanation,
    severity: signal.severity,
    explanation: signal.explanation,
    sourceRefs: [
      { entityType: "project", entityId: signal.entityId },
      { entityType: "kpi_signal", entityId: signal.id }
    ],
    fieldValues: {
      project_label: signal.entityId,
      signal_label: signal.explanation,
      severity: signal.severity
    },
    recommendedActionKeys: [...new Set([...signal.recommendedActionKeys, "accept_risk"])],
    drilldownParams: { projectId: signal.entityId },
    policyContext: { projectId: signal.entityId }
  }));
}

function resourceRows(tenantId: TenantId, phase6Runtime: Phase6RuntimeState): ControlSurfaceSourceRecord[] {
  const projection = phase6Runtime.getProjection(tenantId);
  return projection.overloads.map((overload) => {
    const resource = projection.resourceProfiles.find((candidate) => candidate.id === overload.resourceProfileId);
    return {
      id: `row-resource-overload-${overload.resourceProfileId}`,
      tenantId,
      entityType: "resource_overload",
      entityId: overload.id,
      label: resource?.label ?? overload.resourceProfileId,
      severity: overload.severity,
      explanation: `Перегрузка ресурса ${resource?.label ?? overload.resourceProfileId}: ${overload.overloadHours} ч.`,
      sourceRefs: [{ entityType: "resource_overload", entityId: overload.id }],
      fieldValues: {
        project_label: overload.affectedProjectIds[0] ?? overload.resourceProfileId,
        signal_label: `Перегрузка ${overload.overloadHours} ч.`,
        severity: overload.severity
      },
      recommendedActionKeys: overload.recommendedActionKeys,
      drilldownParams: { projectId: overload.affectedProjectIds[0] ?? "" },
      policyContext: { projectId: overload.affectedProjectIds[0] }
    };
  });
}

export function createPhase8RuntimeState() {
  const actionStates = new Map<string, Phase8TenantActionState>();

  function actionState(tenantId: TenantId): Phase8TenantActionState {
    const existing = actionStates.get(tenantId);
    if (existing !== undefined) return existing;
    const next: Phase8TenantActionState = { previews: new Map(), actionExecutions: [], version: 1 };
    actionStates.set(tenantId, next);
    return next;
  }

  function listSurfaces(tenantId: TenantId): ControlSurfaceDefinition[] {
    return [portfolioControlDefinition(tenantId)].map((definition) => clone(definition));
  }

  function getSurface(tenantId: TenantId, surfaceId: string): ControlSurfaceDefinition | undefined {
    return listSurfaces(tenantId).find((surface) => surface.id === surfaceId || surface.key === surfaceId);
  }

  function buildReadModel(input: BuildReadModelInput): ControlSurfaceReadModel {
    const definition = getSurface(input.tenantId, input.surfaceId);
    if (definition === undefined) {
      throw notFound("control surface not found");
    }

    return createControlSurfaceReadModel({
      definition,
      records: [
        ...kpiRows(input.tenantId, input.phase7Runtime),
        ...resourceRows(input.tenantId, input.phase6Runtime)
      ],
      actorPermissionKeys: input.actorPermissionKeys,
      page: input.page ?? { offset: 0, limit: 50 },
      ...(input.isActionAllowed !== undefined ? { isActionAllowed: input.isActionAllowed } : {}),
      ...(input.isDrilldownAllowed !== undefined ? { isDrilldownAllowed: input.isDrilldownAllowed } : {})
    });
  }

  function listActionDefinitions(tenantId: TenantId, surfaceId?: string): ActionDefinition[] {
    const surface = surfaceId !== undefined ? getSurface(tenantId, surfaceId) : undefined;
    if (surfaceId !== undefined && surface === undefined) throw notFound("control surface not found");
    return actionDefinitions(tenantId)
      .filter((definition) => surface === undefined || definition.sourceSurfaceKey === surface.key)
      .map((definition) => clone(definition));
  }

  function getActionDefinition(tenantId: TenantId, actionDefinitionId: string): ActionDefinition {
    const definition = actionDefinitions(tenantId).find(
      (candidate) => candidate.id === actionDefinitionId || candidate.key === actionDefinitionId
    );
    if (definition === undefined) throw notFound("action definition not found");
    return clone(definition);
  }

  function getActionPreview(tenantId: TenantId, previewId: string): Phase8ActionPreview | undefined {
    const preview = actionState(tenantId).previews.get(previewId);
    return preview ? clone(preview) : undefined;
  }

  function sourceRecords(tenantId: TenantId, phase6Runtime: Phase6RuntimeState, phase7Runtime: Phase7RuntimeState) {
    return [...kpiRows(tenantId, phase7Runtime), ...resourceRows(tenantId, phase6Runtime)];
  }

  function findTargetRecord(input: {
    tenantId: TenantId;
    target: Phase8ActionTargetInput;
    phase6Runtime: Phase6RuntimeState;
    phase7Runtime: Phase7RuntimeState;
  }): ControlSurfaceSourceRecord {
    const surface = getSurface(input.tenantId, input.target.surfaceId);
    if (surface === undefined || surface.key !== input.target.surfaceKey) {
      throw notFound("control surface not found");
    }
    const record = sourceRecords(input.tenantId, input.phase6Runtime, input.phase7Runtime).find(
      (candidate) =>
        candidate.id === input.target.rowId &&
        candidate.entityId === input.target.entityId &&
        candidate.entityType === input.target.entityType
    );
    if (record === undefined) throw notFound("action target not found");
    return record;
  }

  function getActionTargetPolicyContext(input: {
    tenantId: TenantId;
    target: Phase8ActionTargetInput;
    phase6Runtime: Phase6RuntimeState;
    phase7Runtime: Phase7RuntimeState;
  }) {
    const record = findTargetRecord(input);
    return {
      entityType: record.entityType,
      entityId: record.entityId,
      tenantId: record.tenantId,
      ...(record.policyContext?.ownerId !== undefined ? { ownerId: record.policyContext.ownerId } : {}),
      ...(record.policyContext?.projectId !== undefined ? { projectId: record.policyContext.projectId } : {}),
      contextRefs: {
        projectIds: [record.policyContext?.projectId].filter((projectId): projectId is string => projectId !== undefined)
      }
    };
  }

  function previewAction(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    actionDefinitionId: string;
    target: Phase8ActionTargetInput;
    commandInput: Record<string, unknown>;
    phase6Runtime: Phase6RuntimeState;
    phase7Runtime: Phase7RuntimeState;
  }): Phase8ActionPreview {
    const definition = getActionDefinition(input.tenantId, input.actionDefinitionId);
    const record = findTargetRecord({ ...input, target: input.target });
    requireActionInput(definition, input.commandInput);
    if (!record.recommendedActionKeys.includes(definition.key)) {
      throw preconditionFailed("action is not recommended for target");
    }
    const state = actionState(input.tenantId);
    const preview: Phase8ActionPreview = {
      id: `preview-p8-${state.version}-${state.previews.size + 1}`,
      tenantId: input.tenantId,
      actionDefinitionId: definition.id,
      actionKey: definition.key,
      commandType: definition.commandBinding.commandType,
      target: clone(input.target),
      input: clone(input.commandInput),
      mutatesState: false,
      before: { targetStatus: "open" },
      after: { status: "would_execute", commandType: definition.commandBinding.commandType },
      requiredPermission: definition.requiredPermission,
      stateVersion: state.version
    };
    state.previews.set(preview.id, clone(preview));
    return clone(preview);
  }

  function executeAction(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    actionDefinitionId: string;
    target?: Phase8ActionTargetInput;
    commandInput?: Record<string, unknown>;
    previewId?: string;
    phase6Runtime: Phase6RuntimeState;
    phase7Runtime: Phase7RuntimeState;
    permissionTrace: string[];
  }) {
    const state = actionState(input.tenantId);
    const definition = getActionDefinition(input.tenantId, input.actionDefinitionId);
    const preview = input.previewId !== undefined ? state.previews.get(input.previewId) : undefined;
    if (input.previewId !== undefined && preview === undefined) {
      throw preconditionFailed("action preview is missing or stale", "stale_preview");
    }
    if (definition.dryRunRequired && preview === undefined) {
      throw preconditionFailed("dry-run preview is required", "dry_run_required");
    }
    if (preview !== undefined && (preview.actionDefinitionId !== definition.id || preview.stateVersion !== state.version)) {
      throw preconditionFailed("action preview is stale", "stale_preview");
    }
    const target = preview?.target ?? input.target;
    if (target === undefined) throw preconditionFailed("action target is required", "validation_error");
    findTargetRecord({ tenantId: input.tenantId, target, phase6Runtime: input.phase6Runtime, phase7Runtime: input.phase7Runtime });
    const commandInput = preview?.input ?? input.commandInput ?? {};
    requireActionInput(definition, commandInput);
    throw notImplemented(`Action binding is not implemented yet: ${definition.commandBinding.commandType}`);
  }

  function getActionExecution(tenantId: TenantId, executionId: string): ActionExecutionLog | undefined {
    const found = actionState(tenantId).actionExecutions.find((execution) => execution.id === executionId);
    return found ? clone(found) : undefined;
  }

  function listActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return actionState(tenantId).actionExecutions.map((execution) => clone(execution));
  }

  return {
    listSurfaces,
    getSurface,
    buildReadModel,
    listActionDefinitions,
    getActionDefinition,
    getActionPreview,
    getActionTargetPolicyContext,
    previewAction,
    executeAction,
    getActionExecution,
    listActionExecutions
  };
}
