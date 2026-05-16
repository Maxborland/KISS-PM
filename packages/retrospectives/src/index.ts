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
