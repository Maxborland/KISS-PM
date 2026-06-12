import {
  controlSurfaceActionRegistry,
  type ControlSignal,
  type CorrectiveAction,
  type TenantUser
} from "@kiss-pm/domain";
import type { AccessProfile } from "@kiss-pm/access-control";
import type { TaskRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource, AuditEventListItem, ProjectRecord } from "../../apiTypes";
import { decisionForPermission } from "../controlPermissions";
import { listOperationalProjectCandidates } from "../../operationalProjectCandidates";

export type OperationalControlQueueQuery = {
  asOf: Date;
  limit: number;
};

type OperationalControlQueueSeverity = "critical" | "warning" | "info";
type OperationalControlQueuePriority = "critical" | "high" | "normal" | "low";
type OperationalControlQueueSignalKind =
  | "control_signal"
  | "corrective_action"
  | "task_overdue"
  | "task_status"
  | "project_overdue"
  | "audit_event";

export type OperationalControlQueueItem = {
  id: string;
  tenantId: string;
  signalKind: OperationalControlQueueSignalKind;
  severity: OperationalControlQueueSeverity;
  priority: OperationalControlQueuePriority;
  project: {
    id: string;
    title: string;
    status: ProjectRecord["status"];
    plannedFinish: string;
  };
  entity: {
    type: string;
    id: string;
    label: string;
  };
  task?: {
    id: string;
    title: string;
    status: string;
    statusId: string;
    statusName: string;
    statusCategory: string;
    priority: string;
    plannedFinish: string;
    ownerUserId: string;
  };
  status: {
    value: string;
    category?: string;
  };
  dueDate: string | null;
  overdue: boolean;
  reason: string;
  allowedActions: string[];
  source: {
    workflow: string;
    entityType: string;
    entityId: string;
    metric?: string;
    auditEventId?: string;
  };
  sourceTimestamps: {
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    dueAt?: string | undefined;
  };
};

type OperationalControlQueueSortItem = OperationalControlQueueItem & {
  sort: {
    dueDate: string | null;
    timestamp: string;
  };
};

const defaultOperationalControlQueueLimit = 50;
const maxOperationalControlQueueLimit = 100;
export function parseOperationalControlQueueQuery(input: {
  asOf: string | undefined;
  limit: string | undefined;
}): { ok: true; value: OperationalControlQueueQuery } | { ok: false; error: string } {
  const asOf = parseOperationalQueueAsOf(input.asOf);
  if (!asOf) return { ok: false, error: "invalid_operational_queue_as_of" };
  const limit = parseOperationalQueueLimit(input.limit);
  if (limit === null) return { ok: false, error: "invalid_operational_queue_limit" };
  return { ok: true, value: { asOf, limit } };
}

function parseOperationalQueueAsOf(value: string | undefined): Date | null {
  const normalized = value?.trim();
  if (!normalized) return new Date();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseOperationalQueueLimit(value: string | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) return defaultOperationalControlQueueLimit;
  if (!/^(0|[1-9]\d*)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxOperationalControlQueueLimit) return null;
  return parsed;
}

export async function buildOperationalControlQueue(input: {
  dataSource: ApiTenantDataSource;
  tenantId: string;
  asOf: Date;
  limit: number;
}): Promise<OperationalControlQueueItem[]> {
  const projects = await listOperationalProjectCandidates({
    dataSource: input.dataSource,
    tenantId: input.tenantId,
    asOf: input.asOf
  });
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const allTasks: TaskRecord[] = [];
  const items: OperationalControlQueueSortItem[] = [];
  const signalById = new Map<string, ControlSignal>();
  const signalProjectById = new Map<string, string>();
  const correctiveActionProjectById = new Map<string, string>();
  const projectIds = projects.map((project) => project.id);

  const [tasks, signals, correctiveActions] = await Promise.all([
    input.dataSource.listProjectTasksForProjects?.(input.tenantId, projectIds) ?? Promise.resolve([]),
    input.dataSource.listControlSignalsForProjects?.(input.tenantId, projectIds) ?? Promise.resolve([]),
    input.dataSource.listCorrectiveActionsForProjects?.(input.tenantId, projectIds) ?? Promise.resolve([])
  ]);
  const activeProjectIds = new Set(projectIds);
  const tasksByProject = new Map<string, TaskRecord[]>();
  for (const task of tasks) {
    if (task.tenantId !== input.tenantId || !activeProjectIds.has(task.projectId)) continue;
    allTasks.push(task);
    const projectTasks = tasksByProject.get(task.projectId) ?? [];
    projectTasks.push(task);
    tasksByProject.set(task.projectId, projectTasks);
  }
  const signalsByProject = new Map<string, ControlSignal[]>();
  for (const signal of signals) {
    if (signal.tenantId !== input.tenantId || !activeProjectIds.has(signal.projectId)) continue;
    signalById.set(signal.id, signal);
    signalProjectById.set(signal.id, signal.projectId);
    const projectSignals = signalsByProject.get(signal.projectId) ?? [];
    projectSignals.push(signal);
    signalsByProject.set(signal.projectId, projectSignals);
  }
  const correctiveActionsByProject = new Map<string, CorrectiveAction[]>();
  for (const action of correctiveActions) {
    if (action.tenantId !== input.tenantId || !activeProjectIds.has(action.projectId)) continue;
    correctiveActionProjectById.set(action.id, action.projectId);
    const projectActions = correctiveActionsByProject.get(action.projectId) ?? [];
    projectActions.push(action);
    correctiveActionsByProject.set(action.projectId, projectActions);
  }

  for (const project of projects) {
    items.push(...queueItemsForProject(project, input.asOf));
    items.push(...queueItemsForTasks(project, tasksByProject.get(project.id) ?? [], input.asOf));
    items.push(...queueItemsForControlSignals(project, signalsByProject.get(project.id) ?? []));
    items.push(...queueItemsForCorrectiveActions(
      project,
      correctiveActionsByProject.get(project.id) ?? [],
      signalById,
      input.asOf
    ));
  }

  const taskProjectById = new Map(allTasks.map((task) => [task.id, task.projectId]));
  const auditSourceEntities = auditSourceEntitiesForQueue(
    projectById,
    taskProjectById,
    signalProjectById,
    correctiveActionProjectById
  );
  const auditEvents = auditSourceEntities.length === 0
    ? []
    : await input.dataSource.listAuditEventsByTenantId?.(input.tenantId, {
      limit: 100,
      requiresAttention: true,
      sourceEntities: auditSourceEntities
    }) ?? [];
  items.push(...queueItemsForAuditEvents(
    auditEvents,
    projectById,
    taskProjectById,
    signalProjectById,
    correctiveActionProjectById
  ));

  return sortOperationalControlQueue(items)
    .slice(0, input.limit)
    .map(({ sort: _sort, ...item }) => item);
}

function auditSourceEntitiesForQueue(
  projectById: Map<string, ProjectRecord>,
  taskProjectById: Map<string, string>,
  signalProjectById: Map<string, string>,
  correctiveActionProjectById: Map<string, string>
) {
  return [
    { type: "Project", ids: [...projectById.keys()] },
    { type: "Task", ids: [...taskProjectById.keys()] },
    { type: "ControlSignal", ids: [...signalProjectById.keys()] },
    { type: "CorrectiveAction", ids: [...correctiveActionProjectById.keys()] }
  ].filter((sourceEntity) => sourceEntity.ids.length > 0);
}

function queueItemsForProject(
  project: ProjectRecord,
  asOf: Date
): OperationalControlQueueSortItem[] {
  if (!isDateBefore(project.plannedFinish, asOf)) return [];
  const dueDate = dateOnly(project.plannedFinish);
  return [
    withQueueSort({
      id: `project-overdue:${project.id}`,
      tenantId: project.tenantId,
      signalKind: "project_overdue",
      severity: "critical",
      priority: "critical",
      project: projectContext(project),
      entity: { type: "Project", id: project.id, label: project.title },
      status: { value: project.status },
      dueDate,
      overdue: true,
      reason: `Project planned finish is overdue: ${project.title}`,
      allowedActions: ["open_gantt", "generate_planning_solution"],
      source: { workflow: "project_lifecycle", entityType: "Project", entityId: project.id },
      sourceTimestamps: compactTimestamps({
        createdAt: isoDateTime(project.createdAt),
        updatedAt: isoDateTime(project.activatedAt ?? project.createdAt),
        dueAt: dueDate
      })
    })
  ];
}

function queueItemsForTasks(
  project: ProjectRecord,
  tasks: TaskRecord[],
  asOf: Date
): OperationalControlQueueSortItem[] {
  const items: OperationalControlQueueSortItem[] = [];
  for (const task of tasks) {
    if (task.archivedAt || task.statusCategory === "done") continue;
    if (isDateBefore(task.plannedFinish, asOf)) {
      const dueDate = dateOnly(task.plannedFinish);
      const severity = task.priority === "critical" || task.priority === "high" ? "critical" : "warning";
      items.push(withQueueSort({
        id: `task-overdue:${project.id}:${task.id}`,
        tenantId: task.tenantId,
        signalKind: "task_overdue",
        severity,
        priority: task.priority,
        project: projectContext(project),
        task: taskContext(task),
        entity: { type: "Task", id: task.id, label: task.title },
        status: { value: task.status, category: task.statusCategory },
        dueDate,
        overdue: true,
        reason: `Task is overdue: ${task.title}`,
        allowedActions: ["open_gantt"],
        source: { workflow: "project_work", entityType: "Task", entityId: task.id },
        sourceTimestamps: compactTimestamps({
          createdAt: isoDateTime(task.createdAt),
          updatedAt: isoDateTime(task.updatedAt),
          dueAt: dueDate
        })
      }));
    }
    if (task.statusCategory === "waiting") {
      items.push(withQueueSort({
        id: `task-status:${project.id}:${task.id}`,
        tenantId: task.tenantId,
        signalKind: "task_status",
        severity: "warning",
        priority: task.priority === "critical" ? "critical" : task.priority === "high" ? "high" : "normal",
        project: projectContext(project),
        task: taskContext(task),
        entity: { type: "Task", id: task.id, label: task.title },
        status: { value: task.status, category: task.statusCategory },
        dueDate: dateOnly(task.plannedFinish),
        overdue: isDateBefore(task.plannedFinish, asOf),
        reason: `Task is waiting: ${task.title}`,
        allowedActions: ["open_gantt"],
        source: { workflow: "project_work", entityType: "Task", entityId: task.id },
        sourceTimestamps: compactTimestamps({
          createdAt: isoDateTime(task.createdAt),
          updatedAt: isoDateTime(task.updatedAt),
          dueAt: dateOnly(task.plannedFinish)
        })
      }));
    }
  }
  return items;
}

function queueItemsForControlSignals(
  project: ProjectRecord,
  signals: ControlSignal[]
): OperationalControlQueueSortItem[] {
  return signals
    .filter((signal) => signal.status !== "resolved" && signal.status !== "accepted_risk")
    .map((signal) => withQueueSort({
      id: `control-signal:${project.id}:${signal.id}`,
      tenantId: signal.tenantId,
      signalKind: "control_signal",
      severity: signal.severity,
      priority: priorityForSeverity(signal.severity),
      project: projectContext(project),
      entity: { type: "ControlSignal", id: signal.id, label: signal.explanation },
      status: { value: signal.status },
      dueDate: null,
      overdue: false,
      reason: signal.explanation,
      allowedActions: signal.allowedActions,
      source: {
        workflow: "control",
        entityType: "ControlSignal",
        entityId: signal.id,
        metric: signal.sourceMetric
      },
      sourceTimestamps: compactTimestamps({
        createdAt: signal.createdAt,
        updatedAt: signal.updatedAt
      })
    }));
}

function queueItemsForCorrectiveActions(
  project: ProjectRecord,
  correctiveActions: CorrectiveAction[],
  signalById: Map<string, ControlSignal>,
  asOf: Date
): OperationalControlQueueSortItem[] {
  return correctiveActions
    .filter((action) => action.status === "open" || action.status === "in_progress")
    .map((action) => {
      const signal = signalById.get(action.controlSignalId);
      const overdue = action.dueDate ? isDateStringBefore(action.dueDate, asOf) : false;
      const severity = signal?.severity ?? (overdue ? "critical" : "warning");
      return withQueueSort({
        id: `corrective-action:${project.id}:${action.id}`,
        tenantId: action.tenantId,
        signalKind: "corrective_action",
        severity,
        priority: priorityForSeverity(severity),
        project: projectContext(project),
        entity: { type: "CorrectiveAction", id: action.id, label: action.title },
        status: { value: action.status },
        dueDate: action.dueDate,
        overdue,
        reason: overdue
          ? `Corrective action is overdue: ${action.title}`
          : `Corrective action needs follow-up: ${action.title}`,
        allowedActions: ["create_corrective_action"],
        source: { workflow: "control", entityType: "CorrectiveAction", entityId: action.id },
        sourceTimestamps: compactTimestamps({ dueAt: action.dueDate ?? undefined })
      });
    });
}

function queueItemsForAuditEvents(
  auditEvents: AuditEventListItem[],
  projectById: Map<string, ProjectRecord>,
  taskProjectById: Map<string, string>,
  signalProjectById: Map<string, string>,
  correctiveActionProjectById: Map<string, string>
): OperationalControlQueueSortItem[] {
  return auditEvents.flatMap((event) => {
    if (event.tenantId && !projectById.size) return [];
    const status = stringStatus(event.executionResult?.status);
    const failed = status === "failed" || hasAuditActionSuffix(event.actionType, "failed");
    const denied = status === "denied" || hasAuditActionSuffix(event.actionType, "denied");
    const conflict = status === "conflict" || hasAuditActionSuffix(event.actionType, "conflict");
    if (!failed && !denied && !conflict) return [];
    const project = resolveAuditProject(
      event,
      projectById,
      taskProjectById,
      signalProjectById,
      correctiveActionProjectById
    );
    if (!project) return [];
    const severity: OperationalControlQueueSeverity = failed ? "critical" : "warning";
    return [withQueueSort({
      id: `audit-event:${project.id}:${event.id}`,
      tenantId: event.tenantId,
      signalKind: "audit_event",
      severity,
      priority: priorityForSeverity(severity),
      project: projectContext(project),
      entity: { type: "AuditEvent", id: event.id, label: event.actionType },
      status: { value: status ?? "unknown" },
      dueDate: null,
      overdue: false,
      reason: `Audit event requires attention: ${event.actionType}`,
      allowedActions: [],
      source: {
        workflow: event.sourceWorkflow ?? "audit",
        entityType: "AuditEvent",
        entityId: event.id,
        auditEventId: event.id
      },
      sourceTimestamps: compactTimestamps({ createdAt: isoDateTime(event.createdAt) })
    })];
  });
}

function resolveAuditProject(
  event: AuditEventListItem,
  projectById: Map<string, ProjectRecord>,
  taskProjectById: Map<string, string>,
  signalProjectById: Map<string, string>,
  correctiveActionProjectById: Map<string, string>
): ProjectRecord | undefined {
  const sourceEntity = event.sourceEntity;
  const type = typeof sourceEntity.type === "string" ? sourceEntity.type : undefined;
  const id = typeof sourceEntity.id === "string" ? sourceEntity.id : undefined;
  if (!type || !id) return undefined;
  if (type === "Project") return projectById.get(id);
  if (type === "Task") {
    const projectId = taskProjectById.get(id);
    return projectId ? projectById.get(projectId) : undefined;
  }
  if (type === "ControlSignal") {
    const projectId = signalProjectById.get(id);
    return projectId ? projectById.get(projectId) : undefined;
  }
  if (type === "CorrectiveAction") {
    const projectId = correctiveActionProjectById.get(id);
    return projectId ? projectById.get(projectId) : undefined;
  }
  return undefined;
}

function sortOperationalControlQueue(items: OperationalControlQueueSortItem[]) {
  return items.sort((left, right) =>
    severityRank(left.severity) - severityRank(right.severity) ||
    Number(right.overdue) - Number(left.overdue) ||
    compareNullableDate(left.sort.dueDate, right.sort.dueDate) ||
    priorityRank(left.priority) - priorityRank(right.priority) ||
    right.sort.timestamp.localeCompare(left.sort.timestamp) ||
    left.id.localeCompare(right.id)
  );
}

export function filterAllowedActionsForProfile(
  actions: string[],
  actor: TenantUser,
  profile: AccessProfile
): string[] {
  return actions.filter((action) => {
    const registry = controlSurfaceActionRegistry[action as keyof typeof controlSurfaceActionRegistry];
    if (!registry) return true;
    return registry.requiredPermissions.every(
      (permission) => decisionForPermission(permission, actor, profile).allowed
    );
  });
}

function withQueueSort(item: OperationalControlQueueItem): OperationalControlQueueSortItem {
  return {
    ...item,
    sort: {
      dueDate: item.dueDate,
      timestamp: item.sourceTimestamps.updatedAt ?? item.sourceTimestamps.createdAt ?? item.sourceTimestamps.dueAt ?? ""
    }
  };
}

function projectContext(project: ProjectRecord) {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    plannedFinish: dateOnly(project.plannedFinish)
  };
}

function taskContext(task: TaskRecord) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    statusId: task.statusId,
    statusName: task.statusName,
    statusCategory: task.statusCategory,
    priority: task.priority,
    plannedFinish: dateOnly(task.plannedFinish),
    ownerUserId: task.ownerUserId
  };
}

function priorityForSeverity(severity: OperationalControlQueueSeverity): OperationalControlQueuePriority {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "normal";
}

function severityRank(severity: OperationalControlQueueSeverity): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function priorityRank(priority: OperationalControlQueuePriority): number {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

function compareNullableDate(left: string | null, right: string | null): number {
  if (left && right) return left.localeCompare(right);
  if (left) return -1;
  if (right) return 1;
  return 0;
}

function isDateBefore(value: Date, asOf: Date): boolean {
  return dateOnly(value) < dateOnly(asOf);
}

function isDateStringBefore(value: string, asOf: Date): boolean {
  return value < dateOnly(asOf);
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isoDateTime(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}

function compactTimestamps(input: {
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  dueAt?: string | undefined;
}) {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function stringStatus(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function hasAuditActionSuffix(actionType: string, suffix: "failed" | "denied" | "conflict") {
  return actionType.endsWith(`_${suffix}`) || actionType.endsWith(`.${suffix}`);
}
type RouteParamContext = {
  req: {
    param(name: string): string;
  };
};
