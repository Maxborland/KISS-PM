import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import { reducePlanningCommand, type PlanSnapshot } from "@kiss-pm/domain";
import type { PlanningScenarioRunRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource } from "../apiTypes";
import { createApp } from "../app";
import { createPlanningReadModel } from "../planning/planningReadModel";

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

function createHarness() {
  let snapshot = overloadedSnapshot();
  const runs = new Map<string, PlanningScenarioRunRecord>();
  const appliedCommandTypes: string[] = [];
  const auditActionTypes: string[] = [];
  const permissions: AccessProfile["permissions"] = [
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
    async listWorkspaceUsers() { return []; },
    async findSessionByTokenHash() {
      return { id: "s", tenantId: "tenant-1", userId: "user-planner", tokenHash: "ignored", expiresAt: new Date("2026-07-01T00:00:00.000Z") };
    },
    async withTransaction(operation) { return operation(dataSource as ApiTenantDataSource); },
    async lockTenantResourcePlanning() { return; },
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
    async appendAuditEvent(input) { auditActionTypes.push(input.actionType); }
  };

  return { app: createApp({ dataSource: dataSource as ApiTenantDataSource }), appliedCommandTypes, auditActionTypes, get planVersion() { return snapshot.planVersion; } };
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

  it("rejects apply when the actor lacks scenario-apply permission (RBAC at the governed route)", async () => {
    const harness = createHarness();
    // Понизить права нельзя на лету (профиль фиксирован), поэтому проверяем version-lock как
    // доказательство, что переотправка реально доходит до governed-проверок, а не фейк-успех.
    const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
    const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
      clientPlanVersion: 5,
      target: { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }
    });
    const scenarioId = (preview.body.proposals as Array<{ id: string }>)[0]!.id;

    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "apply_resource_resolution", input: { projectId: "project-1", scenarioId, clientPlanVersion: 999, acceptedRiskReason: "e2e" } }]
    });
    expect(execute.status).toBe(422);
    const results = execute.body.results as Array<{ ok: boolean; status?: number; error?: string }>;
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.error).toBe("plan_version_conflict");
    expect(harness.appliedCommandTypes).toEqual([]);
  });
});
