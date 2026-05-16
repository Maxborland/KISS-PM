import type {
  ManagedProject,
  ProjectClosureDecision,
  Task
} from "@kiss-pm/project-core";

export const packageName = "@kiss-pm/retrospectives";

export type RetrospectiveSeverity = "none" | "attention" | "warning" | "critical";

export type ClosedProjectSnapshotSourceRefType =
  | "project"
  | "process_template"
  | "closure_decision"
  | "schedule_baseline"
  | "kpi_evaluation";

export type ClosedProjectSnapshotSourceRef = {
  type: ClosedProjectSnapshotSourceRefType;
  id: string;
  version?: number;
};

export type ClosedProjectScheduleSummary = {
  baselineId?: string;
  plannedStartDate?: string;
  plannedFinishDate?: string;
  actualFinishDate?: string;
};

export type ClosedProjectResourceSummary = {
  plannedWorkHours: number;
  actualWorkHours: number;
  overloadCount: number;
};

export type ClosedProjectKpiSummary = {
  evaluationId: string;
  definitionId: string;
  definitionVersion: number;
  value: number;
  severity: RetrospectiveSeverity;
  evaluatedAt: string;
};

export type ClosedProjectSnapshot = {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly version: number;
  readonly capturedAt: string;
  readonly project: {
    readonly title: string;
    readonly lifecycleStatus: "completed";
    readonly sourceDraftId: string;
    readonly sourceOpportunity: {
      readonly type: "crm_opportunity";
      readonly opportunityId: string;
      readonly accountId?: string;
      readonly contactIds: readonly string[];
      readonly plannedStartDate: string;
      readonly desiredFinishDate: string;
    };
    readonly processTemplate: {
      readonly templateId: string;
      readonly key: string;
      readonly label: string;
      readonly version: number;
    };
  };
  readonly closure: {
    readonly decisionId: string;
    readonly actorId: string;
    readonly closedAt: string;
    readonly auditEventId: string;
    readonly finalKpiSummary?: string;
    readonly qualityScore?: number;
    readonly clientSatisfactionScore?: number;
    readonly closingSummary?: string;
    readonly lessonsLearned: ProjectClosureDecision["closureData"]["lessonsLearned"];
  };
  readonly metrics: {
    readonly stageCount: number;
    readonly completedStageCount: number;
    readonly taskCount: number;
    readonly openTaskCount: number;
    readonly plannedWorkHours: number;
  };
  readonly scheduleSummary: ClosedProjectScheduleSummary;
  readonly resourceSummary: ClosedProjectResourceSummary;
  readonly kpiSummary: readonly ClosedProjectKpiSummary[];
  readonly sourceRefs: readonly ClosedProjectSnapshotSourceRef[];
};

export type PlanFactMetricKey = "work_hours" | "schedule_days" | "overload_count" | "kpi_drift";

export type PlanFactMetric = {
  readonly id: string;
  readonly tenantId: string;
  readonly snapshotId: string;
  readonly projectId: string;
  readonly metricKey: PlanFactMetricKey;
  readonly label: string;
  readonly plannedValue: number;
  readonly actualValue: number;
  readonly varianceValue: number;
  readonly variancePercent?: number;
  readonly severity: RetrospectiveSeverity;
  readonly sourceSnapshotIds: readonly string[];
};

export type RetrospectiveTrendGroupBy = "project_type" | "template" | "client" | "period";

export type RetrospectiveTrendKey = "schedule_delay" | "overload" | "kpi_drift" | "work_variance";

export type RetrospectiveTrend = {
  readonly id: string;
  readonly tenantId: string;
  readonly trendKey: RetrospectiveTrendKey;
  readonly groupBy: RetrospectiveTrendGroupBy;
  readonly groupKey: string;
  readonly occurrenceCount: number;
  readonly severity: RetrospectiveSeverity;
  readonly averageVarianceValue: number;
  readonly averageVariancePercent?: number;
  readonly sourceSnapshotIds: readonly string[];
  readonly sourceMetricIds: readonly string[];
};

export class RetrospectiveModelError extends Error {
  constructor(
    readonly code: "validation_error" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "RetrospectiveModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RetrospectiveModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new RetrospectiveModelError("validation_error", `${fieldName} must be a positive integer`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new RetrospectiveModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireNonNegativeNumber(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RetrospectiveModelError("validation_error", `${fieldName} must be a non-negative number`);
  }

  return value;
}

function requireFiniteNumber(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RetrospectiveModelError("validation_error", `${fieldName} must be a finite number`);
  }

  return value;
}

function requireRetrospectiveSeverity(
  value: RetrospectiveSeverity | undefined,
  fieldName: string
): RetrospectiveSeverity {
  if (value === "none" || value === "attention" || value === "warning" || value === "critical") {
    return value;
  }

  throw new RetrospectiveModelError("validation_error", `${fieldName} is invalid`);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysBetweenInclusive(startDate: string, finishDate: string, fieldName: string): number {
  const start = Date.parse(`${requireNonEmptyString(startDate, `${fieldName}.startDate`)}T00:00:00.000Z`);
  const finish = Date.parse(`${requireNonEmptyString(finishDate, `${fieldName}.finishDate`)}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(finish)) {
    throw new RetrospectiveModelError("validation_error", `${fieldName} dates must be valid`);
  }
  if (finish < start) {
    throw new RetrospectiveModelError("validation_error", `${fieldName} finishDate must be on or after startDate`);
  }

  return Math.floor((finish - start) / 86_400_000) + 1;
}

function variancePercent(plannedValue: number, actualValue: number): number | undefined {
  if (plannedValue === 0) return undefined;

  return roundMetric(((actualValue - plannedValue) / plannedValue) * 100);
}

function planFactSeverity(metricKey: PlanFactMetricKey, varianceValue: number, percent?: number): RetrospectiveSeverity {
  if (metricKey === "kpi_drift") {
    if (varianceValue >= 2) return "critical";
    if (varianceValue >= 1) return "critical";
    return "none";
  }
  if (metricKey === "overload_count") {
    if (varianceValue >= 3) return "critical";
    if (varianceValue >= 1) return "warning";
    return "none";
  }
  if (percent !== undefined) {
    if (percent >= 50) return "critical";
    if (percent >= 20) return "warning";
    if (percent >= 10) return "attention";
  }

  return "none";
}

function severityRank(severity: RetrospectiveSeverity): number {
  switch (severity) {
    case "critical":
      return 4;
    case "warning":
      return 3;
    case "attention":
      return 2;
    case "none":
      return 1;
  }
}

function maxSeverity(severities: readonly RetrospectiveSeverity[]): RetrospectiveSeverity {
  return severities.reduce<RetrospectiveSeverity>(
    (max, severity) => (severityRank(severity) > severityRank(max) ? severity : max),
    "none"
  );
}

function metricToTrendKey(metricKey: PlanFactMetricKey): RetrospectiveTrendKey {
  switch (metricKey) {
    case "work_hours":
      return "work_variance";
    case "schedule_days":
      return "schedule_delay";
    case "overload_count":
      return "overload";
    case "kpi_drift":
      return "kpi_drift";
  }
}

function trendSortOrder(trendKey: RetrospectiveTrendKey): number {
  switch (trendKey) {
    case "kpi_drift":
      return 1;
    case "overload":
      return 2;
    case "schedule_delay":
      return 3;
    case "work_variance":
      return 4;
  }
}

function groupKeyForSnapshot(snapshot: ClosedProjectSnapshot, groupBy: RetrospectiveTrendGroupBy): string {
  switch (groupBy) {
    case "template":
      return snapshot.project.processTemplate.templateId;
    case "project_type":
      return snapshot.project.processTemplate.key;
    case "client":
      return snapshot.project.sourceOpportunity.accountId ?? "unassigned";
    case "period": {
      requireValidTimestamp(snapshot.closure.closedAt, "retrospectiveTrend.closedAt");
      return snapshot.closure.closedAt.slice(0, 7);
    }
  }
}

function requireTrendGroupBy(value: RetrospectiveTrendGroupBy): RetrospectiveTrendGroupBy {
  if (value === "project_type" || value === "template" || value === "client" || value === "period") {
    return value;
  }

  throw new RetrospectiveModelError("validation_error", "retrospectiveTrend.groupBy is invalid");
}

function countOpenTasks(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length;
}

function createSourceRefs(input: {
  project: ManagedProject;
  closureDecision: ProjectClosureDecision;
  scheduleSummary: ClosedProjectScheduleSummary;
  kpiSummary: readonly ClosedProjectKpiSummary[];
}): ClosedProjectSnapshotSourceRef[] {
  const refs: ClosedProjectSnapshotSourceRef[] = [
    { type: "project", id: input.project.id },
    {
      type: "process_template",
      id: input.project.processTemplateSnapshot.templateId,
      version: input.project.processTemplateSnapshot.version
    },
    { type: "closure_decision", id: input.closureDecision.id }
  ];
  if (input.scheduleSummary.baselineId !== undefined) {
    refs.push({ type: "schedule_baseline", id: input.scheduleSummary.baselineId });
  }
  for (const evaluation of input.kpiSummary) {
    refs.push({
      type: "kpi_evaluation",
      id: evaluation.evaluationId,
      version: evaluation.definitionVersion
    });
  }

  return refs;
}

export function createClosedProjectSnapshot(input: {
  id: string;
  version: number;
  capturedAt: string;
  project: ManagedProject;
  closureDecision: ProjectClosureDecision;
  scheduleSummary: ClosedProjectScheduleSummary;
  resourceSummary: ClosedProjectResourceSummary;
  kpiSummary: readonly ClosedProjectKpiSummary[];
}): ClosedProjectSnapshot {
  const project = cloneJson(input.project);
  const closureDecision = cloneJson(input.closureDecision);
  const scheduleSummary = cloneJson(input.scheduleSummary);
  const resourceSummary = cloneJson(input.resourceSummary);
  const kpiSummary = cloneJson(input.kpiSummary);
  const id = requireNonEmptyString(input.id, "closedProjectSnapshot.id");
  const version = requirePositiveInteger(input.version, "closedProjectSnapshot.version");
  const capturedAt = requireValidTimestamp(input.capturedAt, "closedProjectSnapshot.capturedAt");

  if (project.lifecycleStatus !== "completed") {
    throw new RetrospectiveModelError("validation_error", "closed project snapshot requires a completed project");
  }
  if (closureDecision.tenantId !== project.tenantId) {
    throw new RetrospectiveModelError("validation_error", "closed project snapshot closure decision tenant mismatch");
  }
  if (closureDecision.projectId !== project.id) {
    throw new RetrospectiveModelError("validation_error", "closed project snapshot closure decision project mismatch");
  }
  for (const evaluation of kpiSummary) {
    requireNonEmptyString(evaluation.evaluationId, "closedProjectSnapshot.kpiSummary.evaluationId");
    requireNonEmptyString(evaluation.definitionId, "closedProjectSnapshot.kpiSummary.definitionId");
    requirePositiveInteger(evaluation.definitionVersion, "closedProjectSnapshot.kpiSummary.definitionVersion");
    requireFiniteNumber(evaluation.value, "closedProjectSnapshot.kpiSummary.value");
    requireRetrospectiveSeverity(evaluation.severity, "closedProjectSnapshot.kpiSummary.severity");
    requireValidTimestamp(evaluation.evaluatedAt, "closedProjectSnapshot.kpiSummary.evaluatedAt");
  }

  const plannedWorkHours =
    project.tasks.reduce((total, task) => total + task.plannedWorkHours, 0) ||
    requireNonNegativeNumber(resourceSummary.plannedWorkHours, "closedProjectSnapshot.resourceSummary.plannedWorkHours");
  const snapshot: ClosedProjectSnapshot = {
    id,
    tenantId: project.tenantId,
    projectId: project.id,
    version,
    capturedAt,
    project: {
      title: project.title,
      lifecycleStatus: "completed",
      sourceDraftId: project.sourceDraftId,
      sourceOpportunity: {
        type: project.sourceOpportunity.type,
        opportunityId: project.sourceOpportunity.opportunityId,
        ...(project.sourceOpportunity.accountId !== undefined ? { accountId: project.sourceOpportunity.accountId } : {}),
        contactIds: cloneJson(project.sourceOpportunity.contactIds),
        plannedStartDate: project.sourceOpportunity.plannedStartDate,
        desiredFinishDate: project.sourceOpportunity.desiredFinishDate
      },
      processTemplate: {
        templateId: project.processTemplateSnapshot.templateId,
        key: project.processTemplateSnapshot.key,
        label: project.processTemplateSnapshot.label,
        version: project.processTemplateSnapshot.version
      }
    },
    closure: {
      decisionId: closureDecision.id,
      actorId: closureDecision.actorId,
      closedAt: closureDecision.closedAt,
      auditEventId: closureDecision.auditEventId,
      ...(closureDecision.closureData.finalKpiSummary !== undefined
        ? { finalKpiSummary: closureDecision.closureData.finalKpiSummary }
        : {}),
      ...(closureDecision.closureData.qualityScore !== undefined
        ? { qualityScore: closureDecision.closureData.qualityScore }
        : {}),
      ...(closureDecision.closureData.clientSatisfactionScore !== undefined
        ? { clientSatisfactionScore: closureDecision.closureData.clientSatisfactionScore }
        : {}),
      ...(closureDecision.closureData.closingSummary !== undefined
        ? { closingSummary: closureDecision.closureData.closingSummary }
        : {}),
      lessonsLearned: cloneJson(closureDecision.closureData.lessonsLearned)
    },
    metrics: {
      stageCount: project.stages.length,
      completedStageCount: project.stages.filter((stage) => stage.status === "completed").length,
      taskCount: project.tasks.length,
      openTaskCount: countOpenTasks(project.tasks),
      plannedWorkHours
    },
    scheduleSummary,
    resourceSummary: {
      plannedWorkHours: requireNonNegativeNumber(resourceSummary.plannedWorkHours, "closedProjectSnapshot.resourceSummary.plannedWorkHours"),
      actualWorkHours: requireNonNegativeNumber(resourceSummary.actualWorkHours, "closedProjectSnapshot.resourceSummary.actualWorkHours"),
      overloadCount: requireNonNegativeNumber(resourceSummary.overloadCount, "closedProjectSnapshot.resourceSummary.overloadCount")
    },
    kpiSummary,
    sourceRefs: createSourceRefs({ project, closureDecision, scheduleSummary, kpiSummary })
  };

  return cloneJson(snapshot);
}

export function readClosedProjectSnapshot(snapshot: ClosedProjectSnapshot): ClosedProjectSnapshot {
  return cloneJson(snapshot);
}

export function calculatePlanFactMetrics(snapshotInput: ClosedProjectSnapshot): PlanFactMetric[] {
  const snapshot = cloneJson(snapshotInput);
  if (snapshot.project.lifecycleStatus !== "completed") {
    throw new RetrospectiveModelError("validation_error", "plan/fact metrics require a completed snapshot");
  }
  const plannedWorkHours = requireNonNegativeNumber(
    snapshot.resourceSummary.plannedWorkHours,
    "planFactMetric.resourceSummary.plannedWorkHours"
  );
  const actualWorkHours = requireNonNegativeNumber(
    snapshot.resourceSummary.actualWorkHours,
    "planFactMetric.resourceSummary.actualWorkHours"
  );
  const overloadCount = requireNonNegativeNumber(
    snapshot.resourceSummary.overloadCount,
    "planFactMetric.resourceSummary.overloadCount"
  );
  const plannedStartDate = requireNonEmptyString(
    snapshot.scheduleSummary.plannedStartDate,
    "planFactMetric.scheduleSummary.plannedStartDate"
  );
  const plannedFinishDate = requireNonEmptyString(
    snapshot.scheduleSummary.plannedFinishDate,
    "planFactMetric.scheduleSummary.plannedFinishDate"
  );
  const actualFinishDate = requireNonEmptyString(
    snapshot.scheduleSummary.actualFinishDate,
    "planFactMetric.scheduleSummary.actualFinishDate"
  );
  const plannedScheduleDays = daysBetweenInclusive(plannedStartDate, plannedFinishDate, "planFactMetric.scheduleSummary");
  const actualScheduleDays = daysBetweenInclusive(plannedStartDate, actualFinishDate, "planFactMetric.scheduleSummary");
  const criticalOrWarningKpis = snapshot.kpiSummary.filter(
    (kpi) => kpi.severity === "warning" || kpi.severity === "critical"
  ).length;
  const kpiDriftSeverity = maxSeverity(
    snapshot.kpiSummary
      .filter((kpi) => kpi.severity === "warning" || kpi.severity === "critical")
      .map((kpi) => kpi.severity)
  );

  const metricInputs: Array<{
    key: PlanFactMetricKey;
    label: string;
    plannedValue: number;
    actualValue: number;
    severity?: RetrospectiveSeverity;
  }> = [
    { key: "work_hours", label: "Planned vs actual work hours", plannedValue: plannedWorkHours, actualValue: actualWorkHours },
    { key: "schedule_days", label: "Planned vs actual schedule days", plannedValue: plannedScheduleDays, actualValue: actualScheduleDays },
    { key: "overload_count", label: "Resource overload count", plannedValue: 0, actualValue: overloadCount },
    {
      key: "kpi_drift",
      label: "Warning or critical KPI evaluations",
      plannedValue: 0,
      actualValue: criticalOrWarningKpis,
      severity: kpiDriftSeverity
    }
  ];

  return metricInputs.map((metric) => {
    const varianceValue = roundMetric(metric.actualValue - metric.plannedValue);
    const percent = variancePercent(metric.plannedValue, metric.actualValue);
    return cloneJson({
      id: `${snapshot.id}:${metric.key}`,
      tenantId: snapshot.tenantId,
      snapshotId: snapshot.id,
      projectId: snapshot.projectId,
      metricKey: metric.key,
      label: metric.label,
      plannedValue: metric.plannedValue,
      actualValue: metric.actualValue,
      varianceValue,
      ...(percent !== undefined ? { variancePercent: percent } : {}),
      severity: metric.severity ?? planFactSeverity(metric.key, varianceValue, percent),
      sourceSnapshotIds: [snapshot.id]
    });
  });
}

export function buildRetrospectiveTrends(input: {
  tenantId: string;
  snapshots: readonly ClosedProjectSnapshot[];
  groupBy: RetrospectiveTrendGroupBy;
}): RetrospectiveTrend[] {
  const tenantId = requireNonEmptyString(input.tenantId, "retrospectiveTrend.tenantId");
  const groupBy = requireTrendGroupBy(input.groupBy);
  const snapshots = cloneJson(input.snapshots);
  const tenantSnapshots = snapshots.filter((snapshot) => snapshot.tenantId === tenantId);
  if (tenantSnapshots.length === 0 && snapshots.length > 0) {
    throw new RetrospectiveModelError("validation_error", "retrospective trends require tenant-scoped snapshots");
  }

  const grouped = new Map<
    string,
    {
      groupKey: string;
      trendKey: RetrospectiveTrendKey;
      metrics: PlanFactMetric[];
    }
  >();

  for (const snapshot of tenantSnapshots) {
    const groupKey = groupKeyForSnapshot(snapshot, groupBy);
    for (const metric of calculatePlanFactMetrics(snapshot)) {
      if (metric.severity === "none") continue;
      const trendKey = metricToTrendKey(metric.metricKey);
      const key = `${groupKey}:${trendKey}`;
      const existing = grouped.get(key);
      if (existing === undefined) {
        grouped.set(key, { groupKey, trendKey, metrics: [metric] });
      } else {
        existing.metrics.push(metric);
      }
    }
  }

  return Array.from(grouped.values())
    .filter((group) => group.metrics.length > 0)
    .sort((a, b) => {
      const groupCompare = a.groupKey.localeCompare(b.groupKey);
      if (groupCompare !== 0) return groupCompare;

      return trendSortOrder(a.trendKey) - trendSortOrder(b.trendKey);
    })
    .map((group) => {
      const sourceSnapshotIds = Array.from(new Set(group.metrics.flatMap((metric) => metric.sourceSnapshotIds))).sort();
      const averageVarianceValue = roundMetric(
        group.metrics.reduce((total, metric) => total + metric.varianceValue, 0) / group.metrics.length
      );
      const percentMetrics = group.metrics.filter((metric) => metric.variancePercent !== undefined);
      const averageVariancePercent =
        percentMetrics.length === 0
          ? undefined
          : roundMetric(
              percentMetrics.reduce((total, metric) => total + (metric.variancePercent ?? 0), 0) / percentMetrics.length
            );

      return cloneJson({
        id: `${tenantId}:${groupBy}:${group.groupKey}:${group.trendKey}`,
        tenantId,
        trendKey: group.trendKey,
        groupBy,
        groupKey: group.groupKey,
        occurrenceCount: sourceSnapshotIds.length,
        severity: maxSeverity(group.metrics.map((metric) => metric.severity)),
        averageVarianceValue,
        ...(averageVariancePercent !== undefined ? { averageVariancePercent } : {}),
        sourceSnapshotIds,
        sourceMetricIds: group.metrics.map((metric) => metric.id).sort()
      });
    });
}
