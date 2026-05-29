import type {
  ActionExecution,
  AuditEvent,
  ControlSignal,
  CorrectiveAction,
  KpiDefinition,
  KpiEvaluation
} from "@/lib/api-types";

import { MOCK_TENANT_ID } from "./users";

export const MOCK_KPI_DEFINITIONS = [
  {
    id: "kpi-deadline-delta",
    tenantId: MOCK_TENANT_ID,
    entityType: "project",
    code: "deadline_delta_days",
    label: "Отклонение срока",
    formula: { type: "builtin", key: "deadline_delta_days" },
    unit: "days",
    period: "snapshot",
    thresholdRules: [
      { severity: "warning", operator: "gte", value: 3 },
      { severity: "critical", operator: "gte", value: 7 }
    ],
    ownerRole: "PM",
    allowedActions: ["open_gantt", "move_deadline", "accept_risk"],
    version: 1,
    status: "active"
  },
  {
    id: "kpi-progress",
    tenantId: MOCK_TENANT_ID,
    entityType: "project",
    code: "progress_percent",
    label: "Прогресс",
    formula: { type: "builtin", key: "progress_percent" },
    unit: "percent",
    period: "week",
    thresholdRules: [{ severity: "warning", operator: "lt", value: 65 }],
    ownerRole: "PM",
    allowedActions: ["create_corrective_action", "open_gantt"],
    version: 1,
    status: "active"
  }
] satisfies KpiDefinition[];

export const MOCK_KPI_EVALUATIONS = [
  {
    id: "eval-deadline-1",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-014",
    definitionId: "kpi-deadline-delta",
    definitionVersion: 1,
    formulaVersion: 1,
    sourceData: { baselineFinish: "2026-08-10", currentFinish: "2026-08-15" },
    periodStart: null,
    periodEnd: null,
    threshold: { severity: "warning", operator: "gte", value: 3 },
    calculatedValue: 5,
    severity: "warning",
    evaluatedAt: "2026-05-25T08:00:00.000Z"
  },
  {
    id: "eval-progress-1",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-014",
    definitionId: "kpi-progress",
    definitionVersion: 1,
    formulaVersion: 1,
    sourceData: { plannedPercent: 70, actualPercent: 62 },
    periodStart: "2026-05-18",
    periodEnd: "2026-05-25",
    threshold: { severity: "warning", operator: "lt", value: 65 },
    calculatedValue: 62,
    severity: "warning",
    evaluatedAt: "2026-05-25T08:00:00.000Z"
  }
] satisfies KpiEvaluation[];

export const MOCK_CONTROL_SIGNALS = [
  {
    id: "signal-deadline-1",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-014",
    sourceEntity: { type: "project", id: "PRJ-2026-014" },
    sourceMetric: "deadline_delta_days",
    evaluationId: "eval-deadline-1",
    severity: "warning",
    explanation: "Финиш проекта сдвинут на 5 дней относительно baseline.",
    ownerUserId: "usr-ivanova",
    allowedActions: ["open_gantt", "move_deadline", "accept_risk"],
    scenarioProposals: [
      {
        id: "proposal-compress",
        type: "generate_planning_solution",
        label: "Сжать критический путь",
        targetEntity: { type: "project", id: "PRJ-2026-014" },
        requiredPermissions: ["planning.command.apply"],
        planDelta: { changedTaskIds: ["MDS-39"] },
        input: { profile: "balanced" },
        explainability: {
          reason: "Сдвиг двух задач снижает просрочку до 1 дня.",
          deadlineDeltaDays: -4,
          overloadMinutes: 120,
          changedTaskIds: ["MDS-39"],
          changedAssignmentIds: [],
          riskScore: 18,
          cost: 32000
        }
      }
    ],
    status: "open",
    createdAt: "2026-05-25T08:00:00.000Z",
    updatedAt: "2026-05-25T08:00:00.000Z"
  }
] satisfies ControlSignal[];

export const MOCK_CORRECTIVE_ACTIONS = [
  {
    id: "ca-1",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-014",
    controlSignalId: "signal-deadline-1",
    title: "Согласовать сжатие критического пути",
    description: "Проверить перераспределение 120 минут нагрузки и согласовать с PM.",
    responsibleUserId: "usr-petrov",
    dueDate: "2026-05-27",
    status: "in_progress",
    result: null
  }
] satisfies CorrectiveAction[];

export const MOCK_ACTION_EXECUTIONS = [
  {
    id: "exec-1",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-014",
    actionType: "generate_planning_solution",
    targetEntity: { type: "project", id: "PRJ-2026-014" },
    actorUserId: "usr-ivanova",
    input: { profile: "balanced" },
    previewPayload: { changedTaskIds: ["MDS-39"] },
    resultPayload: null,
    status: "previewed",
    auditEventId: "audit-1",
    createdAt: "2026-05-25T08:05:00.000Z"
  }
] satisfies ActionExecution[];

export const MOCK_AUDIT_EVENTS = [
  {
    id: "audit-1",
    tenantId: MOCK_TENANT_ID,
    actorUserId: "usr-ivanova",
    actionType: "planning.preview",
    sourceSurfaceId: "project-kpi",
    sourceWorkflow: "control",
    sourceEntity: { type: "project", id: "PRJ-2026-014" },
    input: { actionType: "generate_planning_solution" },
    beforeState: null,
    afterState: { status: "previewed" },
    permissionResult: { allowed: true, permission: "planning.command.preview" },
    executionResult: { status: "previewed" },
    correlationId: "corr-2026-05-25-001",
    createdAt: "2026-05-25T08:05:00.000Z"
  },
  {
    id: "audit-2",
    tenantId: MOCK_TENANT_ID,
    actorUserId: "usr-petrov",
    actionType: "task.update",
    sourceSurfaceId: "task-drawer",
    sourceWorkflow: "project-work",
    sourceEntity: { type: "task", id: "MDS-39" },
    input: { progress: 22 },
    beforeState: { progress: 18 },
    afterState: { progress: 22 },
    permissionResult: { allowed: true, permission: "task.update" },
    executionResult: { status: "succeeded" },
    correlationId: "corr-2026-05-24-002",
    createdAt: "2026-05-24T16:20:00.000Z"
  }
] satisfies AuditEvent[];
