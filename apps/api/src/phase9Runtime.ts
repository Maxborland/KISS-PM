import { createActionExecutionLog } from "@kiss-pm/action-engine";
import type { ActionExecutionLog } from "@kiss-pm/action-engine";
import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";
import {
  createClosedProjectSnapshot,
  readClosedProjectSnapshot
} from "../../../packages/retrospectives/src/index";
import type {
  ClosedProjectKpiSummary,
  ClosedProjectResourceSummary,
  ClosedProjectScheduleSummary,
  ClosedProjectSnapshot
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

const PHASE9_TIMESTAMP_START = Date.parse("2026-05-17T00:00:00.000Z");

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
  snapshots: ClosedProjectSnapshot[];
  closureDecisions: ProjectClosureDecision[];
  actionExecutions: ActionExecutionLog[];
  version: number;
};

function clone<T>(value: T): T {
  return structuredClone(value) as T;
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
      snapshots: [],
      closureDecisions: [],
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

  return {
    now,
    readClosure,
    previewClosure,
    validateApplyClosure,
    applyClosure,
    listSnapshots,
    getSnapshot,
    listActionExecutions
  };
}
