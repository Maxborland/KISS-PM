import {
  createActionDefinition,
  createActionExecutionLog,
  type ActionDefinition,
  type ActionExecutionLog
} from "@kiss-pm/action-engine";
import {
  bindCustomProjectFieldsToControlSurfaceDefinition,
  createControlSurfaceDefinition,
  createControlSurfaceReadModel,
  type ControlSurfaceActionSlot,
  type ControlSurfaceDefinition,
  type ControlSurfaceDrilldownTarget,
  type ControlSurfaceReadModel,
  type ControlSurfaceSourceRecord
} from "@kiss-pm/control-surfaces";
import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";
import type { CustomFieldDefinition } from "@kiss-pm/tenant-config";
import type { ManagedProject } from "@kiss-pm/project-core";

import type { Phase4RuntimeState } from "./phase4Runtime";
import type { Phase6RuntimeState } from "./phase6Runtime";
import type { ResourceResolutionCommand } from "./phase6Runtime";
import type { Phase7RuntimeState } from "./phase7Runtime";

export type Phase8RuntimeState = ReturnType<typeof createPhase8RuntimeState>;

type BuildReadModelInput = {
  tenantId: TenantId;
  surfaceId: string;
  actorPermissionKeys: readonly string[];
  phase6Runtime: Phase6RuntimeState;
  phase7Runtime: Phase7RuntimeState;
  customFields?: CustomFieldDefinition[];
  projects?: ManagedProject[];
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
  actorId: TenantUserId;
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
  correctiveLinks: Map<string, { taskId: string; actionExecutionId: string }>;
  signalActionLinks: Map<
    string,
    {
      status: "risk_accepted" | "escalated" | "explanation_requested";
      actionExecutionId: string;
      reason: string;
      expiresAt?: string;
      escalationLevel?: string;
      requestedFrom?: string;
    }
  >;
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

function requireStringInput(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw preconditionFailed(`action input field must be a string: ${key}`, "validation_error");
  }
  return value;
}

function toStableIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
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
      if (field.valueType === "date" && Number.isNaN(Date.parse(value))) {
        throw preconditionFailed(`action input field must be a valid date: ${field.key}`, "validation_error");
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

function resourceCommandFromInput(definition: ActionDefinition, input: Record<string, unknown>): ResourceResolutionCommand {
  if (definition.key === "shift_work") {
    return {
      actionKey: "shift_work",
      assignmentId: requireStringInput(input, "assignmentId"),
      shiftDays: Number(input.shiftDays),
      reason: requireStringInput(input, "reason")
    };
  }

  if (definition.key === "split_work") {
    return {
      actionKey: "split_work",
      assignmentId: requireStringInput(input, "assignmentId"),
      splitHours: Number(input.splitHours),
      reason: requireStringInput(input, "reason")
    };
  }

  if (definition.key === "reassign_resource") {
    return {
      actionKey: "reassign_resource",
      assignmentId: requireStringInput(input, "assignmentId"),
      targetResourceProfileId: requireStringInput(input, "targetResourceProfileId"),
      reason: requireStringInput(input, "reason")
    };
  }

  if (definition.key === "accept_resource_overload") {
    return {
      actionKey: "accept_risk",
      reason: requireStringInput(input, "reason")
    };
  }

  throw preconditionFailed(`resource action binding is not implemented yet: ${definition.key}`);
}

function isResourceResolutionAction(key: string): boolean {
  return key === "shift_work" || key === "split_work" || key === "reassign_resource" || key === "accept_resource_overload";
}

function isSignalAction(key: string): boolean {
  return key === "accept_risk" || key === "escalate" || key === "request_explanation";
}

function requirePreviewAfterString(preview: Phase8ActionPreview, key: string): string {
  const value = preview.after[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw preconditionFailed(`action preview field is missing: ${key}`, "stale_preview");
  }

  return value;
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
      dryRunRequired: true,
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
      id: "action-escalate-signal",
      tenantId,
      key: "escalate",
      label: "Эскалировать",
      description: "Фиксирует эскалацию контрольного сигнала с причиной",
      version: 1,
      status: "active",
      targetEntityType: "kpi_signal",
      sourceSurfaceKey: "portfolio.control",
      commandBinding: {
        commandType: "signal.escalate",
        handlerKey: "control_signal.escalate",
        targetEntityType: "kpi_signal",
        resultEntityType: "action_execution"
      },
      requiredPermission: "control.action:write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "reason", label: "Причина", valueType: "text", required: true, summary: true },
          { key: "escalationLevel", label: "Уровень", valueType: "text", required: true, summary: true }
        ]
      },
      auditPolicy: { required: true, includeInputSummary: true, includeBeforeAfter: true },
      createdAt: "2026-05-16T14:20:00.000Z",
      updatedAt: "2026-05-16T14:20:00.000Z"
    }),
    createActionDefinition({
      id: "action-request-explanation",
      tenantId,
      key: "request_explanation",
      label: "Запросить объяснение",
      description: "Фиксирует запрос объяснения по контрольному сигналу",
      version: 1,
      status: "active",
      targetEntityType: "kpi_signal",
      sourceSurfaceKey: "portfolio.control",
      commandBinding: {
        commandType: "signal.request_explanation",
        handlerKey: "control_signal.request_explanation",
        targetEntityType: "kpi_signal",
        resultEntityType: "action_execution"
      },
      requiredPermission: "control.action:write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "reason", label: "Причина", valueType: "text", required: true, summary: true },
          { key: "requestedFrom", label: "Ответственный", valueType: "text", required: true, summary: true }
        ]
      },
      auditPolicy: { required: true, includeInputSummary: true, includeBeforeAfter: true },
      createdAt: "2026-05-16T14:20:00.000Z",
      updatedAt: "2026-05-16T14:20:00.000Z"
    }),
    createActionDefinition({
      id: "action-shift-resource-work",
      tenantId,
      key: "shift_work",
      label: "Сдвинуть работу",
      description: "Готовит управляемый сдвиг работы из перегруженного периода",
      version: 1,
      status: "active",
      targetEntityType: "resource_overload",
      sourceSurfaceKey: "portfolio.control",
      commandBinding: {
        commandType: "resource_resolution.shift_work",
        handlerKey: "resource.overload.shift_work",
        targetEntityType: "resource_overload",
        resultEntityType: "action_execution"
      },
      requiredPermission: "resource.write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "assignmentId", label: "Назначение", valueType: "text", required: true, summary: true },
          { key: "shiftDays", label: "Дней", valueType: "number", required: true, summary: true },
          { key: "reason", label: "Причина", valueType: "text", required: true, summary: true }
        ]
      },
      auditPolicy: { required: true, includeInputSummary: true, includeBeforeAfter: true },
      createdAt: "2026-05-16T14:20:00.000Z",
      updatedAt: "2026-05-16T14:20:00.000Z"
    }),
    createActionDefinition({
      id: "action-split-resource-work",
      tenantId,
      key: "split_work",
      label: "Разделить работу",
      description: "Готовит управляемое разделение работы для снятия перегрузки",
      version: 1,
      status: "active",
      targetEntityType: "resource_overload",
      sourceSurfaceKey: "portfolio.control",
      commandBinding: {
        commandType: "resource_resolution.split_work",
        handlerKey: "resource.overload.split_work",
        targetEntityType: "resource_overload",
        resultEntityType: "action_execution"
      },
      requiredPermission: "resource.write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
          { key: "assignmentId", label: "Назначение", valueType: "text", required: true, summary: true },
          { key: "splitHours", label: "Часы", valueType: "number", required: true, summary: true },
          { key: "reason", label: "Причина", valueType: "text", required: true, summary: true }
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
          { key: "assignmentId", label: "Назначение", valueType: "text", required: true, summary: true },
          { key: "targetResourceProfileId", label: "Новый ресурс", valueType: "text", required: true, summary: true },
          { key: "reason", label: "Причина", valueType: "text", required: true, summary: true }
        ]
      },
      auditPolicy: { required: true, includeInputSummary: true, includeBeforeAfter: true },
      createdAt: "2026-05-16T14:20:00.000Z",
      updatedAt: "2026-05-16T14:20:00.000Z"
    }),
    createActionDefinition({
      id: "action-accept-resource-overload",
      tenantId,
      key: "accept_resource_overload",
      label: "Принять ресурсный риск",
      description: "Фиксирует принятие ресурсной перегрузки с причиной",
      version: 1,
      status: "active",
      targetEntityType: "resource_overload",
      sourceSurfaceKey: "portfolio.control",
      commandBinding: {
        commandType: "resource_resolution.accept_risk",
        handlerKey: "resource.overload.accept_risk",
        targetEntityType: "resource_overload",
        resultEntityType: "action_execution"
      },
      requiredPermission: "resource.write",
      dryRunRequired: true,
      inputSchema: {
        fields: [
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
        },
        {
          id: "portfolio-field-primary-assignment",
          key: "primary_assignment_id",
          label: "Назначение",
          entityType: "resource_overload",
          valueType: "text",
          visible: true,
          sortable: false,
          filterable: false
        },
        {
          id: "portfolio-field-suggested-resource",
          key: "suggested_resource_profile_id",
          label: "Ресурс для переназначения",
          entityType: "resource_overload",
          valueType: "text",
          visible: true,
          sortable: false,
          filterable: false
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
          dryRunRequired: true
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
          id: "portfolio-action-escalate",
          key: "escalate",
          label: "Эскалировать",
          actionDefinitionKey: "escalate",
          slotType: "row",
          targetEntityType: "control_signal",
          requiredPermission: "control.action:write",
          dryRunRequired: true
        },
        {
          id: "portfolio-action-request-explanation",
          key: "request_explanation",
          label: "Запросить объяснение",
          actionDefinitionKey: "request_explanation",
          slotType: "row",
          targetEntityType: "control_signal",
          requiredPermission: "control.action:write",
          dryRunRequired: true
        },
        {
          id: "portfolio-action-resource-shift",
          key: "shift_work",
          label: "Сдвинуть работу",
          actionDefinitionKey: "shift_work",
          slotType: "row",
          targetEntityType: "resource_overload",
          requiredPermission: "resource.write",
          dryRunRequired: true
        },
        {
          id: "portfolio-action-resource-split",
          key: "split_work",
          label: "Разделить работу",
          actionDefinitionKey: "split_work",
          slotType: "row",
          targetEntityType: "resource_overload",
          requiredPermission: "resource.write",
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
        },
        {
          id: "portfolio-action-resource-risk",
          key: "accept_resource_overload",
          label: "Принять ресурсный риск",
          actionDefinitionKey: "accept_resource_overload",
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

function kpiRows(
  tenantId: TenantId,
  phase7Runtime: Phase7RuntimeState,
  correctiveLinks: Map<string, { taskId: string; actionExecutionId: string }>,
  signalActionLinks: Phase8TenantActionState["signalActionLinks"]
): ControlSurfaceSourceRecord[] {
  return phase7Runtime.listSignals(tenantId).map((signal) => {
    const correctiveLink = correctiveLinks.get(signal.id);
    const signalActionLink = signalActionLinks.get(signal.id);
    const recommendedActionKeys =
      signalActionLink !== undefined
        ? []
        : correctiveLink === undefined
        ? [...new Set([...signal.recommendedActionKeys, "accept_risk"])]
        : [...new Set(signal.recommendedActionKeys.filter((key) => key !== "create_corrective_action").concat("accept_risk"))];
    const sourceRefs: ControlSurfaceSourceRecord["sourceRefs"] = [
      { entityType: "project", entityId: signal.entityId },
      { entityType: "kpi_signal", entityId: signal.id },
      ...(correctiveLink !== undefined ? [{ entityType: "task" as const, entityId: correctiveLink.taskId }] : []),
      ...(signalActionLink !== undefined
        ? [{ entityType: "action_execution" as const, entityId: signalActionLink.actionExecutionId }]
        : [])
    ];
    const handledLabel =
      signalActionLink?.status === "risk_accepted"
        ? `Риск принят: ${signalActionLink.reason}`
        : signalActionLink?.status === "escalated"
          ? `Эскалация создана: ${signalActionLink.reason}`
          : signalActionLink?.status === "explanation_requested"
            ? `Запрошено объяснение: ${signalActionLink.reason}`
            : undefined;

    return {
      id: `row-kpi-${signal.id}`,
      tenantId,
      entityType: "kpi_signal",
      entityId: signal.id,
      label: signal.explanation,
      severity: correctiveLink === undefined && signalActionLink === undefined ? signal.severity : "attention",
      explanation:
        signalActionLink !== undefined
          ? `${signal.explanation}. ${handledLabel}`
          : correctiveLink === undefined
          ? signal.explanation
          : `${signal.explanation}. Корректирующая задача создана: ${correctiveLink.taskId}`,
      sourceRefs,
      fieldValues: {
        project_label: signal.entityId,
        signal_label:
          handledLabel ?? (correctiveLink === undefined ? signal.explanation : `Корректирующая задача: ${correctiveLink.taskId}`),
        severity: correctiveLink === undefined && signalActionLink === undefined ? signal.severity : "attention",
        ...(correctiveLink !== undefined ? { corrective_task_id: correctiveLink.taskId } : {}),
        ...(signalActionLink !== undefined ? { signal_action_status: signalActionLink.status } : {})
      },
      recommendedActionKeys,
      drilldownParams: { projectId: signal.entityId },
      policyContext: { projectId: signal.entityId }
    };
  });
}

function resourceRows(tenantId: TenantId, phase6Runtime: Phase6RuntimeState): ControlSurfaceSourceRecord[] {
  const projection = phase6Runtime.getProjection(tenantId);
  return projection.overloads.map((overload) => {
    const resource = projection.resourceProfiles.find((candidate) => candidate.id === overload.resourceProfileId);
    const assignmentId = overload.sourceRefs.find((sourceRef) => sourceRef.startsWith("assignment:"))?.slice("assignment:".length);
    const reservationId = overload.sourceRefs.find((sourceRef) => sourceRef.startsWith("reservation:"))?.slice("reservation:".length);
    const sourceRefs: ControlSurfaceSourceRecord["sourceRefs"] = [{ entityType: "resource_overload", entityId: overload.id }];
    const suggestedResource = projection.resourceProfiles.find((candidate) => candidate.id !== overload.resourceProfileId);
    const recommendedActionKeys = overload.recommendedActionKeys.map((key) =>
      key === "accept_risk" ? "accept_resource_overload" : key
    );
    return {
      id: `row-resource-overload-${overload.resourceProfileId}`,
      tenantId,
      entityType: "resource_overload",
      entityId: overload.id,
      label: resource?.label ?? overload.resourceProfileId,
      severity: overload.severity,
      explanation: `Перегрузка ресурса ${resource?.label ?? overload.resourceProfileId}: ${overload.overloadHours} ч.`,
      sourceRefs,
      fieldValues: {
        project_label: overload.affectedProjectIds[0] ?? overload.resourceProfileId,
        signal_label: `Перегрузка ${overload.overloadHours} ч.`,
        severity: overload.severity,
        primary_assignment_id: assignmentId ?? null,
        primary_reservation_id: reservationId ?? null,
        suggested_resource_profile_id: suggestedResource?.id ?? null
      },
      recommendedActionKeys,
      drilldownParams: { projectId: overload.affectedProjectIds[0] ?? "" },
      policyContext: { projectId: overload.affectedProjectIds[0] }
    };
  });
}

function projectCustomFieldRows(tenantId: TenantId, projects: ManagedProject[] | undefined): ControlSurfaceSourceRecord[] {
  if (projects === undefined) return [];

  return projects
    .filter((project) => project.tenantId === tenantId && project.customFieldValues.length > 0)
    .map((project) => ({
      id: `row-project-custom-fields-${project.id}`,
      tenantId,
      entityType: "project",
      entityId: project.id,
      label: project.title,
      severity: "attention" as const,
      explanation: "Проект с пользовательскими полями тенанта",
      sourceRefs: [{ entityType: "project" as const, entityId: project.id }],
      fieldValues: {
        project_label: project.title,
        signal_label: "Пользовательские поля проекта",
        severity: "attention" as const
      },
      recommendedActionKeys: [],
      drilldownParams: { projectId: project.id },
      policyContext: { projectId: project.id }
    }));
}

function addProjectCustomFieldValues(
  records: ControlSurfaceSourceRecord[],
  projects: ManagedProject[] | undefined
): ControlSurfaceSourceRecord[] {
  if (projects === undefined || projects.length === 0) return records;
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return records.map((record) => {
    const projectId =
      record.policyContext?.projectId ??
      record.sourceRefs.find((sourceRef) => sourceRef.entityType === "project")?.entityId ??
      (record.entityType === "project" ? record.entityId : undefined);
    const project = projectId === undefined ? undefined : projectById.get(projectId);
    if (project === undefined || project.customFieldValues.length === 0) return record;
    const customFieldValues = Object.fromEntries(
      project.customFieldValues.map((valueRecord) => [
        `custom.${valueRecord.fieldKey}`,
        Array.isArray(valueRecord.value) ? valueRecord.value.join(", ") : valueRecord.value
      ])
    );

    return {
      ...record,
      fieldValues: {
        ...record.fieldValues,
        ...customFieldValues
      }
    };
  });
}

export function createPhase8RuntimeState() {
  const actionStates = new Map<string, Phase8TenantActionState>();

  function actionState(tenantId: TenantId): Phase8TenantActionState {
    const existing = actionStates.get(tenantId);
    if (existing !== undefined) return existing;
    const next: Phase8TenantActionState = {
      previews: new Map(),
      actionExecutions: [],
      correctiveLinks: new Map(),
      signalActionLinks: new Map(),
      version: 1
    };
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
    const baseDefinition = getSurface(input.tenantId, input.surfaceId);
    if (baseDefinition === undefined) {
      throw notFound("control surface not found");
    }
    const definition =
      input.customFields !== undefined && input.customFields.length > 0
        ? bindCustomProjectFieldsToControlSurfaceDefinition(baseDefinition, {
            customFields: input.customFields,
            updatedAt: "2026-08-01T00:00:00.000Z"
          })
        : baseDefinition;
    const records = addProjectCustomFieldValues(
      [
        ...kpiRows(
          input.tenantId,
          input.phase7Runtime,
          actionState(input.tenantId).correctiveLinks,
          actionState(input.tenantId).signalActionLinks
        ),
        ...resourceRows(input.tenantId, input.phase6Runtime),
        ...projectCustomFieldRows(input.tenantId, input.projects)
      ],
      input.projects
    );

    return createControlSurfaceReadModel({
      definition,
      records,
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
    const state = actionState(tenantId);
    return [...kpiRows(tenantId, phase7Runtime, state.correctiveLinks, state.signalActionLinks), ...resourceRows(tenantId, phase6Runtime)];
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
    if (definition.key === "request_explanation" && requireStringInput(input.commandInput, "requestedFrom") !== input.actorId) {
      throw preconditionFailed("request explanation assignee must be the current actor", "validation_error");
    }
    if (!record.recommendedActionKeys.includes(definition.key)) {
      throw preconditionFailed("action is not recommended for target");
    }
    const resourcePreview =
      isResourceResolutionAction(definition.key) && record.entityType === "resource_overload"
        ? input.phase6Runtime.previewResolution(
            input.tenantId,
            input.actorId,
            record.entityId,
            resourceCommandFromInput(definition, input.commandInput)
          )
        : undefined;
    const state = actionState(input.tenantId);
    const preview: Phase8ActionPreview = {
      id: `preview-p8-${state.version}-${state.previews.size + 1}`,
      tenantId: input.tenantId,
      actorId: input.actorId,
      actionDefinitionId: definition.id,
      actionKey: definition.key,
      commandType: definition.commandBinding.commandType,
      target: clone(input.target),
      input: clone(input.commandInput),
      mutatesState: false,
      before:
        resourcePreview === undefined
          ? { targetStatus: "open" }
          : { loadBuckets: resourcePreview.beforeLoadBuckets, command: resourcePreview.command },
      after:
        resourcePreview === undefined
          ? { status: "would_execute", commandType: definition.commandBinding.commandType }
          : {
              status: "would_execute",
              commandType: definition.commandBinding.commandType,
              p6PreviewId: resourcePreview.id,
              afterLoadBuckets: resourcePreview.afterLoadBuckets,
              affectedAssignments: resourcePreview.affectedAssignments,
              affectedReservations: resourcePreview.affectedReservations
            },
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
    phase4Runtime?: Phase4RuntimeState;
    phase6Runtime: Phase6RuntimeState;
    phase7Runtime: Phase7RuntimeState;
    permissionTrace: string[];
  }): ActionExecutionLog {
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
    if (preview !== undefined && preview.actorId !== input.actorId) {
      throw preconditionFailed("action preview belongs to another actor", "stale_preview");
    }
    const target = preview?.target ?? input.target;
    if (target === undefined) throw preconditionFailed("action target is required", "validation_error");
    const record = findTargetRecord({ tenantId: input.tenantId, target, phase6Runtime: input.phase6Runtime, phase7Runtime: input.phase7Runtime });
    if (!record.recommendedActionKeys.includes(definition.key)) {
      throw preconditionFailed("action is not recommended for target");
    }
    const commandInput = preview?.input ?? input.commandInput ?? {};
    requireActionInput(definition, commandInput);
    if (definition.key === "create_corrective_action") {
      if (input.phase4Runtime === undefined) {
        throw notImplemented("Phase 4 runtime is required for corrective task creation");
      }
      if (record.entityType !== "kpi_signal") {
        throw preconditionFailed("corrective action target must be a KPI signal", "precondition_failed");
      }
      const projectId = record.policyContext?.projectId;
      if (projectId === undefined) {
        throw preconditionFailed("corrective action target project is missing", "precondition_failed");
      }
      const project = input.phase4Runtime.getProject(input.tenantId, projectId);
      if (project === undefined) {
        throw preconditionFailed("corrective action target project is not active", "precondition_failed");
      }
      const currentStage = project.stages.find((stage) => stage.id === project.currentStageId);
      const stageTemplate = project.processTemplateSnapshot.stageTemplates.find((stage) => stage.key === currentStage?.templateKey);
      const taskTemplate = stageTemplate?.taskTemplates[0];
      if (currentStage === undefined || taskTemplate === undefined) {
        throw preconditionFailed("corrective action task template is missing", "precondition_failed");
      }
      const taskId = `task-corrective-${toStableIdPart(record.entityId)}-${state.version}`;
      const taskResult = input.phase4Runtime.createTask({
        tenantId: input.tenantId,
        actorId: input.actorId,
        projectId,
        id: taskId,
        stageId: currentStage.id,
        taskTemplateId: taskTemplate.id,
        taskTemplateKey: taskTemplate.key,
        title: requireStringInput(commandInput, "title"),
        dueDate: requireStringInput(commandInput, "dueDate"),
        plannedWorkHours: 4,
        participants: [{ userId: input.actorId, role: "controller" }]
      });
      const correlationId = `p8-corrective-${taskResult.task.id}`;
      const execution: ActionExecutionLog = {
        id: `action-${correlationId}`,
        tenantId: input.tenantId,
        actorId: input.actorId,
        commandType: definition.commandBinding.commandType,
        requiredPermission: definition.requiredPermission,
        status: "succeeded",
        source: { entityType: record.entityType, entityId: record.entityId },
        target: { entityType: "task", entityId: taskResult.task.id },
        before: { signal: { id: record.entityId, status: "open" }, taskCount: project.tasks.length },
        after: {
          task: clone(taskResult.task),
          participants: clone(taskResult.participants),
          projectId
        },
        timestamp: "2026-05-16T15:00:00.000Z",
        correlationId,
        sourceSurface: {
          surfaceId: target.surfaceId,
          surfaceKey: target.surfaceKey,
          rowId: target.rowId,
          actionSlotKey: definition.key
        },
        inputSummary: {
          title: commandInput.title,
          dueDate: commandInput.dueDate
        },
        permissionTrace: [...input.permissionTrace],
        preconditionTrace: [
          "target:kpi_signal",
          `project:${projectId}`,
          `stage:${currentStage.id}`,
          `taskTemplate:${taskTemplate.key}`
        ],
        trace: [
          "control_action:preview confirmed",
          "control_action:canonical task created",
          "control_action:portfolio projection should refetch"
        ]
      };
      state.previews.delete(preview?.id ?? "");
      return clone(execution);
    }
    if (isResourceResolutionAction(definition.key)) {
      if (record.entityType !== "resource_overload") {
        throw preconditionFailed("resource action target must be a resource overload", "precondition_failed");
      }
      if (preview === undefined) {
        throw preconditionFailed("resource action preview is required", "dry_run_required");
      }
      const p6PreviewId = requirePreviewAfterString(preview, "p6PreviewId");
      let result;
      try {
        result = input.phase6Runtime.applyResolution({
          tenantId: input.tenantId,
          actorId: input.actorId,
          ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
          overloadId: record.entityId,
          previewId: p6PreviewId
        });
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "stale_preview") {
          state.previews.delete(preview.id);
        }
        throw error;
      }
      const execution: ActionExecutionLog = {
        id: `action-p8-resource-${state.version}`,
        tenantId: input.tenantId,
        actorId: input.actorId,
        commandType: result.actionExecution.commandType,
        requiredPermission: definition.requiredPermission,
        status: "succeeded",
        source: { entityType: record.entityType, entityId: record.entityId },
        target: result.actionExecution.target,
        before: {
          loadBuckets: result.beforeLoadBuckets,
          command: result.actionExecution.before?.command ?? commandInput
        },
        after: {
          loadBuckets: result.afterLoadBuckets,
          overloadStatus: result.overloadStatus,
          changedAssignmentIds: result.changedAssignmentIds,
          changedReservationIds: result.changedReservationIds
        },
        timestamp: result.actionExecution.timestamp,
        correlationId: `p8-${result.actionExecution.correlationId}`,
        sourceSurface: {
          surfaceId: target.surfaceId,
          surfaceKey: target.surfaceKey,
          rowId: target.rowId,
          actionSlotKey: definition.key
        },
        inputSummary: {
          assignmentId: commandInput.assignmentId,
          targetResourceProfileId: commandInput.targetResourceProfileId,
          reason: commandInput.reason,
          p6ActionExecutionId: result.actionExecution.id
        },
        permissionTrace: [...input.permissionTrace, "resource_resolution:delegated to P6 applyResolution"],
        preconditionTrace: [
          "target:resource_overload",
          `overload:${record.entityId}`,
          `p6Preview:${p6PreviewId}`,
          `p6Status:${result.overloadStatus}`
        ],
        trace: [
          "control_action:resource preview confirmed",
          "control_action:P6 resource resolution applied",
          "control_action:portfolio/resource projections should refetch"
        ]
      };
      state.previews.delete(preview.id);
      return clone(execution);
    }
    if (isSignalAction(definition.key)) {
      if (record.entityType !== "kpi_signal") {
        throw preconditionFailed("signal action target must be a KPI signal", "precondition_failed");
      }
      if (preview === undefined) {
        throw preconditionFailed("signal action preview is required", "dry_run_required");
      }
      if (state.signalActionLinks.has(record.entityId)) {
        throw preconditionFailed("signal already has a handled management action", "precondition_failed");
      }
      const reason = requireStringInput(commandInput, "reason");
      const actionStatus =
        definition.key === "accept_risk"
          ? "risk_accepted"
          : definition.key === "escalate"
            ? "escalated"
            : "explanation_requested";
      const inputSummary: Record<string, unknown> = { reason };
      if (definition.key === "accept_risk" && typeof commandInput.expiresAt === "string") {
        inputSummary.expiresAt = commandInput.expiresAt;
      }
      if (definition.key === "escalate") {
        inputSummary.escalationLevel = requireStringInput(commandInput, "escalationLevel");
      }
      if (definition.key === "request_explanation") {
        inputSummary.requestedFrom = requireStringInput(commandInput, "requestedFrom");
        if (inputSummary.requestedFrom !== input.actorId) {
          throw preconditionFailed("request explanation assignee must be the current actor", "validation_error");
        }
      }
      const correlationId = `p8-${definition.key}-${toStableIdPart(record.entityId)}-${state.version}`;
      const execution: ActionExecutionLog = {
        id: `action-${correlationId}`,
        tenantId: input.tenantId,
        actorId: input.actorId,
        commandType: definition.commandBinding.commandType,
        requiredPermission: definition.requiredPermission,
        status: "succeeded",
        source: { entityType: record.entityType, entityId: record.entityId },
        target: { entityType: record.entityType, entityId: record.entityId },
        before: { signal: { id: record.entityId, status: "open", severity: record.severity } },
        after: {
          signal: {
            id: record.entityId,
            status: actionStatus,
            reason,
            ...(inputSummary.expiresAt !== undefined ? { expiresAt: inputSummary.expiresAt } : {}),
            ...(inputSummary.escalationLevel !== undefined ? { escalationLevel: inputSummary.escalationLevel } : {}),
            ...(inputSummary.requestedFrom !== undefined ? { requestedFrom: inputSummary.requestedFrom } : {})
          }
        },
        timestamp: "2026-05-16T15:10:00.000Z",
        correlationId,
        sourceSurface: {
          surfaceId: target.surfaceId,
          surfaceKey: target.surfaceKey,
          rowId: target.rowId,
          actionSlotKey: definition.key
        },
        inputSummary,
        permissionTrace: [...input.permissionTrace],
        preconditionTrace: [
          "target:kpi_signal",
          `signal:${record.entityId}`,
          `action:${definition.key}`,
          "reason:present"
        ],
        trace: [
          "control_action:preview confirmed",
          `control_action:${definition.commandBinding.commandType} recorded`,
          "control_action:portfolio projection should refetch"
        ]
      };
      state.previews.delete(preview.id);
      return clone(execution);
    }
    throw notImplemented(`Action binding is not implemented yet: ${definition.commandBinding.commandType}`);
  }

  function attachAuditEvent(tenantId: TenantId, execution: ActionExecutionLog, auditEventId: string): ActionExecutionLog {
    const state = actionState(tenantId);
    if (execution.tenantId !== tenantId) throw notFound("action execution not found");
    const next = createActionExecutionLog({
      actor: {
        tenantId: execution.tenantId,
        actorId: execution.actorId,
        correlationId: execution.correlationId
      },
      commandType: execution.commandType,
      requiredPermission: execution.requiredPermission,
      status: execution.status,
      source: execution.source,
      ...(execution.target !== undefined ? { target: execution.target } : {}),
      ...(execution.sourceSurface !== undefined ? { sourceSurface: execution.sourceSurface } : {}),
      ...(execution.inputSummary !== undefined ? { inputSummary: execution.inputSummary } : {}),
      auditEventIds: [auditEventId],
      ...(execution.permissionTrace !== undefined ? { permissionTrace: execution.permissionTrace } : {}),
      ...(execution.preconditionTrace !== undefined ? { preconditionTrace: execution.preconditionTrace } : {}),
      before: execution.before,
      after: execution.after,
      timestamp: execution.timestamp,
      trace: execution.trace
    });
    state.actionExecutions.push(clone(next));
    if (next.commandType === "corrective_task.create" && next.target?.entityType === "task") {
      state.correctiveLinks.set(next.source.entityId, { taskId: next.target.entityId, actionExecutionId: next.id });
    }
    if (
      next.commandType === "risk.accept" ||
      next.commandType === "signal.escalate" ||
      next.commandType === "signal.request_explanation"
    ) {
      const reason = next.inputSummary?.reason;
      if (typeof reason === "string") {
        state.signalActionLinks.set(next.source.entityId, {
          status:
            next.commandType === "risk.accept"
              ? "risk_accepted"
              : next.commandType === "signal.escalate"
                ? "escalated"
                : "explanation_requested",
          actionExecutionId: next.id,
          reason,
          ...(typeof next.inputSummary?.expiresAt === "string" ? { expiresAt: next.inputSummary.expiresAt } : {}),
          ...(typeof next.inputSummary?.escalationLevel === "string" ? { escalationLevel: next.inputSummary.escalationLevel } : {}),
          ...(typeof next.inputSummary?.requestedFrom === "string" ? { requestedFrom: next.inputSummary.requestedFrom } : {})
        });
      }
    }
    state.version += 1;
    return clone(next);
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
    attachAuditEvent,
    getActionExecution,
    listActionExecutions
  };
}
