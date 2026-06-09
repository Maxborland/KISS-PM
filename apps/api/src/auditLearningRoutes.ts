import {
  canReadAuditEvents,
  canReadControlSignals,
  canReadProjects
} from "@kiss-pm/access-control";
import type { ControlSignal, CorrectiveAction } from "@kiss-pm/domain";
import type { TaskRecord } from "@kiss-pm/persistence";

import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import type { AuditEventListItem, ProjectRecord } from "./apiTypes";

const defaultLearningInputsLimit = 100;
const maxLearningInputsLimit = 100;

type AuditLearningInputKind =
  | "audit_attention"
  | "operational_queue_item"
  | "control_signal_outcome";

type AuditLearningInputSeverity = "critical" | "warning" | "info";

type AuditLearningInputRuleFamily =
  | "permission_policy"
  | "planning_control"
  | "resource_planning"
  | "template_improvement"
  | "project_lifecycle";

type AuditLearningInput = {
  id: string;
  tenantId: string;
  inputKind: AuditLearningInputKind;
  sourceWorkflow: string;
  sourceEntity: Record<string, unknown>;
  projectId: string | null;
  severity: AuditLearningInputSeverity;
  status: string;
  occurredAt: string;
  deterministicReason: string;
  evidence: Record<string, unknown>;
  eligibleRuleFamilies: AuditLearningInputRuleFamily[];
};

export function registerAuditLearningRoutes(app: ApiApp, deps: ApiRouteDeps) {
  app.get("/api/tenant/current/audit-learning-inputs", async (context) => {
    const limit = parseLearningInputsLimit(context.req.query("limit"));
    if (limit === null) {
      return context.json({ error: "invalid_learning_inputs_limit" }, 400);
    }

    const actor = await deps.getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    const profile = await deps.getActorProfile(actor);

    const auditDecision = canReadAuditEvents({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!auditDecision.allowed) {
      return context.json({ error: auditDecision.reason }, 403);
    }

    const controlDecision = canReadControlSignals({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!controlDecision.allowed) {
      return context.json({ error: controlDecision.reason }, 403);
    }

    const projectDecision = canReadProjects({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!projectDecision.allowed) {
      return context.json({ error: projectDecision.reason }, 403);
    }

    if (
      !deps.dataSource.listAuditEventsByTenantId ||
      !deps.dataSource.listControlSignalsForProjects
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const items = await buildAuditLearningInputs({
      dataSource: deps.dataSource,
      tenantId: actor.tenantId,
      limit
    });

    return context.json({ items });
  });
}

async function buildAuditLearningInputs(input: {
  dataSource: Pick<
    import("./apiTypes").ApiTenantDataSource,
    | "listAuditEventsByTenantId"
    | "listOperationalQueueProjects"
    | "listControlSignalsForProjects"
    | "listProjectTasksForProjects"
    | "listCorrectiveActionsForProjects"
    | "listProjects"
  >;
  tenantId: string;
  limit: number;
}): Promise<AuditLearningInput[]> {
  const { dataSource, tenantId, limit } = input;

  const items: AuditLearningInput[] = [];

  const auditEvents = await dataSource.listAuditEventsByTenantId!(tenantId, {
    limit: limit,
    requiresAttention: true
  });

  const projects = await listLearningInputProjects(dataSource, tenantId);
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const operationalProjects = projects
    .filter((project) => project.tenantId === tenantId)
    .filter((project) => project.status === "active" || project.status === "paused")
    .slice(0, maxLearningInputsLimit);
  const operationalProjectIds = operationalProjects.map((project) => project.id);
  const [tasks, signals, correctiveActions] = await Promise.all([
    dataSource.listProjectTasksForProjects?.(tenantId, operationalProjectIds) ?? Promise.resolve([]),
    dataSource.listControlSignalsForProjects!(tenantId, projects.map((project) => project.id)),
    dataSource.listCorrectiveActionsForProjects?.(tenantId, operationalProjectIds) ?? Promise.resolve([])
  ]);
  const taskProjectById = new Map(
    tasks
      .filter((task) => task.tenantId === tenantId && projectMap.has(task.projectId))
      .map((task) => [task.id, task.projectId])
  );
  const signalProjectById = new Map(
    signals
      .filter((signal) => signal.tenantId === tenantId && projectMap.has(signal.projectId))
      .map((signal) => [signal.id, signal.projectId])
  );
  const correctiveActionProjectById = new Map(
    correctiveActions
      .filter((action) => action.tenantId === tenantId && projectMap.has(action.projectId))
      .map((action) => [action.id, action.projectId])
  );

  for (const event of auditEvents) {
    const status = auditEventStatus(event);
    if (!status) continue;

    const projectId = resolveProjectIdFromAuditEvent(event, {
      projectMap,
      taskProjectById,
      signalProjectById,
      correctiveActionProjectById
    });
    const severity: AuditLearningInputSeverity =
      status === "failed" ? "critical" : "warning";

    items.push({
      id: `audit-attention:${event.id}`,
      tenantId: event.tenantId,
      inputKind: "audit_attention",
      sourceWorkflow: event.sourceWorkflow ?? "audit",
      sourceEntity: event.sourceEntity,
      projectId,
      severity,
      status,
      occurredAt: event.createdAt.toISOString(),
      deterministicReason: "audit_event_requires_attention",
      evidence: {
        auditEventId: event.id,
        actionType: event.actionType,
        sourceWorkflow: event.sourceWorkflow ?? "audit",
        sourceEntity: event.sourceEntity,
        executionResult: event.executionResult,
        permissionResult: event.permissionResult,
        correlationId: event.correlationId
      },
      eligibleRuleFamilies: eligibleRuleFamiliesForAuditEvent(event)
    });
  }

  items.push(...buildOperationalQueueLearningInputs({
    tenantId,
    projects: operationalProjects,
    tasks,
    signals,
    correctiveActions,
    asOf: new Date()
  }));

  for (const signal of signals) {
    if (signal.tenantId !== tenantId) continue;

    const deterministicReason = controlSignalDeterministicReason(signal.status);
    const severity: AuditLearningInputSeverity =
      signal.severity === "critical" ? "critical" : "warning";

    items.push({
      id: `control-signal-outcome:${signal.id}`,
      tenantId: signal.tenantId,
      inputKind: "control_signal_outcome",
      sourceWorkflow: "control",
      sourceEntity: signal.sourceEntity,
      projectId: signal.projectId ?? null,
      severity,
      status: signal.status,
      occurredAt: signal.createdAt,
      deterministicReason,
      evidence: {
        controlSignalId: signal.id,
        sourceMetric: signal.sourceMetric,
        explanation: signal.explanation,
        status: signal.status,
        severity: signal.severity
      },
      eligibleRuleFamilies: eligibleRuleFamiliesForControlSignal(signal)
    });
  }

  items.sort((a, b) => {
    const sevRankDiff = computeSeverityRank(a.severity) - computeSeverityRank(b.severity);
    if (sevRankDiff !== 0) return sevRankDiff;
    const occurredAtDiff = b.occurredAt.localeCompare(a.occurredAt);
    if (occurredAtDiff !== 0) return occurredAtDiff;
    return kindRank(a.inputKind) - kindRank(b.inputKind);
  });

  return items.slice(0, limit);
}

async function listLearningInputProjects(
  dataSource: Pick<
    import("./apiTypes").ApiTenantDataSource,
    "listProjects" | "listOperationalQueueProjects"
  >,
  tenantId: string
): Promise<ProjectRecord[]> {
  if (dataSource.listProjects) {
    return dataSource.listProjects(tenantId);
  }
  if (dataSource.listOperationalQueueProjects) {
    return dataSource.listOperationalQueueProjects(tenantId, {
      statuses: ["active", "paused"],
      limit: maxLearningInputsLimit
    });
  }
  return [];
}

function buildOperationalQueueLearningInputs(input: {
  tenantId: string;
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  signals: ControlSignal[];
  correctiveActions: CorrectiveAction[];
  asOf: Date;
}): AuditLearningInput[] {
  const projectById = new Map(input.projects.map((project) => [project.id, project]));
  const signalById = new Map(input.signals.map((signal) => [signal.id, signal]));
  const items: AuditLearningInput[] = [];

  for (const project of input.projects) {
    if (project.tenantId !== input.tenantId) continue;
    if (isDateBefore(project.plannedFinish, input.asOf)) {
      items.push({
        id: `operational-queue:project-overdue:${project.id}`,
        tenantId: project.tenantId,
        inputKind: "operational_queue_item",
        sourceWorkflow: "project_lifecycle",
        sourceEntity: { type: "Project", id: project.id },
        projectId: project.id,
        severity: "critical",
        status: project.status,
        occurredAt: (project.activatedAt ?? project.createdAt).toISOString(),
        deterministicReason: "operational_queue_project_overdue",
        evidence: {
          signalKind: "project_overdue",
          plannedFinish: dateOnly(project.plannedFinish),
          projectStatus: project.status
        },
        eligibleRuleFamilies: ["project_lifecycle", "planning_control"]
      });
    }
  }

  for (const task of input.tasks) {
    if (task.tenantId !== input.tenantId || task.archivedAt || task.statusCategory === "done") continue;
    if (!projectById.has(task.projectId)) continue;
    if (isDateBefore(task.plannedFinish, input.asOf)) {
      const severity: AuditLearningInputSeverity =
        task.priority === "critical" || task.priority === "high" ? "critical" : "warning";
      items.push({
        id: `operational-queue:task-overdue:${task.projectId}:${task.id}`,
        tenantId: task.tenantId,
        inputKind: "operational_queue_item",
        sourceWorkflow: "project_work",
        sourceEntity: { type: "Task", id: task.id },
        projectId: task.projectId,
        severity,
        status: task.status,
        occurredAt: task.updatedAt.toISOString(),
        deterministicReason: "operational_queue_task_overdue",
        evidence: {
          signalKind: "task_overdue",
          taskStatusCategory: task.statusCategory,
          priority: task.priority,
          plannedFinish: dateOnly(task.plannedFinish)
        },
        eligibleRuleFamilies: ["planning_control", "resource_planning"]
      });
    }
    if (task.statusCategory === "waiting") {
      items.push({
        id: `operational-queue:task-status:${task.projectId}:${task.id}`,
        tenantId: task.tenantId,
        inputKind: "operational_queue_item",
        sourceWorkflow: "project_work",
        sourceEntity: { type: "Task", id: task.id },
        projectId: task.projectId,
        severity: "warning",
        status: task.status,
        occurredAt: task.updatedAt.toISOString(),
        deterministicReason: "operational_queue_task_waiting",
        evidence: {
          signalKind: "task_status",
          taskStatusCategory: task.statusCategory,
          priority: task.priority
        },
        eligibleRuleFamilies: ["planning_control", "resource_planning"]
      });
    }
  }

  for (const signal of input.signals) {
    if (signal.tenantId !== input.tenantId || !projectById.has(signal.projectId)) continue;
    if (signal.status === "resolved" || signal.status === "accepted_risk") continue;
    items.push({
      id: `operational-queue:control-signal:${signal.projectId}:${signal.id}`,
      tenantId: signal.tenantId,
      inputKind: "operational_queue_item",
      sourceWorkflow: "control",
      sourceEntity: { type: "ControlSignal", id: signal.id },
      projectId: signal.projectId,
      severity: signal.severity === "critical" ? "critical" : "warning",
      status: signal.status,
      occurredAt: signal.updatedAt,
      deterministicReason: "operational_queue_control_signal_open",
      evidence: {
        signalKind: "control_signal",
        sourceMetric: signal.sourceMetric,
        explanation: signal.explanation,
        severity: signal.severity
      },
      eligibleRuleFamilies: eligibleRuleFamiliesForControlSignal(signal)
    });
  }

  for (const action of input.correctiveActions) {
    if (action.tenantId !== input.tenantId || !projectById.has(action.projectId)) continue;
    if (action.status !== "open" && action.status !== "in_progress") continue;
    const signal = signalById.get(action.controlSignalId);
    const overdue = action.dueDate ? isDateStringBefore(action.dueDate, input.asOf) : false;
    items.push({
      id: `operational-queue:corrective-action:${action.projectId}:${action.id}`,
      tenantId: action.tenantId,
      inputKind: "operational_queue_item",
      sourceWorkflow: "control",
      sourceEntity: { type: "CorrectiveAction", id: action.id },
      projectId: action.projectId,
      severity: signal?.severity === "critical" || overdue ? "critical" : "warning",
      status: action.status,
      occurredAt: (projectById.get(action.projectId)?.activatedAt ?? projectById.get(action.projectId)?.createdAt ?? input.asOf).toISOString(),
      deterministicReason: overdue
        ? "operational_queue_corrective_action_overdue"
        : "operational_queue_corrective_action_open",
      evidence: {
        signalKind: "corrective_action",
        controlSignalId: action.controlSignalId,
        dueDate: action.dueDate,
        overdue
      },
      eligibleRuleFamilies: ["planning_control"]
    });
  }

  return items;
}

function auditEventStatus(event: AuditEventListItem): string | null {
  const status = typeof event.executionResult.status === "string"
    ? event.executionResult.status
    : null;
  if (status === "failed" || status === "denied" || status === "conflict") {
    return status;
  }
  if (/(?:_|\.)(?:failed|denied|conflict)$/.test(event.actionType)) {
    const match = event.actionType.match(/(?:_|\.)(failed|denied|conflict)$/);
    const matchedStatus = match?.[1];
    return matchedStatus === "failed" || matchedStatus === "denied" || matchedStatus === "conflict"
      ? matchedStatus
      : null;
  }
  return null;
}

function resolveProjectIdFromAuditEvent(
  event: AuditEventListItem,
  context: {
    projectMap: Map<string, ProjectRecord>;
    taskProjectById: Map<string, string>;
    signalProjectById: Map<string, string>;
    correctiveActionProjectById: Map<string, string>;
  }
): string | null {
  const entityType = typeof event.sourceEntity?.type === "string"
    ? event.sourceEntity.type
    : null;
  const entityId = typeof event.sourceEntity?.id === "string"
    ? event.sourceEntity.id
    : null;

  if (!entityType || !entityId) return null;

  if (entityType === "Project" && context.projectMap.has(entityId)) {
    return entityId;
  }

  const relatedProjectId = entityType === "Task"
    ? context.taskProjectById.get(entityId)
    : entityType === "ControlSignal"
      ? context.signalProjectById.get(entityId)
      : entityType === "CorrectiveAction"
        ? context.correctiveActionProjectById.get(entityId)
        : null;

  if (relatedProjectId && context.projectMap.has(relatedProjectId)) {
    return relatedProjectId;
  }

  return null;
}

function eligibleRuleFamiliesForAuditEvent(
  event: AuditEventListItem
): AuditLearningInputRuleFamily[] {
  const families: AuditLearningInputRuleFamily[] = [];
  const workflow = event.sourceWorkflow ?? "";
  const actionType = event.actionType ?? "";

  families.push("permission_policy");

  if (workflow === "control" || actionType.startsWith("control.") || actionType.startsWith("management_action.") || actionType.startsWith("kpi.") || actionType.startsWith("corrective_action.")) {
    families.push("planning_control");
  }
  if (workflow === "planning" || actionType.startsWith("planning.")) {
    families.push("planning_control");
    families.push("resource_planning");
  }
  if (workflow === "project_lifecycle" || actionType.includes("closure") || actionType.includes("cancel")) {
    families.push("project_lifecycle");
  }
  if (actionType.includes("template")) {
    families.push("template_improvement");
  }

  return [...new Set(families)];
}

function eligibleRuleFamiliesForControlSignal(
  signal: ControlSignal
): AuditLearningInputRuleFamily[] {
  const families: AuditLearningInputRuleFamily[] = ["planning_control"];

  const metric = signal.sourceMetric ?? "";
  if (metric.includes("resource") || metric.includes("overload") || metric.includes("deadline")) {
    families.push("resource_planning");
  }

  return [...new Set(families)];
}

function controlSignalDeterministicReason(status: string): string {
  switch (status) {
    case "accepted_risk":
      return "control_signal_accepted_risk";
    case "resolved":
      return "control_signal_resolved";
    case "open":
      return "control_signal_open";
    default:
      return `control_signal_${status}`;
  }
}

function kindRank(kind: AuditLearningInputKind): number {
  switch (kind) {
    case "audit_attention":
      return 0;
    case "operational_queue_item":
      return 1;
    case "control_signal_outcome":
      return 2;
    default:
      return 3;
  }
}

function computeSeverityRank(severity: AuditLearningInputSeverity): number {
  switch (severity) {
    case "critical":
      return 0;
    case "warning":
      return 1;
    case "info":
      return 2;
    default:
      return 3;
  }
}

function parseLearningInputsLimit(value: string | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) return defaultLearningInputsLimit;
  if (!/^(0|[1-9]\d*)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxLearningInputsLimit) {
    return null;
  }
  return parsed;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isDateBefore(value: Date, asOf: Date): boolean {
  return dateOnly(value) < dateOnly(asOf);
}

function isDateStringBefore(value: string, asOf: Date): boolean {
  return value < dateOnly(asOf);
}
