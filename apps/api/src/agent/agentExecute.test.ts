import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import { reducePlanningCommand, type PlanSnapshot, type TenantUser } from "@kiss-pm/domain";
import type { AuditEventRecordInput, PlanningScenarioRunRecord, ProjectRecord, TaskRecord, TaskStatusRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource } from "../apiTypes";
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
  const taskUpdatedAt = new Date("2026-06-01T10:00:00.000Z");
  const task: TaskRecord = {
    id: "task-a",
    tenantId: "tenant-1",
    projectId: "project-1",
    stageId: null,
    title: "A",
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
  const permissions: AccessProfile["permissions"] = options.permissions ?? [
    "tenant.projects.read",
    "tenant.project_plan.read",
    "tenant.project_plan.manage",
    "tenant.project_resources.read",
    "tenant.project_resources.manage",
    "tenant.planning_scenarios.preview",
    "tenant.planning_scenarios.apply"
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
      return [{
        id: "res-1",
        tenantId: "tenant-1",
        name: "Ресурс",
        email: "resource@kiss-pm.local",
        accessProfileId: "p",
        positionId: null,
        positionName: null,
        phone: null,
        telegram: null,
        status: "active",
        theme: "system",
        accentColor: "blue"
      }];
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
      const record: PlanningScenarioRunRecord = { ...run, appliedAt: null, createdAt: new Date("2026-06-01T00:00:00.000Z") };
      runs.set(run.id, record);
      return record;
    },
    async findPlanningScenarioRun(_tenantId, _projectId, runId) { return runs.get(runId); },
    async markPlanningScenarioRunApplied({ scenarioRunId, appliedAt }) {
      const record = runs.get(scenarioRunId);
      if (record) runs.set(scenarioRunId, { ...record, appliedAt });
    },
    async applyPlanningCommand({ command }) {
      appliedCommandTypes.push(command.type);
      snapshot = reducePlanningCommand(snapshot, command).nextSnapshot;
    },
    async incrementPlanVersion() { snapshot = { ...snapshot, planVersion: snapshot.planVersion + 1 }; return snapshot.planVersion; },
    ...(options.auditPersistence === false
      ? {}
      : { async appendAuditEvent(input: AuditEventRecordInput) { auditActionTypes.push(input.actionType); auditEvents.push(input); } })
  };

  return { app: createApp({ dataSource: dataSource as ApiTenantDataSource }), task, appliedCommandTypes, auditActionTypes, auditEvents, get planVersion() { return snapshot.planVersion; } };
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
    expect(isAgentToolOfferable(byName.get("create_crm_client")!)).toBe(false);
    expect(isAgentToolOfferable(byName.get("create_task")!)).toBe(false);
    expect(isAgentToolOfferable(byName.get("apply_resource_resolution")!)).toBe(false);
    expect(isAgentToolOfferable(byName.get("apply_plan_commands")!)).toBe(false);
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
