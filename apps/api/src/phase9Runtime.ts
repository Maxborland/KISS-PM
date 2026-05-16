import { createActionExecutionLog } from "@kiss-pm/action-engine";
import type { ActionExecutionLog } from "@kiss-pm/action-engine";
import {
  createControlSurfaceDefinition,
  createControlSurfaceReadModel
} from "@kiss-pm/control-surfaces";
import type { ControlSurfaceReadAction, ControlSurfaceReadModel } from "@kiss-pm/control-surfaces";
import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";
import {
  applyProcessTemplateImprovementPreview,
  createProcessTemplateConfigurationRef,
  previewProcessTemplateImprovement
} from "@kiss-pm/tenant-config";
import type {
  ImprovedProcessTemplateConfigurationRef,
  ProcessTemplateConfigurationRef,
  ProcessTemplateImprovementPreview
} from "@kiss-pm/tenant-config";
import {
  buildRetrospectiveTrends,
  createClosedProjectSnapshot,
  createRetrospectiveInsights,
  markRetrospectiveInsightHandled,
  readRetrospectiveInsight,
  readClosedProjectSnapshot
} from "../../../packages/retrospectives/src/index";
import type {
  ClosedProjectKpiSummary,
  ClosedProjectResourceSummary,
  ClosedProjectScheduleSummary,
  ClosedProjectSnapshot,
  RetrospectiveInsight,
  RetrospectiveTrend,
  RetrospectiveTrendGroupBy
} from "../../../packages/retrospectives/src/index";
import { evaluateProjectClosureReadiness } from "@kiss-pm/project-core";
import type {
  ClosureChecklist,
  ClosureData,
  ManagedProject,
  ProjectClosureBlocker,
  ProjectClosureBlockerOverride,
  ProjectClosureDecision
} from "@kiss-pm/project-core";

import type { Phase4RuntimeState } from "./phase4Runtime";

const PHASE9_TIMESTAMP_START = Date.parse("2026-07-15T00:00:00.000Z");
const PHASE9_RETROSPECTIVE_GENERATED_AT = "2026-07-15T00:00:00.000Z";

export type Phase9RuntimeState = ReturnType<typeof createPhase9RuntimeState>;

export type Phase9ClosureDataInput = Omit<ClosureData, "tenantId" | "projectId">;

export type Phase9ClosurePreview = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  actorId: TenantUserId;
  stateVersion: number;
  projectFingerprint: string;
  mutatesState: false;
  checklist: ClosureChecklist;
  closureData: ClosureData;
  blockerOverrides: ProjectClosureBlockerOverride[];
  snapshotSummary: {
    projectId: string;
    plannedWorkHours: number;
    taskCount: number;
    lessonCount: number;
  };
  blockers: ProjectClosureBlocker[];
  canApply: boolean;
};

type Phase9TenantState = {
  previews: Map<string, Phase9ClosurePreview>;
  templateImprovementPreviews: Map<string, ProcessTemplateImprovementPreview>;
  snapshots: ClosedProjectSnapshot[];
  closureDecisions: ProjectClosureDecision[];
  handledInsights: Map<string, RetrospectiveInsight>;
  processTemplateVersions: Map<string, ImprovedProcessTemplateConfigurationRef>;
  actionExecutions: ActionExecutionLog[];
  version: number;
};

export type Phase9ClosedPortfolioReadModel = ControlSurfaceReadModel & {
  summary: {
    totalSnapshots: number;
    trendSignalCount: number;
    openInsightCount: number;
  };
  filters: Phase9RetrospectiveFilters;
};

export type Phase9RetrospectiveFilters = {
  templateId?: string;
  clientId?: string;
  period?: string;
};

function clone<T>(value: T): T {
  return structuredClone(value) as T;
}

function daysBetweenInclusive(startDate: string | undefined, finishDate: string | undefined): number | null {
  if (startDate === undefined || finishDate === undefined) return null;
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const finish = Date.parse(`${finishDate}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(finish)) return null;

  return Math.floor((finish - start) / 86_400_000) + 1;
}

function preconditionFailed(message: string): Error & { code: "precondition_failed" } {
  return Object.assign(new Error(message), { code: "precondition_failed" as const });
}

function stalePreview(message: string): Error & { code: "stale_preview" } {
  return Object.assign(new Error(message), { code: "stale_preview" as const });
}

function dryRunRequired(message: string): Error & { code: "dry_run_required" } {
  return Object.assign(new Error(message), { code: "dry_run_required" as const });
}

function notFound(message: string): Error & { code: "not_found" } {
  return Object.assign(new Error(message), { code: "not_found" as const });
}

function closureChecklistForProject(project: ManagedProject): ClosureChecklist {
  return {
    id: `closure-checklist-${project.id}`,
    tenantId: project.tenantId,
    projectId: project.id,
    version: 1,
    requirements: [
      {
        id: `closure-req-${project.id}-final-kpi`,
        tenantId: project.tenantId,
        key: "final_kpi_summary",
        label: "Итог KPI",
        field: "final_kpi_summary",
        required: true
      },
      {
        id: `closure-req-${project.id}-quality`,
        tenantId: project.tenantId,
        key: "quality_score",
        label: "Оценка качества",
        field: "quality_score",
        required: true
      },
      {
        id: `closure-req-${project.id}-client-satisfaction`,
        tenantId: project.tenantId,
        key: "client_satisfaction_score",
        label: "Оценка клиента",
        field: "client_satisfaction_score",
        required: true
      },
      {
        id: `closure-req-${project.id}-closing-summary`,
        tenantId: project.tenantId,
        key: "closing_summary",
        label: "Итоговое резюме",
        field: "closing_summary",
        required: true
      },
      {
        id: `closure-req-${project.id}-lessons`,
        tenantId: project.tenantId,
        key: "lessons_learned",
        label: "Уроки проекта",
        field: "lessons_learned",
        required: true
      }
    ]
  };
}

function closureDataForProject(project: ManagedProject, input: Phase9ClosureDataInput): ClosureData {
  return {
    tenantId: project.tenantId,
    projectId: project.id,
    ...(input.finalKpiSummary !== undefined ? { finalKpiSummary: input.finalKpiSummary } : {}),
    ...(input.qualityScore !== undefined ? { qualityScore: input.qualityScore } : {}),
    ...(input.clientSatisfactionScore !== undefined ? { clientSatisfactionScore: input.clientSatisfactionScore } : {}),
    ...(input.closingSummary !== undefined ? { closingSummary: input.closingSummary } : {}),
    lessonsLearned: input.lessonsLearned ?? []
  };
}

function scheduleSummaryForProject(project: ManagedProject): ClosedProjectScheduleSummary {
  return {
    plannedStartDate: project.sourceOpportunity.plannedStartDate,
    plannedFinishDate: project.sourceOpportunity.desiredFinishDate,
    actualFinishDate: project.updatedAt.slice(0, 10)
  };
}

function resourceSummaryForProject(project: ManagedProject): ClosedProjectResourceSummary {
  const plannedWorkHours = project.tasks.reduce((total, task) => total + task.plannedWorkHours, 0);

  return {
    plannedWorkHours,
    actualWorkHours: plannedWorkHours,
    overloadCount: 0
  };
}

function kpiSummaryForClosure(decision: ProjectClosureDecision): ClosedProjectKpiSummary[] {
  return [
    {
      evaluationId: `kpi-eval-closure-${decision.projectId}`,
      definitionId: "kpi-closure-summary",
      definitionVersion: 1,
      value: decision.closureData.qualityScore ?? 0,
      severity: "none",
      evaluatedAt: decision.closedAt
    }
  ];
}

function closedPortfolioDefinition(tenantId: TenantId) {
  return createControlSurfaceDefinition({
    id: `surface-p9-closed-portfolio-${tenantId}`,
    tenantId,
    key: "retrospectives.closed_portfolio",
    label: "Закрытый портфель",
    version: 1,
    status: "active",
    surfaceType: "portfolio",
    dataSource: {
      type: "composite",
      key: "closed_project_snapshots",
      entityTypes: ["project", "control_signal"],
      traceKeys: ["snapshot.id", "retrospectiveTrend.id", "retrospectiveInsight.id"]
    },
    view: {
      id: `view-p9-closed-portfolio-${tenantId}`,
      tenantId,
      surfaceDefinitionId: `surface-p9-closed-portfolio-${tenantId}`,
      key: "default",
      label: "Закрытый портфель",
      viewType: "hybrid",
      version: 1,
      fields: [
        {
          id: "field-snapshot-id",
          key: "snapshot_id",
          label: "Снимок",
          entityType: "project",
          valueType: "text",
          visible: true,
          sortable: true,
          filterable: true
        },
        {
          id: "field-project-title",
          key: "project_title",
          label: "Проект",
          entityType: "project",
          valueType: "text",
          visible: true,
          sortable: true,
          filterable: true
        },
        {
          id: "field-closed-at",
          key: "closed_at",
          label: "Закрыт",
          entityType: "project",
          valueType: "date",
          visible: true,
          sortable: true,
          filterable: true
        },
        {
          id: "field-planned-work",
          key: "planned_work_hours",
          label: "План, ч",
          entityType: "project",
          valueType: "number",
          visible: true,
          sortable: true,
          filterable: false
        },
        {
          id: "field-actual-work",
          key: "actual_work_hours",
          label: "Факт, ч",
          entityType: "project",
          valueType: "number",
          visible: true,
          sortable: true,
          filterable: false
        },
        {
          id: "field-severity",
          key: "severity",
          label: "Сигнал",
          entityType: "control_signal",
          valueType: "severity",
          visible: true,
          sortable: true,
          filterable: true
        }
      ],
      widgets: [
        {
          id: "widget-critical-trends",
          key: "critical_trend_count",
          label: "Критичные тренды",
          widgetType: "severity_summary",
          sourceFieldKey: "severity",
          severity: "critical"
        },
        {
          id: "widget-attention-trends",
          key: "attention_trend_count",
          label: "Требуют внимания",
          widgetType: "severity_summary",
          sourceFieldKey: "severity",
          severity: "attention"
        }
      ],
      actionSlots: [
        {
          id: "slot-template-improvement",
          key: "prepare_template_improvement",
          label: "Подготовить улучшение шаблона",
          actionDefinitionKey: "template_improvement.prepare",
          slotType: "row",
          targetEntityType: "project",
          requiredPermission: "retrospective.improvement.write",
          dryRunRequired: true
        }
      ],
      drilldowns: [
        {
          id: "drilldown-snapshot",
          key: "open_snapshot",
          label: "Открыть снимок",
          targetSurfaceKey: "retrospectives.snapshot",
          targetEntityType: "project",
          routeTemplate: "/retrospectives/snapshots/:snapshotId",
          requiredPermission: "retrospective.read"
        }
      ],
      savedViews: [
        {
          id: "saved-attention",
          key: "attention_required",
          label: "Сигналы",
          ownerType: "tenant",
          filterKeys: ["severity"],
          sortKeys: ["closed_at"]
        }
      ],
      permissionRequirements: {
        read: "retrospective.read",
        actions: ["retrospective.improvement.write"],
        audit: "audit.read"
      }
    },
    updatedAt: PHASE9_RETROSPECTIVE_GENERATED_AT
  });
}

function actionForInsight(allowed: boolean): ControlSurfaceReadAction {
  return {
    key: "apply_template_improvement",
    label: "Улучшить шаблон",
    actionDefinitionKey: "template_improvement.apply",
    slotType: "primary",
    targetEntityType: "control_signal",
    dryRunRequired: true,
    available: allowed,
    ...(!allowed ? { unavailableReason: "permission_denied" as const } : {})
  };
}

function processTemplateRefFromSnapshot(snapshot: ClosedProjectSnapshot): ProcessTemplateConfigurationRef {
  return createProcessTemplateConfigurationRef({
    id: snapshot.project.processTemplate.templateId,
    tenantId: snapshot.tenantId,
    key: snapshot.project.processTemplate.key,
    label: snapshot.project.processTemplate.label,
    version: snapshot.project.processTemplate.version,
    active: true
  });
}

function filterSnapshots(
  snapshots: readonly ClosedProjectSnapshot[],
  filters: Phase9RetrospectiveFilters | undefined
): ClosedProjectSnapshot[] {
  return snapshots.filter((snapshot) => {
    if (filters?.templateId !== undefined && snapshot.project.processTemplate.templateId !== filters.templateId) {
      return false;
    }
    if (filters?.clientId !== undefined && snapshot.project.sourceOpportunity.accountId !== filters.clientId) {
      return false;
    }
    if (filters?.period !== undefined && snapshot.closure.closedAt.slice(0, 7) !== filters.period) {
      return false;
    }

    return true;
  });
}

function snapshotSummary(project: ManagedProject, closureData: ClosureData) {
  return {
    projectId: project.id,
    plannedWorkHours: project.tasks.reduce((total, task) => total + task.plannedWorkHours, 0),
    taskCount: project.tasks.length,
    lessonCount: closureData.lessonsLearned.length
  };
}

function projectClosureFingerprint(project: ManagedProject): string {
  return JSON.stringify({
    lifecycleStatus: project.lifecycleStatus,
    currentStageId: project.currentStageId,
    updatedAt: project.updatedAt,
    tasks: project.tasks.map((task) => ({
      id: task.id,
      status: task.status,
      plannedWorkHours: task.plannedWorkHours,
      updatedAt: task.updatedAt
    })),
    artifacts: project.artifacts.map((artifact) => ({ id: artifact.id, status: artifact.status })),
    approvals: project.approvalRequests.map((approval) => ({ id: approval.id, status: approval.status }))
  });
}

export function createPhase9RuntimeState() {
  const states = new Map<TenantId, Phase9TenantState>();
  let timestampCounter = 0;

  function now(): string {
    timestampCounter += 1;
    return new Date(PHASE9_TIMESTAMP_START + timestampCounter * 60_000).toISOString();
  }

  function getState(tenantId: TenantId): Phase9TenantState {
    const existing = states.get(tenantId);
    if (existing !== undefined) return existing;
    const next: Phase9TenantState = {
      previews: new Map(),
      templateImprovementPreviews: new Map(),
      snapshots: [],
      closureDecisions: [],
      handledInsights: new Map(),
      processTemplateVersions: new Map(),
      actionExecutions: [],
      version: 1
    };
    states.set(tenantId, next);

    return next;
  }

  function listSnapshots(tenantId: TenantId): ClosedProjectSnapshot[] {
    return getState(tenantId).snapshots.map(readClosedProjectSnapshot);
  }

  function getSnapshot(tenantId: TenantId, snapshotId: string): ClosedProjectSnapshot | undefined {
    const snapshot = getState(tenantId).snapshots.find((candidate) => candidate.id === snapshotId);
    return snapshot === undefined ? undefined : readClosedProjectSnapshot(snapshot);
  }

  function listTrendReadModels(
    tenantId: TenantId,
    input: {
      groupBy: RetrospectiveTrendGroupBy;
      offset: number;
      limit: number;
      filters?: Phase9RetrospectiveFilters;
    }
  ): {
    trends: RetrospectiveTrend[];
    insights: RetrospectiveInsight[];
    pagination: { offset: number; limit: number; total: number };
  } {
    const snapshots = filterSnapshots(listSnapshots(tenantId), input.filters);
    const trends = buildRetrospectiveTrends({ tenantId, snapshots, groupBy: input.groupBy });
    const insights = buildInsightReadModels(tenantId, trends, snapshots);
    const pagedTrends = trends.slice(input.offset, input.offset + input.limit);
    const trendIds = new Set(pagedTrends.map((trend) => trend.id));

    return {
      trends: clone(pagedTrends),
      insights: insights.filter((insight) => trendIds.has(insight.sourceTrendId)).map(readRetrospectiveInsight),
      pagination: { offset: input.offset, limit: input.limit, total: trends.length }
    };
  }

  function getInsight(tenantId: TenantId, insightId: string): RetrospectiveInsight | undefined {
    const snapshots = listSnapshots(tenantId);
    const trends = (["template", "project_type", "client", "period"] as const).flatMap((groupBy) =>
      buildRetrospectiveTrends({ tenantId, snapshots, groupBy })
    );
    const insight = buildInsightReadModels(tenantId, trends, snapshots).find((candidate) => candidate.id === insightId);

    return insight === undefined ? undefined : readRetrospectiveInsight(insight);
  }

  function buildInsightReadModels(
    tenantId: TenantId,
    trends: readonly RetrospectiveTrend[],
    snapshots: readonly ClosedProjectSnapshot[]
  ): RetrospectiveInsight[] {
    const state = getState(tenantId);
    return createRetrospectiveInsights({
      tenantId,
      generatedAt: PHASE9_RETROSPECTIVE_GENERATED_AT,
      trends,
      snapshots
    }).map((insight) => readRetrospectiveInsight(state.handledInsights.get(insight.id) ?? insight));
  }

  function getInsightReadModel(
    tenantId: TenantId,
    insightId: string,
    actorPermissionKeys: readonly string[]
  ): { insight: RetrospectiveInsight; allowedActions: ControlSurfaceReadAction[] } | undefined {
    const insight = getInsight(tenantId, insightId);
    if (insight === undefined) return undefined;

    return {
      insight,
      allowedActions: [
        actionForInsight(
          actorPermissionKeys.includes("retrospective.improvement.write") &&
            actorPermissionKeys.includes("tenant.config.write")
        )
      ]
    };
  }

  function buildClosedPortfolioReadModel(
    tenantId: TenantId,
    input: {
      actorPermissionKeys: readonly string[];
      offset: number;
      limit: number;
      filters?: Phase9RetrospectiveFilters;
    }
  ): Phase9ClosedPortfolioReadModel {
    const snapshots = filterSnapshots(listSnapshots(tenantId), input.filters).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    const trends = buildRetrospectiveTrends({ tenantId, snapshots, groupBy: "template" });
    const insights = buildInsightReadModels(tenantId, trends, snapshots);
    const trendsBySnapshotId = new Map<string, RetrospectiveTrend[]>();
    for (const trend of trends) {
      for (const snapshotId of trend.sourceSnapshotIds) {
        const current = trendsBySnapshotId.get(snapshotId) ?? [];
        trendsBySnapshotId.set(snapshotId, [...current, trend]);
      }
    }
    const insightSnapshotIds = new Set(insights.flatMap((insight) => insight.sourceSnapshotIds));
    const records = snapshots.map((snapshot) => {
      const snapshotTrends = trendsBySnapshotId.get(snapshot.id) ?? [];
      const strongestTrend = snapshotTrends.find((trend) => trend.severity === "critical") ?? snapshotTrends[0];
      const plannedDays = daysBetweenInclusive(snapshot.scheduleSummary.plannedStartDate, snapshot.scheduleSummary.plannedFinishDate);
      const actualDays = daysBetweenInclusive(snapshot.scheduleSummary.plannedStartDate, snapshot.scheduleSummary.actualFinishDate);

      return {
        id: `closed-portfolio-row-${snapshot.id}`,
        tenantId,
        entityType: "project" as const,
        entityId: snapshot.id,
        label: snapshot.project.title,
        severity: strongestTrend?.severity ?? "none",
        explanation:
          strongestTrend === undefined
            ? "Закрытый проект сохранен без ретроспективного сигнала."
            : `Найден повторяющийся тренд ${strongestTrend.trendKey} по ${strongestTrend.occurrenceCount} снимкам.`,
        sourceRefs: [
          { entityType: "project" as const, entityId: snapshot.projectId },
          ...(strongestTrend !== undefined ? [{ entityType: "control_signal" as const, entityId: strongestTrend.id }] : [])
        ],
        fieldValues: {
          snapshot_id: snapshot.id,
          project_title: snapshot.project.title,
          closed_at: snapshot.closure.closedAt,
          planned_work_hours: snapshot.resourceSummary.plannedWorkHours,
          actual_work_hours: snapshot.resourceSummary.actualWorkHours,
          severity: strongestTrend?.severity ?? "none",
          schedule_variance_days:
            plannedDays === null || actualDays === null ? null : Math.round((actualDays - plannedDays) * 100) / 100
        },
        recommendedActionKeys: insightSnapshotIds.has(snapshot.id) ? ["template_improvement.prepare"] : [],
        drilldownParams: { snapshotId: snapshot.id },
        policyContext: { projectId: snapshot.projectId }
      };
    });

    const readModel = createControlSurfaceReadModel({
      definition: closedPortfolioDefinition(tenantId),
      records,
      actorPermissionKeys: input.actorPermissionKeys,
      page: { offset: input.offset, limit: input.limit }
    });

    return {
      ...readModel,
      summary: {
        totalSnapshots: snapshots.length,
        trendSignalCount: trends.length,
        openInsightCount: insights.filter((insight) => insight.status === "open").length
      },
      filters: clone(input.filters ?? {})
    };
  }

  function readClosure(project: ManagedProject) {
    const state = getState(project.tenantId);
    const checklist = closureChecklistForProject(project);
    const emptyClosureData: ClosureData = { tenantId: project.tenantId, projectId: project.id, lessonsLearned: [] };
    const readiness = evaluateProjectClosureReadiness(project, { checklist, closureData: emptyClosureData });
    const snapshots = state.snapshots.filter((snapshot) => snapshot.projectId === project.id).map(readClosedProjectSnapshot);

    return {
      checklist,
      readiness,
      snapshots,
      latestSnapshot: snapshots.at(-1) ?? null
    };
  }

  function previewClosure(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    project: ManagedProject;
    closureData: Phase9ClosureDataInput;
    blockerOverrides?: ProjectClosureBlockerOverride[];
  }): Phase9ClosurePreview {
    const state = getState(input.tenantId);
    const checklist = closureChecklistForProject(input.project);
    const closureData = closureDataForProject(input.project, input.closureData);
    const blockerOverrides = input.blockerOverrides ?? [];
    const readiness = evaluateProjectClosureReadiness(input.project, { checklist, closureData });
    if (!readiness.ok) {
      throw Object.assign(preconditionFailed("project closure blockers remain"), { blockers: readiness.blockers });
    }
    const preview: Phase9ClosurePreview = {
      id: `preview-closure-${input.project.id}-${state.version}-${state.previews.size + 1}`,
      tenantId: input.tenantId,
      projectId: input.project.id,
      actorId: input.actorId,
      stateVersion: state.version,
      projectFingerprint: projectClosureFingerprint(input.project),
      mutatesState: false,
      checklist,
      closureData,
      blockerOverrides,
      snapshotSummary: snapshotSummary(input.project, closureData),
      blockers: [],
      canApply: true
    };
    state.previews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function applyClosure(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    project: ManagedProject;
    previewId?: string;
    phase4Runtime: Phase4RuntimeState;
    auditEventId: string;
  }) {
    validateApplyClosure(input);
    const state = getState(input.tenantId);
    const preview = state.previews.get(input.previewId as string) as Phase9ClosurePreview;
    const beforeProject = clone(input.project);
    const correlationId = `closure-${input.project.id}-${state.version}`;
    const result = input.phase4Runtime.closeProjectWithClosure({
      tenantId: input.tenantId,
      projectId: input.project.id,
      actorId: input.actorId,
      checklist: preview.checklist,
      closureData: preview.closureData,
      closedAt: now(),
      correlationId,
      auditEventId: input.auditEventId,
      blockerOverrides: preview.blockerOverrides
    });
    if (!result.ok) {
      throw Object.assign(preconditionFailed("project closure blockers remain"), { blockers: result.readiness.blockers });
    }
    const snapshot = createClosedProjectSnapshot({
      id: `snapshot-${result.project.id}-${state.snapshots.length + 1}`,
      version: 1,
      capturedAt: now(),
      project: result.project,
      closureDecision: result.closureDecision,
      scheduleSummary: scheduleSummaryForProject(result.project),
      resourceSummary: resourceSummaryForProject(result.project),
      kpiSummary: kpiSummaryForClosure(result.closureDecision)
    });
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId
      },
      commandType: "project.closure.apply",
      requiredPermission: "project.close",
      status: "succeeded",
      source: { entityType: "project", entityId: input.project.id },
      target: { entityType: "closedProjectSnapshot", entityId: snapshot.id },
      before: { project: beforeProject, preview },
      after: { project: result.project, closureDecision: result.closureDecision, snapshot },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      trace: [
        "project_closure:permission project.close allowed",
        "project_closure:preview confirmed",
        "project_closure:snapshot captured"
      ]
    });
    state.snapshots = [...state.snapshots, snapshot];
    state.closureDecisions = [...state.closureDecisions, result.closureDecision];
    state.actionExecutions = [...state.actionExecutions, actionExecution];
    state.version += 1;
    state.previews.clear();

    return {
      project: result.project,
      closureDecision: result.closureDecision,
      snapshot: readClosedProjectSnapshot(snapshot),
      actionExecution: clone(actionExecution)
    };
  }

  function validateApplyClosure(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    project: ManagedProject;
    previewId?: string;
  }): void {
    if (input.previewId === undefined) {
      throw dryRunRequired("closure preview is required");
    }
    const state = getState(input.tenantId);
    const preview = state.previews.get(input.previewId);
    if (preview === undefined || preview.projectId !== input.project.id) {
      throw stalePreview("closure preview is missing or stale");
    }
    if (preview.actorId !== input.actorId || preview.stateVersion !== state.version) {
      throw stalePreview("closure preview is stale");
    }
    if (preview.projectFingerprint !== projectClosureFingerprint(input.project)) {
      throw stalePreview("project changed after closure preview");
    }
    const currentReadiness = evaluateProjectClosureReadiness(input.project, {
      checklist: preview.checklist,
      closureData: preview.closureData
    });
    if (!currentReadiness.ok) {
      throw Object.assign(stalePreview("project closure readiness changed after preview"), { blockers: currentReadiness.blockers });
    }
  }

  function listActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).actionExecutions.map((entry) => clone(entry));
  }

  function currentTemplateForInsight(tenantId: TenantId, insight: RetrospectiveInsight): ProcessTemplateConfigurationRef {
    const state = getState(tenantId);
    const firstSourceSnapshot = state.snapshots.find((snapshot) => snapshot.id === insight.sourceSnapshotIds[0]);
    if (firstSourceSnapshot === undefined) {
      throw notFound("template improvement source snapshot not found");
    }
    const snapshotTemplate = processTemplateRefFromSnapshot(firstSourceSnapshot);
    return state.processTemplateVersions.get(snapshotTemplate.id) ?? snapshotTemplate;
  }

  function previewTemplateImprovement(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    insightId: string;
    improvementKey: string;
    reason: string;
  }): ProcessTemplateImprovementPreview {
    const state = getState(input.tenantId);
    const insight = getInsight(input.tenantId, input.insightId);
    if (insight === undefined) {
      throw notFound("retrospective insight not found");
    }
    if (insight.status !== "open") {
      throw preconditionFailed("retrospective insight is already handled");
    }
    const currentTemplate = currentTemplateForInsight(input.tenantId, insight);
    const preview = previewProcessTemplateImprovement({
      id: `preview-template-improvement-${input.insightId}-${state.version}-${state.templateImprovementPreviews.size + 1}`,
      tenantId: input.tenantId,
      actorId: input.actorId,
      sourceInsightId: insight.id,
      sourceTrendId: insight.sourceTrendId,
      sourceSnapshotIds: [...insight.sourceSnapshotIds],
      sourceMetricIds: [...insight.sourceMetricIds],
      currentTemplate,
      improvementKey: input.improvementKey,
      reason: input.reason,
      stateVersion: state.version,
      createdAt: now()
    });
    state.templateImprovementPreviews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function validateApplyTemplateImprovement(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    insightId: string;
    previewId?: string;
  }): ProcessTemplateImprovementPreview {
    if (input.previewId === undefined) {
      throw dryRunRequired("template improvement preview is required");
    }
    const state = getState(input.tenantId);
    const preview = state.templateImprovementPreviews.get(input.previewId);
    if (preview === undefined || preview.sourceInsightId !== input.insightId) {
      throw stalePreview("template improvement preview is missing or stale");
    }
    if (preview.actorId !== input.actorId || preview.stateVersion !== state.version) {
      throw stalePreview("template improvement preview is stale");
    }
    const insight = getInsight(input.tenantId, input.insightId);
    if (insight === undefined) {
      throw notFound("retrospective insight not found");
    }
    if (insight.status !== "open") {
      throw stalePreview("retrospective insight was already handled");
    }
    const currentTemplate = currentTemplateForInsight(input.tenantId, insight);
    if (currentTemplate.id !== preview.template.id || currentTemplate.version !== preview.template.currentVersion) {
      throw stalePreview("process template changed after improvement preview");
    }

    return clone(preview);
  }

  function applyTemplateImprovement(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    insightId: string;
    previewId?: string;
    auditEventId: string;
  }) {
    const state = getState(input.tenantId);
    const preview = validateApplyTemplateImprovement(input);
    const insight = getInsight(input.tenantId, input.insightId);
    if (insight === undefined) {
      throw notFound("retrospective insight not found");
    }
    const currentTemplate = currentTemplateForInsight(input.tenantId, insight);
    const appliedAt = now();
    const templateResult = applyProcessTemplateImprovementPreview(currentTemplate, {
      preview,
      expectedStateVersion: state.version,
      appliedAt
    });
    const correlationId = `template-improvement-${input.insightId}-${state.version}`;
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId
      },
      commandType: "template_improvement.apply",
      requiredPermission: "retrospective.improvement.write",
      status: "succeeded",
      source: { entityType: "retrospectiveInsight", entityId: insight.id },
      target: { entityType: "processTemplate", entityId: templateResult.template.id },
      sourceSurface: {
        surfaceId: `surface-p9-closed-portfolio-${input.tenantId}`,
        surfaceKey: "retrospectives.closed_portfolio",
        rowId: insight.sourceSnapshotIds[0] ?? insight.id,
        actionSlotKey: "template_improvement.apply"
      },
      inputSummary: { improvementKey: preview.improvementKey, reason: preview.reason },
      before: { insight, template: currentTemplate, preview },
      after: { template: templateResult.template },
      timestamp: now(),
      auditEventIds: [input.auditEventId],
      permissionTrace: [
        "policy:permission retrospective.improvement.write allowed",
        "policy:permission tenant.config.write allowed"
      ],
      preconditionTrace: [
        "precondition:retrospective insight open",
        "precondition:dry-run preview confirmed",
        "precondition:closed snapshots immutable"
      ],
      trace: [
        "template_improvement:permission allowed",
        "template_improvement:preview confirmed",
        "template_improvement:future template version created"
      ]
    });
    const handledInsight = markRetrospectiveInsightHandled(insight, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      handledAt: appliedAt,
      commandType: "template_improvement.apply",
      actionExecutionId: actionExecution.id,
      auditEventId: input.auditEventId
    });
    state.processTemplateVersions.set(templateResult.template.id, clone(templateResult.template));
    state.handledInsights.set(handledInsight.id, handledInsight);
    state.actionExecutions = [...state.actionExecutions, actionExecution];
    state.version += 1;
    state.templateImprovementPreviews.clear();

    return {
      preview,
      insight: readRetrospectiveInsight(handledInsight),
      template: clone(templateResult.template),
      previousTemplateVersion: templateResult.previousVersion,
      actionExecution: clone(actionExecution)
    };
  }

  return {
    now,
    readClosure,
    previewClosure,
    validateApplyClosure,
    applyClosure,
    listSnapshots,
    getSnapshot,
    buildClosedPortfolioReadModel,
    listTrendReadModels,
    getInsight,
    getInsightReadModel,
    previewTemplateImprovement,
    validateApplyTemplateImprovement,
    applyTemplateImprovement,
    listActionExecutions
  };
}
