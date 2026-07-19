import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import { reducePlanningCommand, type PlanSnapshot, type TenantUser } from "@kiss-pm/domain";
import type { AuditEventRecordInput, DealStageRecord, OpportunityRecord, PlanningScenarioRunRecord, ProjectRecord, TaskRecord, TaskStatusRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource, ClientRecord } from "../apiTypes";
import { createApp } from "../app";
import { createPlanningReadModel } from "../planning/planningReadModel";
import { buildProposalActionMetadata, isAgentToolOfferable } from "./agentRoutes";
import { AGENT_TOOLS } from "./toolRegistry";

const COOKIE = "kiss_pm_session=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

// Снапшот с перегрузкой: две задачи по 480 мин на одного ресурса в один день → overload 480.
function overloadedSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    planVersion: 5,
    project: { id: "project-1", sourceType: "manual", sourceOpportunityId: null, plannedStart: "2026-06-01", plannedFinish: "2026-06-02", deadline: "2026-06-03", calendarId: "cal" },
    tasks: [
      { id: "task-a", parentTaskId: null, wbsCode: "1", title: "A", statusId: "todo", schedulingMode: "auto", taskType: "fixed_work", effortDriven: true, plannedStart: "2026-06-01", plannedFinish: null, durationMinutes: 480, workMinutes: 480, percentComplete: 0, calendarId: "cal", constraint: null },
      { id: "task-b", parentTaskId: null, wbsCode: "2", title: "B", statusId: "todo", schedulingMode: "auto", taskType: "fixed_work", effortDriven: true, plannedStart: "2026-06-01", plannedFinish: null, durationMinutes: 480, workMinutes: 480, percentComplete: 0, calendarId: "cal", constraint: null }
    ],
    assignments: [
      { id: "asg-a", taskId: "task-a", resourceId: "res-1", role: "executor", unitsPermille: 1000, workMinutes: 480, calendarId: null },
      { id: "asg-b", taskId: "task-b", resourceId: "res-1", role: "executor", unitsPermille: 1000, workMinutes: 480, calendarId: null }
    ],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "cal", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [{ id: "res-1", userId: "res-1", positionId: null, teamId: null, name: "Res", calendarId: "cal" }],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-24T00:00:00.000Z"
  };
}

function createHarness(options: { permissions?: AccessProfile["permissions"]; auditPersistence?: boolean } = {}) {
  let snapshot = overloadedSnapshot();
  const runs = new Map<string, PlanningScenarioRunRecord>();
  const appliedCommandTypes: string[] = [];
  const auditActionTypes: string[] = [];
  const auditEvents: AuditEventRecordInput[] = [];
  const updateTaskInputs: Array<Record<string, unknown>> = [];
  const taskUpdatedAt = new Date("2026-06-01T10:00:00.000Z");
  const task: TaskRecord = {
    id: "task-a",
    tenantId: "tenant-1",
    projectId: "project-1",
    stageId: null,
    title: "Смета",
    description: null,
    status: "in_progress",
    statusId: "todo",
    statusName: "В работе",
    statusCategory: "in_progress",
    priority: "normal",
    requesterUserId: "user-planner",
    ownerUserId: "user-planner",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-02T00:00:00.000Z"),
    durationWorkingDays: 1,
    plannedWork: 480,
    actualWork: 120,
    progress: 25,
    requiresAcceptance: false,
    source: "manual",
    createdAt: taskUpdatedAt,
    updatedAt: taskUpdatedAt,
    archivedAt: null,
    participants: [{ userId: "user-planner", role: "executor" }]
  };
  const project = {
    id: "project-1",
    tenantId: "tenant-1",
    title: "Проект",
    status: "active"
  } as ProjectRecord;
  const statuses = [
    { id: "todo", tenantId: "tenant-1", name: "В работе", category: "in_progress", status: "active" },
    { id: "review", tenantId: "tenant-1", name: "Сверка заказчиком", category: "review", status: "active" }
  ] as TaskStatusRecord[];
  // Н15: CRM-фикстуры для offerable-мутаций агента (change_opportunity_stage / update_crm_client).
  const crmTimestamp = new Date("2026-06-01T10:00:00.000Z");
  const client: ClientRecord = {
    id: "client-1",
    tenantId: "tenant-1",
    name: "ООО Ромашка",
    description: "Оптовый заказчик",
    status: "active",
    createdAt: crmTimestamp,
    updatedAt: crmTimestamp
  };
  const updateClientInputs: Array<Record<string, unknown>> = [];
  const dealStages = [
    { id: "stage-new", tenantId: "tenant-1", pipelineId: "pipeline-1", name: "Новая", sortOrder: 1, status: "active", createdAt: crmTimestamp, updatedAt: crmTimestamp },
    { id: "stage-negotiation", tenantId: "tenant-1", pipelineId: "pipeline-1", name: "Переговоры", sortOrder: 2, status: "active", createdAt: crmTimestamp, updatedAt: crmTimestamp }
  ] as DealStageRecord[];
  const opportunity = {
    id: "opp-1",
    tenantId: "tenant-1",
    clientId: "client-1",
    primaryContactId: null,
    ownerUserId: null,
    projectTypeId: null,
    stageId: "stage-new",
    pipelineId: "pipeline-1",
    clientName: "ООО Ромашка",
    contactName: "",
    title: "Сделка на смету",
    projectType: "",
    description: null,
    plannedStart: crmTimestamp,
    plannedFinish: crmTimestamp,
    contractValue: 100_000,
    plannedHourlyRate: 0,
    plannedHours: 0,
    probability: 50,
    status: "intake",
    templateId: null,
    feasibilityStatus: null,
    feasibilityResult: null,
    feasibilityCheckedAt: null,
    createdAt: crmTimestamp,
    updatedAt: crmTimestamp,
    demand: [],
    customFieldValues: {}
  } as OpportunityRecord;
  const stageUpdates: Array<Record<string, unknown>> = [];
  const permissions: AccessProfile["permissions"] = options.permissions ?? [
    "tenant.projects.read",
    "tenant.project_plan.read",
    "tenant.project_plan.manage",
    "tenant.project_resources.read",
    "tenant.project_resources.manage",
    "tenant.planning_scenarios.preview",
    "tenant.planning_scenarios.apply",
    "tenant.tasks.edit",
    "tenant.clients.manage",
    "tenant.opportunities.manage"
  ];

  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() { return []; },
    async findUserById(userId) {
      return userId === "user-planner" ? { id: "user-planner", tenantId: "tenant-1", name: "Планировщик", accessProfileId: "p" } : undefined;
    },
    async findTenantById(tenantId) { return tenantId === "tenant-1" ? { id: tenantId, name: "T" } : undefined; },
    async findAccessProfileById() { return { id: "p", permissions }; },
    async listUsersByTenantId() { return []; },
    async listWorkspaceUsers() {
      // user-planner — активный участник задач (валидация участников в update-команде
      // сверяется с этим списком), res-1 — ресурс планирования.
      const base = {
        tenantId: "tenant-1",
        accessProfileId: "p",
        positionId: null,
        positionName: null,
        phone: null,
        telegram: null,
        status: "active",
        theme: "system",
        accentColor: "blue"
      };
      return [
        { ...base, id: "res-1", name: "Ресурс", email: "resource@kiss-pm.local" },
        { ...base, id: "user-planner", name: "Планировщик", email: "planner@kiss-pm.local" }
      ];
    },
    async findSessionByTokenHash() {
      return { id: "s", tenantId: "tenant-1", userId: "user-planner", tokenHash: "ignored", expiresAt: new Date("2099-01-01T00:00:00.000Z") };
    },
    async withTransaction(operation) { return operation(dataSource as ApiTenantDataSource); },
    async lockTenantResourcePlanning() { return; },
    async listProjects() { return [project]; },
    async listProjectTasks() { return [task]; },
    async findTaskById(_tenantId, taskId) { return taskId === task.id ? task : undefined; },
    async listTaskStatuses() { return statuses; },
    async createTaskActivity() { return undefined as never; },
    async getPlanSnapshot() { return snapshot; },
    async createPlanningScenarioRun(run) {
      const record: PlanningScenarioRunRecord = { ...run, appliedAt: null, rejectedAt: null, rejectedReason: null, createdAt: new Date("2026-06-01T00:00:00.000Z") };
      runs.set(run.id, record);
      return record;
    },
    async findPlanningScenarioRun(_tenantId, _projectId, runId) { return runs.get(runId); },
    async markPlanningScenarioRunApplied({ scenarioRunId, appliedAt }) {
      const record = runs.get(scenarioRunId);
      if (record) runs.set(scenarioRunId, { ...record, appliedAt });
    },
    async markPlanningScenarioRunRejected({ scenarioRunId, rejectedAt, rejectedReason }) {
      const record = runs.get(scenarioRunId);
      if (record) runs.set(scenarioRunId, { ...record, rejectedAt, rejectedReason });
    },
    async applyPlanningCommand({ command }) {
      appliedCommandTypes.push(command.type);
      snapshot = reducePlanningCommand(snapshot, command).nextSnapshot;
    },
    async incrementPlanVersion() { snapshot = { ...snapshot, planVersion: snapshot.planVersion + 1 }; return snapshot.planVersion; },
    async listProjectTaskAssignments() { return []; },
    async updateTaskMetadata(input) {
      updateTaskInputs.push(input as Record<string, unknown>);
      return { ...task, title: (input as { title?: string }).title ?? task.title, updatedAt: new Date("2026-06-01T11:00:00.000Z") };
    },
    // Н15: CRM-персистентность для governed-роутов клиентов и стадий сделок.
    async findClientById(_tenantId, clientId) { return clientId === client.id ? client : undefined; },
    async updateClient(input) {
      updateClientInputs.push(input as unknown as Record<string, unknown>);
      return { ...client, ...input, updatedAt: new Date("2026-06-01T11:00:00.000Z") };
    },
    async findOpportunityById(_tenantId, opportunityId) { return opportunityId === opportunity.id ? opportunity : undefined; },
    async findDealStageById(_tenantId, stageId) { return dealStages.find((stage) => stage.id === stageId); },
    async listStageTransitions() { return []; },
    async updateOpportunityStage(input) {
      stageUpdates.push(input as unknown as Record<string, unknown>);
      return { ...opportunity, stageId: input.stageId, pipelineId: input.pipelineId ?? opportunity.pipelineId };
    },
    ...(options.auditPersistence === false
      ? {}
      : { async appendAuditEvent(input: AuditEventRecordInput) { auditActionTypes.push(input.actionType); auditEvents.push(input); } })
  };

  return { app: createApp({ dataSource: dataSource as ApiTenantDataSource }), dataSource: dataSource as ApiTenantDataSource, task, client, opportunity, updateClientInputs, stageUpdates, appliedCommandTypes, auditActionTypes, auditEvents, updateTaskInputs, get planVersion() { return snapshot.planVersion; } };
}

async function post(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  const res = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", cookie: COOKIE },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("agent /execute → comment_task is wired (no more 501)", () => {
  it("re-dispatches comment_task to the governed comments route instead of returning tool_not_executable_yet", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "comment_task", input: { taskId: "task-x", body: "Готово к проверке" } }]
    });
    const results = execute.body.results as Array<{ tool: string; ok: boolean; status?: number; error?: string }>;
    // Раньше агент отвечал tool_not_executable_yet; теперь действие реально уходит в governed-роут
    // комментариев. В этом harness нет персистентности комментариев → роут отвечает своей ошибкой
    // (persistence_not_configured), что и доказывает: переотправка ДОШЛА до governed-роута.
    expect(results[0]!.error).not.toBe("tool_not_executable_yet");

    expect(["persistence_not_configured", "task_not_found", "permission_missing"]).toContain(results[0]!.error);
  });
});

describe("agent /execute → optimistic task precondition", () => {
  it("returns current task version and does not mutate a stale preview", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "change_task_status",
        input: { projectId: "project-1", taskId: "task-a", statusId: "review" },
        preconditionVersions: { taskUpdatedAt: "2026-05-31T10:00:00.000Z" }
      }]
    });

    expect(execute.status).toBe(200);
    expect(execute.body.applied).toBe(false);
    expect(execute.body.summary).toEqual({
      applied: 0,
      denied: 0,
      conflict: 1,
      failed: 0
    });
    expect(execute.body.results).toMatchObject([{
      ok: false,
      status: "conflict",
      error: "task_version_conflict",
      currentVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
    }]);
    expect(harness.appliedCommandTypes).toEqual([]);
  });

  it("applies a matching task version exactly once", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "change_task_status",
        input: { projectId: "project-1", taskId: "task-a", statusId: "review" },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });

    expect(execute.status).toBe(200);
    expect(execute.body.summary).toEqual({
      applied: 1,
      denied: 0,
      conflict: 0,
      failed: 0
    });
    expect(execute.body.results).toMatchObject([{ ok: true, status: "applied" }]);
    expect(harness.appliedCommandTypes).toEqual(["task.update_status"]);
  });

  it("denies a non-participant before revealing the current task version", async () => {
    const harness = createHarness();
    harness.task.participants = [];
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "change_task_status",
        input: { projectId: "project-1", taskId: "task-a", statusId: "review" }
      }]
    });

    expect(execute.body.results).toMatchObject([{
      tool: "change_task_status",
      ok: false,
      status: "denied",
      error: "task_participant_role_required"
    }]);
    // Отказ тоже адресуем: попытка агента не исчезает из governance trail.
    const denied = (execute.body.results as Array<{ auditEventId?: string; currentVersions?: unknown }>)[0]!;
    expect(denied.auditEventId).toMatch(/^agent-action-/);
    expect(denied.currentVersions).toBeUndefined();
    expect(harness.appliedCommandTypes).toEqual([]);
  });
});

describe("agent /execute → governed scenario apply (internal re-dispatch)", () => {
  it("applies a previewed resource resolution through the agent and bumps the plan version", async () => {
    const harness = createHarness();
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const target = { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds };

    // 1) Превью сценариев через governed-роут → получаем scenarioId.
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", { clientPlanVersion: 5, target });
    expect(preview.status).toBe(200);
    const proposals = preview.body.proposals as Array<{ id: string; conflictEffect: string }>;
    expect(proposals.length).toBeGreaterThan(0);
    const scenarioId = proposals[0]!.id;

    // 2) Применяем выбранный сценарий ЧЕРЕЗ АГЕНТА (/agent/execute) — внутренняя переотправка в scenario-apply.
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "apply_resource_resolution", input: { projectId: "project-1", scenarioId, clientPlanVersion: 5, acceptedRiskReason: "e2e" } }]
    });

    expect(execute.status).toBe(200);
    expect(execute.body.applied).toBe(true);
    const results = execute.body.results as Array<{ tool: string; ok: boolean; error?: string }>;
    expect(results[0]!.ok).toBe(true);
    // Реально применилось: команды плана прошли через governed apply, версия выросла, есть audit.
    expect(harness.appliedCommandTypes.length).toBeGreaterThan(0);
    expect(harness.planVersion).toBe(6);
    expect(harness.auditActionTypes).toContain("planning.scenario.applied");
    // #3 провенанс: помимо штатного planning-аудита агент пишет отдельное событие sourceWorkflow:"agent".
    expect(harness.auditActionTypes).toContain("agent.apply_resource_resolution.applied");
  });

  it("audits denied scenario apply attempts without changing the plan", async () => {
    const harness = createHarness({
      permissions: [
        "tenant.projects.read",
        "tenant.project_plan.read",
        "tenant.project_plan.manage",
        "tenant.project_resources.read",
        "tenant.project_resources.manage",
        "tenant.planning_scenarios.preview"
      ]
    });
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
      clientPlanVersion: 5,
      target: { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }
    });
    const scenarioId = (preview.body.proposals as Array<{ id: string }>)[0]!.id;

    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "apply_resource_resolution", input: { projectId: "project-1", scenarioId, clientPlanVersion: 5, acceptedRiskReason: "e2e" } }]
    });

    expect(execute.status).toBe(200);
    const results = execute.body.results as Array<{ tool: string; ok: boolean; status?: string; error?: string }>;
    expect(results[0]).toMatchObject({ tool: "apply_resource_resolution", ok: false, status: "denied", error: "permission_missing" });
    expect(execute.body.summary).toMatchObject({ denied: 1 });
    expect(harness.appliedCommandTypes).toEqual([]);
    expect(harness.planVersion).toBe(5);
    expect(harness.auditActionTypes).toContain("agent.apply_resource_resolution.denied");
    expect(harness.auditEvents.find((event) => event.actionType === "agent.apply_resource_resolution.denied")).toMatchObject({
      sourceWorkflow: "agent",
      permissionResult: { allowed: false, reason: "permission_missing", via: "agent" },
      executionResult: { status: "denied" }
    });
  });

  it("reports a governed version conflict without applying commands", async () => {
    const harness = createHarness();
    // Проверяем version-lock как доказательство, что переотправка реально доходит до
    // governed-проверок, а не фейк-успех.
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
      clientPlanVersion: 5,
      target: { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }
    });
    const scenarioId = (preview.body.proposals as Array<{ id: string }>)[0]!.id;

    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "apply_resource_resolution", input: { projectId: "project-1", scenarioId, clientPlanVersion: 999, acceptedRiskReason: "e2e" } }]
    });
    expect(execute.status).toBe(200);
    const results = execute.body.results as Array<{ ok: boolean; status: string; error?: string }>;
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.error).toBe("plan_version_conflict");
    expect(results[0]!.status).toBe("conflict");
    expect(harness.appliedCommandTypes).toEqual([]);
  });
});

describe("agent apply truth contract", () => {
  it("reports mixed applied/conflict results with exact counts", async () => {
    const harness = createHarness();
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
      clientPlanVersion: 5,
      target: {
        type: "resource_overload",
        resourceId: overload.resourceId,
        date: overload.date,
        overloadMinutes: overload.overloadMinutes,
        taskIds: overload.taskIds
      }
    });
    const scenarioId = (preview.body.proposals as Array<{ id: string }>)[0]!.id;
    const action = {
      tool: "apply_resource_resolution",
      input: { projectId: "project-1", scenarioId, clientPlanVersion: 5, acceptedRiskReason: "test" }
    };

    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [action, action]
    });

    expect(execute.status).toBe(200);
    expect(execute.body.summary).toEqual({
      applied: 1,
      denied: 0,
      conflict: 1,
      failed: 0
    });
    expect(execute.body.results).toMatchObject([
      { status: "applied", ok: true },
      { status: "conflict", ok: false, error: "plan_version_conflict" }
    ]);
  });

  it("builds proposal before-values from current task data", async () => {
    const task = {
      id: "task-1",
      tenantId: "tenant-1",
      projectId: "project-1",
      title: "Подготовить смету",
      statusId: "task-status-in-progress",
      statusName: "В работе",
      updatedAt: new Date("2026-06-01T10:00:00.000Z"),
      participants: [{ userId: "user-planner", role: "executor" }]
    } as TaskRecord;
    const dataSource = {
      async findTaskById() { return task; },
      async listTaskStatuses() {
        return [{ id: "task-status-review", name: "Сверка заказчиком" }];
      }
    } as unknown as ApiTenantDataSource;
    const actor = { id: "user-planner", tenantId: "tenant-1" } as TenantUser;
    const profile = { id: "reader", permissions: ["tenant.projects.read"] } as AccessProfile;
    await expect(buildProposalActionMetadata(dataSource, actor, profile, {
      tool: "change_task_status",
      input: { taskId: "task-1", statusId: "task-status-review" }
    })).resolves.toEqual({
      title: "Сменить статус задачи: «Подготовить смету» · проект project-1, задача task-1",
      preview: {
        before: "В работе",
        after: "Сверка заказчиком"
      },
      preconditionVersions: {
        taskUpdatedAt: task.updatedAt.toISOString()
      }
    });
  });

  it("does not expose task status or version in /propose metadata to a non-participant", async () => {
    const task = {
      id: "task-1",
      tenantId: "tenant-1",
      projectId: "project-1",
      statusId: "task-status-in-progress",
      statusName: "В работе",
      updatedAt: new Date("2026-06-01T10:00:00.000Z"),
      participants: [{ userId: "user-planner", role: "executor" }]
    } as TaskRecord;
    const dataSource = {
      async findTaskById() { return task; },
      async listTaskStatuses() {
        return [{ id: "task-status-review", name: "Сверка заказчиком" }];
      }
    } as unknown as ApiTenantDataSource;
    const actor = { id: "user-outsider", tenantId: "tenant-1" } as TenantUser;
    const profile = { id: "reader", permissions: ["tenant.projects.read"] } as AccessProfile;

    await expect(buildProposalActionMetadata(dataSource, actor, profile, {
      tool: "change_task_status",
      input: { taskId: "task-1", statusId: "task-status-review" }
    })).resolves.toEqual({
      preview: {
        before: "task-1",
        after: "Сверка заказчиком"
      },
      preconditionVersions: {},
      capability: { allowed: false, reason: "task_participant_role_required" }
    });
  });

  it("protects comment counts while preserving editor access in /propose metadata", async () => {
    const task = {
      id: "task-1",
      tenantId: "tenant-1",
      projectId: "project-1",
      title: "Подготовить смету",
      requesterUserId: "user-planner",
      participants: [{ userId: "user-planner", role: "executor" }]
    } as TaskRecord;
    let activityReads = 0;
    const dataSource = {
      async findTaskById() { return task; },
      async listTaskActivities() {
        activityReads += 1;
        return [{ type: "comment" }, { type: "status_change" }];
      }
    } as unknown as ApiTenantDataSource;
    const actor = { id: "user-outsider", tenantId: "tenant-1" } as TenantUser;
    const action = {
      tool: "comment_task",
      input: { taskId: "task-1", body: "Готово" }
    };

    await expect(buildProposalActionMetadata(
      dataSource,
      actor,
      { id: "reader", permissions: ["tenant.projects.read"] } as AccessProfile,
      action
    )).resolves.toEqual({
      preview: {
        before: "Количество комментариев недоступно",
        after: "Готово"
      },
      preconditionVersions: {},
      capability: { allowed: false, reason: "task_participant_required" }
    });
    expect(activityReads).toBe(0);

    await expect(buildProposalActionMetadata(
      dataSource,
      actor,
      { id: "editor", permissions: ["tenant.tasks.edit"] } as AccessProfile,
      action
    )).resolves.toEqual({
      title: "Прокомментировать задачу: «Подготовить смету» · проект project-1, задача task-1",
      preview: {
        before: "Комментариев: 1",
        after: "Готово"
      },
      preconditionVersions: {}
    });
    expect(activityReads).toBe(1);
  });

  it("labels otherwise identical authorized task proposals with server-derived target identity", async () => {
    const tasks: Record<string, TaskRecord> = {
      "task-a": {
        id: "task-a",
        tenantId: "tenant-1",
        projectId: "project-1",
        title: "Проверить смету",
        statusId: "task-status-in-progress",
        statusName: "В работе",
        updatedAt: new Date("2026-06-01T10:00:00.000Z"),
        participants: [{ userId: "user-planner", role: "executor" }]
      } as TaskRecord,
      "task-b": {
        id: "task-b",
        tenantId: "tenant-1",
        projectId: "project-1",
        title: "Проверить смету",
        statusId: "task-status-in-progress",
        statusName: "В работе",
        updatedAt: new Date("2026-06-01T10:00:00.000Z"),
        participants: [{ userId: "user-planner", role: "executor" }]
      } as TaskRecord
    };
    const dataSource = {
      async findTaskById(_tenantId: string, taskId: string) { return tasks[taskId]; },
      async listTaskStatuses() {
        return [{ id: "task-status-review", name: "Сверка заказчиком" }];
      }
    } as unknown as ApiTenantDataSource;
    const actor = { id: "user-planner", tenantId: "tenant-1" } as TenantUser;
    const profile = { id: "reader", permissions: ["tenant.projects.read"] } as AccessProfile;

    const first = await buildProposalActionMetadata(dataSource, actor, profile, {
      tool: "change_task_status",
      input: { taskId: "task-a", statusId: "task-status-review" }
    });
    const second = await buildProposalActionMetadata(dataSource, actor, profile, {
      tool: "change_task_status",
      input: { taskId: "task-b", statusId: "task-status-review" }
    });

    expect(first.preview).toEqual(second.preview);
    expect([first.title, second.title]).toEqual([
      "Сменить статус задачи: «Проверить смету» · проект project-1, задача task-a",
      "Сменить статус задачи: «Проверить смету» · проект project-1, задача task-b"
    ]);
  });
  it("does not read plan snapshots for a plan manager without planning read access", async () => {
    let snapshotReads = 0;
    const dataSource = {
      async getPlanSnapshot() {
        snapshotReads += 1;
        throw new Error("plan snapshot must not be read");
      }
    } as unknown as ApiTenantDataSource;
    const actor = { id: "user-planner", tenantId: "tenant-1" } as TenantUser;
    const profile = { id: "planner", permissions: ["tenant.project_plan.manage"] } as AccessProfile;

    await expect(buildProposalActionMetadata(dataSource, actor, profile, {
      tool: "apply_plan_commands",
      input: { projectId: "project-1", commands: [{}] }
    })).resolves.toEqual({
      preview: {
        before: "Версия плана недоступна",
        after: "Команд плана: 1"
      },
      preconditionVersions: {},
      capability: { allowed: false, reason: "permission_missing" }
    });
    expect(snapshotReads).toBe(0);
  });
  it("offers read-only bindings but withholds mutations without a complete review preview", () => {
    const byName = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]));

    expect(isAgentToolOfferable(byName.get("check_opportunity_feasibility")!)).toBe(true);
    expect(isAgentToolOfferable(byName.get("change_task_status")!)).toBe(true);
    expect(isAgentToolOfferable(byName.get("comment_task")!)).toBe(true);
    // D2/D3: create_task и apply_resource_resolution получили payload-backed карточки.
    expect(isAgentToolOfferable(byName.get("create_task")!)).toBe(true);
    expect(isAgentToolOfferable(byName.get("apply_resource_resolution")!)).toBe(true);
    expect(isAgentToolOfferable(byName.get("update_task")!)).toBe(true);
    expect(isAgentToolOfferable(byName.get("create_crm_client")!)).toBe(false);
    expect(isAgentToolOfferable(byName.get("apply_plan_commands")!)).toBe(false);
  });
});

describe("D2/D3: payload-backed карточки offerable-мутаций", () => {
  const plannerActor: TenantUser = { id: "user-planner", tenantId: "tenant-1", name: "Планировщик", accessProfileId: "p" };
  const plannerProfile = {
    id: "p",
    permissions: [
      "tenant.projects.read",
      "tenant.project_plan.read",
      "tenant.project_plan.manage",
      "tenant.project_resources.read",
      "tenant.project_resources.manage",
      "tenant.planning_scenarios.preview",
      "tenant.planning_scenarios.apply",
      "tenant.tasks.create"
    ]
  } as never;

  it("create_task: карточка показывает всё создаваемое, включая серверные дефолты", async () => {
    const harness = createHarness();
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, plannerActor, plannerProfile,
      { tool: "create_task", input: { title: "Проверить смету", projectId: "project-1" } }
    );

    expect(metadata.title).toContain("Создать задачу: «Проверить смету»");
    expect(metadata.title).toContain("Проект");
    expect(metadata.preview.before).toBe("Задачи не существует");
    // Дефолты execute-ветки честно видны до применения: 8 ч, приоритет и исполнитель-автор.
    expect(metadata.preview.after).toContain("8 ч");
    expect(metadata.preview.after).toContain("приоритет: normal");
    expect(metadata.preview.after).toContain("исполнитель: вы");
    expect(metadata.preview.after).toMatch(/\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}/);
  });

  it("create_task: явные участники, приоритет и описание видны в карточке (ревью #248 — без одобрения вслепую)", async () => {
    const harness = createHarness();
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, plannerActor, plannerProfile,
      {
        tool: "create_task",
        input: {
          title: "Задача",
          projectId: "project-1",
          priority: "high",
          description: "Проверить смету по разделу электрики до пятницы",
          participants: [{ userId: "user-exec", role: "executor" }, { userId: "user-co", role: "co_executor" }]
        }
      }
    );
    expect(metadata.preview.after).toContain("приоритет: high");
    expect(metadata.preview.after).toContain("user-exec (executor)");
    expect(metadata.preview.after).toContain("user-co (co_executor)");
    expect(metadata.preview.after).toContain("описание: «Проверить смету");
  });

  it("create_task: несуществующий проект честно маркируется в карточке", async () => {
    const harness = createHarness();
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, plannerActor, plannerProfile,
      { tool: "create_task", input: { title: "Задача", projectId: "project-ghost" } }
    );
    expect(metadata.preview.after).toContain("не найден");
  });

  it("apply_resource_resolution: карточка строится из persisted scenario run с версией плана в preconditions", async () => {
    const harness = createHarness();
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
      clientPlanVersion: 5,
      target: { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }
    });
    const scenarioId = (preview.body.proposals as Array<{ id: string }>)[0]!.id;

    const metadata = await buildProposalActionMetadata(
      harness.dataSource, plannerActor, plannerProfile,
      { tool: "apply_resource_resolution", input: { projectId: "project-1", scenarioId } }
    );

    expect(metadata.title).toContain("Применить сценарий разрешения перегрузки");
    expect(metadata.preview.before).toContain("План v5");
    expect(metadata.preview.before).toContain(overload.resourceId);
    expect(metadata.preview.after).toMatch(/Команд плана: \d+/);
    // Entity-последствия видны до подтверждения (ревью #248): какие задачи/назначения.
    expect(metadata.preview.after).toMatch(/задач затронуто: \d+/);
    expect(metadata.preview.after).toMatch(/назначений: \d+/);
    expect(metadata.preview.after).toContain("действует до");
    expect(metadata.preconditionVersions).toEqual({ planVersion: 5 });
    expect(metadata.capability).toBeUndefined();
  });

  it("apply_resource_resolution: неизвестный/чужой scenarioId — единый честный отказ без раскрытия существования", async () => {
    const harness = createHarness();
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, plannerActor, plannerProfile,
      { tool: "apply_resource_resolution", input: { projectId: "project-1", scenarioId: "scenario-ghost" } }
    );
    expect(metadata.capability).toEqual({ allowed: false, reason: "scenario_not_found" });
    expect(metadata.preview.before).toContain("не найден");
  });

  it("update_task: карточка показывает field-level diff и версию задачи в preconditions", async () => {
    const harness = createHarness();
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, plannerActor, plannerProfile,
      { tool: "update_task", input: { taskId: "task-a", fields: { title: "Новое название", priority: "high" } } }
    );
    expect(metadata.title).toContain("Изменить задачу: «Смета»");
    expect(metadata.preview.after).toContain("название: Смета → Новое название");
    expect(metadata.preview.after).toContain("приоритет: normal → high");
    expect(metadata.preconditionVersions).toEqual({ taskUpdatedAt: "2026-06-01T10:00:00.000Z" });
  });

  it("update_task: execute мёржит частичные поля и СОХРАНЯЕТ участников и статус", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "update_task",
        input: { taskId: "task-a", fields: { title: "Обновлённая смета" } },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });

    expect(execute.status).toBe(200);
    expect((execute.body.results as Array<{ status: string; error?: string }>)[0]!.error).toBeUndefined();
    expect((execute.body.results as Array<{ status: string }>)[0]).toMatchObject({ status: "applied" });
    // Метаданные (участники/приоритет) идут через updateTaskMetadata — участники
    // НЕ затёрты, незатронутый приоритет пришёл из текущего состояния.
    expect(harness.updateTaskInputs).toHaveLength(1);
    const patched = harness.updateTaskInputs[0]!;
    // Исходный executor сохранён (команда штатно дополняет постановщика).
    expect(patched.participants).toEqual(expect.arrayContaining([{ userId: "user-planner", role: "executor" }]));
    expect(patched.priority).toBe("normal");
    // Название/расписание уходят planning-командой в governed apply.
    expect(harness.appliedCommandTypes).toContain("task.update_identity");
  });

  it("update_task: без preconditionVersions.taskUpdatedAt — fail-closed 400", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "update_task", input: { taskId: "task-a", fields: { title: "Без версии" } } }]
    });
    expect((execute.body.results as Array<{ status: string; error?: string }>)[0]).toMatchObject({
      status: "failed",
      error: "missing_precondition_versions"
    });
    expect(harness.updateTaskInputs).toHaveLength(0);
  });

  it("update_task: неизвестное поле отвергается, а не игнорируется молча", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "update_task",
        input: { taskId: "task-a", fields: { participants: [] } },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });
    expect((execute.body.results as Array<{ error?: string }>)[0]!.error).toBe("unsupported_update_field");
    expect(harness.updateTaskInputs).toHaveLength(0);
  });

  it("update_task: requiresAcceptance задачи переживает частичный merge (не дефолтится в false)", async () => {
    const harness = createHarness();
    harness.task.requiresAcceptance = true;
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "update_task",
        input: { taskId: "task-a", fields: { priority: "high" } },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });
    expect((execute.body.results as Array<{ status: string }>)[0]).toMatchObject({ status: "applied" });
    expect(harness.updateTaskInputs).toHaveLength(1);
    // Парсер PATCH дефолтит отсутствующий requiresAcceptance в false — merge обязан
    // переносить его из текущего состояния, иначе одобрение смены приоритета
    // молча выключало бы приёмку.
    expect(harness.updateTaskInputs[0]!.requiresAcceptance).toBe(true);
  });

  it("update_task: невалидное значение поля отвергается кодом парсера, а не фолбэчится молча", async () => {
    const harness = createHarness();
    // Строка вместо числа: раньше numberInput молча подставлял текущее значение,
    // и квитанция была «applied» без применения показанного в карточке. Теперь
    // валидация — тем же parseUpdateTaskBody, что и governed PATCH (единые коды).
    const strAsNumber = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "update_task",
        input: { taskId: "task-a", fields: { plannedWork: "16" } },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });
    // Нечисловой тип ловит типовой гард (до парсера), дробь — сам парсер.
    expect((strAsNumber.body.results as Array<{ status: string; error?: string }>)[0]).toMatchObject({
      status: "failed",
      error: "invalid_update_field_value"
    });
    // Дробное значение: раньше проходило агентскую проверку (конечное > 0), парсер
    // отвергает (целые 1..10000) — карточка-пустышка больше не «одобряема».
    const fractional = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "update_task",
        input: { taskId: "task-a", fields: { plannedWork: 8.5 } },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });
    expect((fractional.body.results as Array<{ error?: string }>)[0]!.error).toBe("invalid_task_planned_work");
    // Дробная длительность раньше МОЛЧА дефолтилась парсером в 1 — теперь честный отказ.
    const fractionalDuration = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "update_task",
        input: { taskId: "task-a", fields: { durationWorkingDays: 8.5 } },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });
    expect((fractionalDuration.body.results as Array<{ error?: string }>)[0]!.error).toBe("invalid_task_duration");
    // Нестроковые description/priority парсер нормализует (null/"normal") — без
    // типового гарда карточка «описание → 123» молча ОЧИЩАЛА бы описание.
    const nonStringDescription = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "update_task",
        input: { taskId: "task-a", fields: { description: 123 } },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });
    expect((nonStringDescription.body.results as Array<{ error?: string }>)[0]!.error).toBe("invalid_update_field_value");
    const nonStringPriority = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "update_task",
        input: { taskId: "task-a", fields: { priority: 123 } },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });
    expect((nonStringPriority.body.results as Array<{ error?: string }>)[0]!.error).toBe("invalid_update_field_value");
    expect(harness.updateTaskInputs).toHaveLength(0);
  });

  it("update_task: карточка честно блокирует невалидное значение и prototype-ключ не роняет propose", async () => {
    const harness = createHarness();
    // Значение, которое execute гарантированно отвергнет, видно уже на карточке.
    const invalid = await buildProposalActionMetadata(
      harness.dataSource, plannerActor, plannerProfile,
      { tool: "update_task", input: { taskId: "task-a", fields: { plannedWork: 8.5 } } }
    );
    expect(invalid.capability).toEqual({ allowed: false, reason: "invalid_task_planned_work" });
    // Ключ из Object.prototype раньше обходил ветку «не поддерживается» и ронял
    // propose TypeError'ом (known.current is not a function).
    const proto = await buildProposalActionMetadata(
      harness.dataSource, plannerActor, plannerProfile,
      { tool: "update_task", input: { taskId: "task-a", fields: { toString: "x" } } }
    );
    expect(proto.preview.after).toContain("toString: не поддерживается");
    expect(proto.capability).toEqual({ allowed: false, reason: "unsupported_update_field" });
  });

  it("update_task: устаревшая версия — conflict с currentVersions для refresh/retry", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "update_task",
        input: { taskId: "task-a", fields: { title: "Устаревшая правка" } },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T09:00:00.000Z" }
      }]
    });
    expect((execute.body.results as Array<{ status: string; error?: string; currentVersions?: unknown }>)[0]).toMatchObject({
      status: "conflict",
      error: "task_version_conflict",
      currentVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
    });
    expect(harness.updateTaskInputs).toHaveLength(0);
  });

  it("apply_resource_resolution: отклонённый run — карточка с capability scenario_rejected", async () => {
    const harness = createHarness();
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
      clientPlanVersion: 5,
      target: { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }
    });
    const scenarioId = (preview.body.proposals as Array<{ id: string }>)[0]!.id;
    const reject = await post(harness.app, `/api/workspace/projects/project-1/planning/scenarios/${scenarioId}/reject`, {});
    expect(reject.status).toBe(200);

    const metadata = await buildProposalActionMetadata(
      harness.dataSource, plannerActor, plannerProfile,
      { tool: "apply_resource_resolution", input: { projectId: "project-1", scenarioId } }
    );
    expect(metadata.capability).toEqual({ allowed: false, reason: "scenario_rejected" });
    expect(metadata.preview.after).toContain("Сценарий отклонён");
  });

  it("execute принимает planVersion из preconditionVersions карточки (без серверной подстановки)", async () => {
    const harness = createHarness();
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
      clientPlanVersion: 5,
      target: { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }
    });
    const scenarioId = (preview.body.proposals as Array<{ id: string }>)[0]!.id;

    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "apply_resource_resolution",
        input: { projectId: "project-1", scenarioId, acceptedRiskReason: "test" },
        preconditionVersions: { planVersion: 5 }
      }]
    });

    expect(execute.status).toBe(200);
    expect((execute.body.results as Array<{ status: string }>)[0]!.status).toBe("applied");
    expect(harness.planVersion).toBe(6);
  });
});

describe("agent /execute → strict plan version precondition (no optimistic-lock bypass)", () => {
  it("rejects apply_resource_resolution without clientPlanVersion instead of substituting the current version", async () => {
    const harness = createHarness();
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
      clientPlanVersion: 5,
      target: { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }
    });
    const scenarioId = (preview.body.proposals as Array<{ id: string }>)[0]!.id;

    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "apply_resource_resolution", input: { projectId: "project-1", scenarioId, acceptedRiskReason: "test" } }]
    });

    expect(execute.status).toBe(200);
    expect(execute.body.results).toMatchObject([{ ok: false, status: "failed", error: "missing_precondition_versions" }]);
    expect(harness.appliedCommandTypes).toEqual([]);
    expect(harness.planVersion).toBe(5);
  });

  it("rejects apply_plan_commands without clientPlanVersion instead of substituting the current version", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "apply_plan_commands",
        input: { projectId: "project-1", commands: [{ type: "task.update_status", taskId: "task-a", statusId: "review" }] }
      }]
    });

    expect(execute.status).toBe(200);
    expect(execute.body.results).toMatchObject([{ ok: false, status: "failed", error: "missing_precondition_versions" }]);
    expect(harness.appliedCommandTypes).toEqual([]);
    expect(harness.planVersion).toBe(5);
  });
});

describe("agent /execute → addressable receipt (auditEventId / correlationId)", () => {
  it("returns per-action auditEventId and batch correlationId matching the persisted agent audit events", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "change_task_status",
        input: { projectId: "project-1", taskId: "task-a", statusId: "review" },
        preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });

    expect(execute.status).toBe(200);
    const results = execute.body.results as Array<{ status: string; auditEventId?: string }>;
    expect(results[0]!.status).toBe("applied");
    expect(results[0]!.auditEventId).toMatch(/^agent-action-/);
    expect(execute.body.correlationId).toMatch(/^agent-execute-/);
    const agentEvent = harness.auditEvents.find((event) => event.actionType === "agent.change_task_status.applied");
    expect(agentEvent?.id).toBe(results[0]!.auditEventId);
    expect(agentEvent?.correlationId).toBe(execute.body.correlationId);
  });

  it("exposes the planning commit id and new plan version for an agent-applied scenario", async () => {
    const harness = createHarness();
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
      clientPlanVersion: 5,
      target: { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }
    });
    const scenarioId = (preview.body.proposals as Array<{ id: string }>)[0]!.id;

    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "apply_resource_resolution", input: { projectId: "project-1", scenarioId, clientPlanVersion: 5, acceptedRiskReason: "test" } }]
    });

    const results = execute.body.results as Array<{ status: string; auditEventId?: string; planningAuditEventId?: string; planVersion?: number }>;
    expect(results[0]!.status).toBe("applied");
    // planningAuditEventId — это событие штатного planning-аудита (видимое в «Коммитах»),
    // а auditEventId — отдельное agent-provenance событие; они обязаны различаться.
    const planningEvent = harness.auditEvents.find((event) => event.actionType === "planning.scenario.applied");
    expect(results[0]!.planningAuditEventId).toBe(planningEvent?.id);
    expect(results[0]!.planVersion).toBe(6);
    expect(results[0]!.auditEventId).toMatch(/^agent-action-/);
    expect(results[0]!.auditEventId).not.toBe(results[0]!.planningAuditEventId);
  });

  it("fail-closed: returns no receipt fields when audit persistence is not configured", async () => {
    const harness = createHarness({ auditPersistence: false });
    // comment_task уходит в governed-роут комментариев, который без персистентности отвечает
    // своей ошибкой (без applied-исхода) — квитанции в ответе быть не должно.
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "comment_task", input: { taskId: "task-a", body: "Проверка" } }]
    });

    expect(execute.status).toBe(200);
    const results = execute.body.results as Array<{ status: string; auditEventId?: string }>;
    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.auditEventId).toBeUndefined();
    expect(execute.body.correlationId).toBeUndefined();
    expect(harness.appliedCommandTypes).toEqual([]);
  });

  it("does not attach auditEventId to conflict results (no audit event is written for them)", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{
        tool: "change_task_status",
        input: { projectId: "project-1", taskId: "task-a", statusId: "review" },
        preconditionVersions: { taskUpdatedAt: "2026-05-31T10:00:00.000Z" }
      }]
    });

    const results = execute.body.results as Array<{ status: string; auditEventId?: string }>;
    expect(results[0]!.status).toBe("conflict");
    expect(results[0]!.auditEventId).toBeUndefined();
    expect(execute.body.correlationId).toBeUndefined();
  });
});

describe("Н15: offerable CRM-мутации агента (change_opportunity_stage / update_crm_client)", () => {
  const crmActor: TenantUser = { id: "user-planner", tenantId: "tenant-1", name: "Планировщик", accessProfileId: "p" };
  const crmProfile = {
    id: "p",
    permissions: ["tenant.clients.manage", "tenant.opportunities.manage"]
  } as never;
  const readerProfile = { id: "reader", permissions: ["tenant.projects.read"] } as never;

  it("оба инструмента стали offerable (payload-backed карточки есть)", () => {
    const byName = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]));
    expect(isAgentToolOfferable(byName.get("change_opportunity_stage")!)).toBe(true);
    expect(isAgentToolOfferable(byName.get("update_crm_client")!)).toBe(true);
    // Остальные CRM-мутации по-прежнему вне набора — generic-preview недостаточно честен.
    expect(isAgentToolOfferable(byName.get("update_crm_opportunity")!)).toBe(false);
    expect(isAgentToolOfferable(byName.get("create_crm_client")!)).toBe(false);
  });

  it("change_opportunity_stage: карточка «было → станет» из текущего состояния и честная пометка об отсутствии optimistic-lock", async () => {
    const harness = createHarness();
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, crmActor, crmProfile,
      { tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "stage-negotiation" } }
    );
    expect(metadata.title).toBe("Сменить стадию сделки: «Сделка на смету» · сделка opp-1");
    expect(metadata.preview.before).toBe("стадия: Новая");
    expect(metadata.preview.after).toContain("стадия: Новая → Переговоры");
    // Optimistic-lock у сделок отсутствует — карточка честно предупреждает,
    // preconditionVersions пуст (execute идёт без версии записи).
    expect(metadata.preview.after).toContain("версия записи не проверяется");
    expect(metadata.preconditionVersions).toEqual({});
    expect(metadata.capability).toBeUndefined();
  });

  it("change_opportunity_stage: карточка честно блокирует несуществующую стадию и невалидный id кодами governed-парсера", async () => {
    const harness = createHarness();
    const ghostStage = await buildProposalActionMetadata(
      harness.dataSource, crmActor, crmProfile,
      { tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "stage-ghost" } }
    );
    expect(ghostStage.capability).toEqual({ allowed: false, reason: "deal_stage_not_found" });

    const invalidStageId = await buildProposalActionMetadata(
      harness.dataSource, crmActor, crmProfile,
      { tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "X!!" } }
    );
    expect(invalidStageId.capability).toEqual({ allowed: false, reason: "invalid_deal_stage_id" });
  });

  it("change_opportunity_stage: правило перехода воронки блокирует карточку (как governed PATCH, ревью #262)", async () => {
    const harness = createHarness();
    // Переход stage-new → stage-negotiation требует подтверждённой реализуемости,
    // а у сделки feasibilityStatus null — governed-роут отверг бы, значит и карточка.
    harness.dataSource.listStageTransitions = async () => [
      { id: "tr-1", tenantId: "tenant-1", pipelineId: "pipeline-1", fromStageId: "stage-new", toStageId: "stage-negotiation", requireFeasibilityOk: true, minProbability: null } as never
    ];
    const blocked = await buildProposalActionMetadata(
      harness.dataSource, crmActor, crmProfile,
      { tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "stage-negotiation" } }
    );
    expect(blocked.capability?.allowed).toBe(false);
    expect(blocked.capability?.reason).toBe("condition_feasibility");
  });

  it("change_opportunity_stage: без прав карточка не раскрывает данные сделки", async () => {
    const harness = createHarness();
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, crmActor, readerProfile,
      { tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "stage-negotiation" } }
    );
    expect(metadata.preview.before).toBe("Данные сделки недоступны");
    expect(metadata.title).toBeUndefined();
    expect(metadata.capability).toEqual({ allowed: false, reason: "opportunity_manage_permission_required" });
  });

  it("change_opportunity_stage: финальная сделка — карточка честно блокирует переход (opportunity_stage_locked)", async () => {
    const harness = createHarness();
    harness.opportunity.status = "won_closed";
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, crmActor, crmProfile,
      { tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "stage-negotiation" } }
    );
    expect(metadata.capability).toEqual({ allowed: false, reason: "opportunity_stage_locked" });
  });

  it("change_opportunity_stage: execute переотправляет в governed /stage — реальная смена, правила воронки и двойной audit", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "stage-negotiation" } }]
    });

    expect(execute.status).toBe(200);
    expect((execute.body.results as Array<{ status: string; error?: string }>)[0]!.error).toBeUndefined();
    expect((execute.body.results as Array<{ status: string }>)[0]).toMatchObject({ status: "applied" });
    expect(harness.stageUpdates).toEqual([
      { tenantId: "tenant-1", opportunityId: "opp-1", stageId: "stage-negotiation", pipelineId: "pipeline-1" }
    ]);
    // Штатный audit governed-роута + отдельное agent-provenance событие.
    expect(harness.auditActionTypes).toContain("opportunity.stage_updated");
    expect(harness.auditActionTypes).toContain("agent.change_opportunity_stage.applied");
    // Честный audit-before: текущая стадия из состояния, а не эхо входа.
    const agentEvent = harness.auditEvents.find((event) => event.actionType === "agent.change_opportunity_stage.applied");
    expect(agentEvent?.beforeState).toEqual({ value: "Новая" });
  });

  it("change_opportunity_stage: невалидный stageId на execute — fail-closed кодом парсера, без переотправки", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "X!!" } }]
    });
    expect((execute.body.results as Array<{ status: string; error?: string }>)[0]).toMatchObject({
      status: "failed",
      error: "invalid_deal_stage_id"
    });
    expect(harness.stageUpdates).toEqual([]);
  });

  it("change_opportunity_stage: финальная сделка на execute — конфликт governed-роута (opportunity_stage_locked)", async () => {
    const harness = createHarness();
    harness.opportunity.status = "won_closed";
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "stage-negotiation" } }]
    });
    expect((execute.body.results as Array<{ status: string; error?: string }>)[0]).toMatchObject({
      status: "conflict",
      error: "opportunity_stage_locked"
    });
    expect(harness.stageUpdates).toEqual([]);
  });

  it("change_opportunity_stage: без права tenant.opportunities.manage — denied с agent-audit", async () => {
    const harness = createHarness({ permissions: ["tenant.projects.read"] });
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "change_opportunity_stage", input: { opportunityId: "opp-1", stageId: "stage-negotiation" } }]
    });
    expect((execute.body.results as Array<{ status: string; error?: string }>)[0]).toMatchObject({
      status: "denied",
      error: "permission_missing"
    });
    expect(harness.stageUpdates).toEqual([]);
    expect(harness.auditActionTypes).toContain("agent.change_opportunity_stage.denied");
  });

  it("update_crm_client: карточка показывает field-level diff и честную пометку об отсутствии optimistic-lock", async () => {
    const harness = createHarness();
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, crmActor, crmProfile,
      { tool: "update_crm_client", input: { clientId: "client-1", fields: { name: "ООО Лютик", status: "archived" } } }
    );
    expect(metadata.title).toBe("Изменить клиента: «ООО Ромашка» · клиент client-1");
    expect(metadata.preview.before).toBe("название: ООО Ромашка; статус: active");
    expect(metadata.preview.after).toContain("название: ООО Ромашка → ООО Лютик");
    expect(metadata.preview.after).toContain("статус: active → archived");
    expect(metadata.preview.after).toContain("версия записи не проверяется");
    expect(metadata.preconditionVersions).toEqual({});
    expect(metadata.capability).toBeUndefined();
  });

  it("update_crm_client: карточка честно блокирует неизвестное поле, нестроковое значение и невалидный enum статуса", async () => {
    const harness = createHarness();
    // Поле из старого (нечестного) описания инструмента — в контракте клиента его нет.
    const unknownField = await buildProposalActionMetadata(
      harness.dataSource, crmActor, crmProfile,
      { tool: "update_crm_client", input: { clientId: "client-1", fields: { website: "https://x" } } }
    );
    expect(unknownField.preview.after).toContain("website: не поддерживается");
    expect(unknownField.capability).toEqual({ allowed: false, reason: "unsupported_update_field" });
    // Нестроковое значение: getOptionalString парсера молча превратил бы его в null —
    // типовой гард отказывает fail-closed (урок ревью #257).
    const nonString = await buildProposalActionMetadata(
      harness.dataSource, crmActor, crmProfile,
      { tool: "update_crm_client", input: { clientId: "client-1", fields: { description: 123 } } }
    );
    expect(nonString.capability).toEqual({ allowed: false, reason: "invalid_update_field_value" });
    // Невалидный enum ловит ТОТ ЖЕ парсер, что и governed PATCH.
    const badStatus = await buildProposalActionMetadata(
      harness.dataSource, crmActor, crmProfile,
      { tool: "update_crm_client", input: { clientId: "client-1", fields: { status: "paused" } } }
    );
    expect(badStatus.capability).toEqual({ allowed: false, reason: "invalid_status" });
  });

  it("update_crm_client: без прав карточка не раскрывает данные клиента", async () => {
    const harness = createHarness();
    const metadata = await buildProposalActionMetadata(
      harness.dataSource, crmActor, readerProfile,
      { tool: "update_crm_client", input: { clientId: "client-1", fields: { name: "ООО Лютик" } } }
    );
    expect(metadata.preview.before).toBe("Данные клиента недоступны");
    expect(metadata.title).toBeUndefined();
    expect(metadata.capability).toEqual({ allowed: false, reason: "client_manage_permission_required" });
  });

  it("update_crm_client: execute мёржит частичные поля и СОХРАНЯЕТ незатронутые описание и статус", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "update_crm_client", input: { clientId: "client-1", fields: { name: "ООО Лютик" } } }]
    });

    expect(execute.status).toBe(200);
    expect((execute.body.results as Array<{ status: string; error?: string }>)[0]!.error).toBeUndefined();
    expect((execute.body.results as Array<{ status: string }>)[0]).toMatchObject({ status: "applied" });
    // Незатронутые поля пришли из текущего состояния, а не сброшены дефолтами парсера.
    expect(harness.updateClientInputs).toEqual([{
      id: "client-1",
      tenantId: "tenant-1",
      name: "ООО Лютик",
      description: "Оптовый заказчик",
      status: "active"
    }]);
    expect(harness.auditActionTypes).toContain("client.updated");
    expect(harness.auditActionTypes).toContain("agent.update_crm_client.applied");
  });

  it("update_crm_client: неизвестное поле и невалидные значения отвергаются fail-closed до переотправки", async () => {
    const harness = createHarness();
    const unknownField = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "update_crm_client", input: { clientId: "client-1", fields: { website: "https://x" } } }]
    });
    expect((unknownField.body.results as Array<{ error?: string }>)[0]!.error).toBe("unsupported_update_field");

    const nonString = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "update_crm_client", input: { clientId: "client-1", fields: { description: 123 } } }]
    });
    expect((nonString.body.results as Array<{ error?: string }>)[0]!.error).toBe("invalid_update_field_value");

    const badStatus = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "update_crm_client", input: { clientId: "client-1", fields: { status: "paused" } } }]
    });
    expect((badStatus.body.results as Array<{ error?: string }>)[0]!.error).toBe("invalid_status");
    expect(harness.updateClientInputs).toEqual([]);
  });

  it("update_crm_client: неизвестный клиент — честный 404 без переотправки", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "update_crm_client", input: { clientId: "client-ghost", fields: { name: "ООО Лютик" } } }]
    });
    expect((execute.body.results as Array<{ status: string; error?: string }>)[0]).toMatchObject({
      status: "failed",
      error: "client_not_found"
    });
    expect(harness.updateClientInputs).toEqual([]);
  });

  it("update_crm_client: без права tenant.clients.manage — denied с agent-audit", async () => {
    const harness = createHarness({ permissions: ["tenant.projects.read"] });
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "update_crm_client", input: { clientId: "client-1", fields: { name: "ООО Лютик" } } }]
    });
    expect((execute.body.results as Array<{ status: string; error?: string }>)[0]).toMatchObject({
      status: "denied",
      error: "permission_missing"
    });
    expect(harness.updateClientInputs).toEqual([]);
    expect(harness.auditActionTypes).toContain("agent.update_crm_client.denied");
  });
});
