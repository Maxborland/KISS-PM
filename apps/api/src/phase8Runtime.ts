import {
  createControlSurfaceDefinition,
  createControlSurfaceReadModel,
  type ControlSurfaceActionSlot,
  type ControlSurfaceDefinition,
  type ControlSurfaceDrilldownTarget,
  type ControlSurfaceReadModel,
  type ControlSurfaceSourceRecord
} from "@kiss-pm/control-surfaces";
import type { TenantId } from "@kiss-pm/domain-core";

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

function notFound(message: string): Error & { code: "not_found" } {
  return Object.assign(new Error(message), { code: "not_found" as const });
}

function clone<T>(value: T): T {
  return structuredClone(value) as T;
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

  return {
    listSurfaces,
    getSurface,
    buildReadModel
  };
}
