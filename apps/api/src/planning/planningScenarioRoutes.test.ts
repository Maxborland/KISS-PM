import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import { reducePlanningCommand, type PlanSnapshot } from "@kiss-pm/domain";
import type { AuditEventRecordInput, PlanningScenarioRunRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource } from "../apiTypes";
import { createApp } from "../app";
import { createPlanningReadModel } from "./planningReadModel";

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

// Минимальный харнесс reject-flow (по образцу agentExecute.test.ts): in-memory runs
// с честным скоупом tenant/project — «чужой» projectId не находит run.
function createHarness(options: { permissions?: AccessProfile["permissions"] } = {}) {
  let snapshot = overloadedSnapshot();
  const runs = new Map<string, PlanningScenarioRunRecord>();
  const auditActionTypes: string[] = [];
  const auditEvents: AuditEventRecordInput[] = [];
  const permissions: AccessProfile["permissions"] = options.permissions ?? [
    "tenant.projects.read",
    "tenant.project_plan.read",
    "tenant.project_plan.manage",
    "tenant.project_resources.read",
    "tenant.project_resources.manage",
    "tenant.planning_scenarios.preview",
    "tenant.planning_scenarios.apply"
  ];

  const scopedKey = (tenantId: string, projectId: string, runId: string) => `${tenantId}:${projectId}:${runId}`;

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
    async getPlanSnapshot(_tenantId, projectId) { return projectId === "project-1" ? snapshot : undefined; },
    async createPlanningScenarioRun(run) {
      const record: PlanningScenarioRunRecord = { ...run, appliedAt: null, rejectedAt: null, rejectedReason: null, createdAt: new Date("2026-06-01T00:00:00.000Z") };
      runs.set(scopedKey(run.tenantId, run.projectId, run.id), record);
      return record;
    },
    async findPlanningScenarioRun(tenantId, projectId, runId) {
      return runs.get(scopedKey(tenantId, projectId, runId));
    },
    async markPlanningScenarioRunApplied({ tenantId, projectId, scenarioRunId, appliedAt }) {
      const key = scopedKey(tenantId, projectId, scenarioRunId);
      const record = runs.get(key);
      if (record) runs.set(key, { ...record, appliedAt });
    },
    async markPlanningScenarioRunRejected({ tenantId, projectId, scenarioRunId, rejectedAt, rejectedReason }) {
      const key = scopedKey(tenantId, projectId, scenarioRunId);
      const record = runs.get(key);
      if (record) runs.set(key, { ...record, rejectedAt, rejectedReason });
    },
    async applyPlanningCommand({ command }) {
      snapshot = reducePlanningCommand(snapshot, command).nextSnapshot;
    },
    async incrementPlanVersion() { snapshot = { ...snapshot, planVersion: snapshot.planVersion + 1 }; return snapshot.planVersion; },
    async appendAuditEvent(input: AuditEventRecordInput) { auditActionTypes.push(input.actionType); auditEvents.push(input); }
  };

  return {
    app: createApp({ dataSource: dataSource as ApiTenantDataSource }),
    runs,
    auditActionTypes,
    auditEvents,
    get planVersion() { return snapshot.planVersion; }
  };
}

async function post(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  const res = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", cookie: COOKIE },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function previewScenarioId(harness: ReturnType<typeof createHarness>): Promise<string> {
  const overload = createPlanningReadModel(overloadedSnapshot()).resourceLoad.overloads[0]!;
  const preview = await post(harness.app, "/api/workspace/projects/project-1/planning/scenarios/preview", {
    clientPlanVersion: 5,
    target: { type: "resource_overload", resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }
  });
  expect(preview.status).toBe(200);
  return (preview.body.proposals as Array<{ id: string }>)[0]!.id;
}

describe("POST /planning/scenarios/:scenarioId/reject", () => {
  it("отклоняет persisted run: 200, rejectedAt/rejectedReason персистятся, audit planning.scenario.rejected", async () => {
    const harness = createHarness();
    const scenarioId = await previewScenarioId(harness);

    const reject = await post(harness.app, `/api/workspace/projects/project-1/planning/scenarios/${scenarioId}/reject`, { reason: "не подходит по срокам" });

    expect(reject.status).toBe(200);
    expect(reject.body.scenarioRunId).toBe(scenarioId);
    expect(typeof reject.body.rejectedAt).toBe("string");
    const record = harness.runs.get(`tenant-1:project-1:${scenarioId}`);
    expect(record?.rejectedAt).toBeInstanceOf(Date);
    expect(record?.rejectedReason).toBe("не подходит по срокам");
    // План не мутирует: версия не растёт.
    expect(harness.planVersion).toBe(5);
    expect(harness.auditActionTypes).toContain("planning.scenario.rejected");
    expect(harness.auditEvents.find((event) => event.actionType === "planning.scenario.rejected")).toMatchObject({
      sourceWorkflow: "planning",
      beforeState: { planVersion: 5 },
      afterState: { rejectedReason: "не подходит по срокам" }
    });
  });

  it("повторный reject того же run → 409 planning_scenario_already_rejected", async () => {
    const harness = createHarness();
    const scenarioId = await previewScenarioId(harness);
    await post(harness.app, `/api/workspace/projects/project-1/planning/scenarios/${scenarioId}/reject`, {});

    const secondReject = await post(harness.app, `/api/workspace/projects/project-1/planning/scenarios/${scenarioId}/reject`, {});

    expect(secondReject.status).toBe(409);
    expect(secondReject.body.error).toBe("planning_scenario_already_rejected");
  });

  it("apply отклонённого run → 409 scenario_rejected, план не меняется", async () => {
    const harness = createHarness();
    const scenarioId = await previewScenarioId(harness);
    await post(harness.app, `/api/workspace/projects/project-1/planning/scenarios/${scenarioId}/reject`, {});

    const apply = await post(harness.app, `/api/workspace/projects/project-1/planning/scenarios/${scenarioId}/apply`, { clientPlanVersion: 5, acceptedRiskReason: "test" });

    expect(apply.status).toBe(409);
    expect(apply.body.error).toBe("scenario_rejected");
    expect(harness.planVersion).toBe(5);
  });

  it("reject применённого run → 409 planning_scenario_already_applied", async () => {
    const harness = createHarness();
    const scenarioId = await previewScenarioId(harness);
    const apply = await post(harness.app, `/api/workspace/projects/project-1/planning/scenarios/${scenarioId}/apply`, { clientPlanVersion: 5, acceptedRiskReason: "test" });
    expect(apply.status).toBe(200);

    const reject = await post(harness.app, `/api/workspace/projects/project-1/planning/scenarios/${scenarioId}/reject`, {});

    expect(reject.status).toBe(409);
    expect(reject.body.error).toBe("planning_scenario_already_applied");
  });

  it("без права применения сценариев → 403 + audit planning.scenario_denied, run не отклоняется", async () => {
    const harness = createHarness();
    const scenarioId = await previewScenarioId(harness);
    const restricted = createHarness({
      permissions: [
        "tenant.projects.read",
        "tenant.project_plan.read",
        "tenant.project_plan.manage",
        "tenant.project_resources.read",
        "tenant.project_resources.manage",
        "tenant.planning_scenarios.preview"
      ]
    });
    const restrictedScenarioId = await previewScenarioId(restricted);

    const reject = await post(restricted.app, `/api/workspace/projects/project-1/planning/scenarios/${restrictedScenarioId}/reject`, {});

    expect(reject.status).toBe(403);
    expect(reject.body.error).toBe("permission_missing");
    expect(restricted.auditActionTypes).toContain("planning.scenario_denied");
    expect(restricted.runs.get(`tenant-1:project-1:${restrictedScenarioId}`)?.rejectedAt).toBeNull();
    // Полный набор прав по-прежнему отклоняет — RBAC-точка общая с apply.
    const allowedReject = await post(harness.app, `/api/workspace/projects/project-1/planning/scenarios/${scenarioId}/reject`, {});
    expect(allowedReject.status).toBe(200);
  });

  it("чужой projectId → 404 scenario_not_found (единый ответ, существование не раскрывается)", async () => {
    const harness = createHarness();
    const scenarioId = await previewScenarioId(harness);

    const reject = await post(harness.app, `/api/workspace/projects/project-2/planning/scenarios/${scenarioId}/reject`, {});

    expect(reject.status).toBe(404);
    expect(reject.body.error).toBe("scenario_not_found");
    expect(harness.runs.get(`tenant-1:project-1:${scenarioId}`)?.rejectedAt).toBeNull();
  });
});
