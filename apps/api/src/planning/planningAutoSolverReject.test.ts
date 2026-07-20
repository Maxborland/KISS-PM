import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import { reducePlanningCommand, type PlanSnapshot } from "@kiss-pm/domain";
import type { AuditEventRecordInput, PlanningSolverRunRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource } from "../apiTypes";
import { createApp } from "../app";

const COOKIE = "kiss_pm_session=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

function baseSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    planVersion: 5,
    project: { id: "project-1", sourceType: "manual", sourceOpportunityId: null, plannedStart: "2026-06-01", plannedFinish: "2026-06-02", deadline: "2026-06-03", calendarId: "cal" },
    tasks: [
      { id: "task-a", parentTaskId: null, wbsCode: "1", title: "A", statusId: "todo", schedulingMode: "auto", taskType: "fixed_work", effortDriven: true, plannedStart: "2026-06-01", plannedFinish: null, durationMinutes: 480, workMinutes: 480, percentComplete: 0, calendarId: "cal", constraint: null }
    ],
    assignments: [
      { id: "asg-a", taskId: "task-a", resourceId: "res-1", role: "executor", unitsPermille: 1000, workMinutes: 480, calendarId: null }
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

function seededSolverRun(): PlanningSolverRunRecord {
  return {
    id: "planning-auto-solver-run-1",
    tenantId: "tenant-1",
    projectId: "project-1",
    mode: "schedule",
    clientPlanVersion: 5,
    engineVersion: "planning-core-v1",
    inputSnapshotMetadata: {},
    targetDeadline: null,
    proposals: [{ id: "proposal-1", planDelta: { commands: [] } }],
    proposalPayloadHash: "hash",
    actorUserId: "user-planner",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    appliedProposalId: null,
    appliedAt: null,
    rejectedAt: null,
    rejectedReason: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z")
  };
}

function createHarness(options: { permissions?: AccessProfile["permissions"] } = {}) {
  let snapshot = baseSnapshot();
  const runs = new Map<string, PlanningSolverRunRecord>();
  runs.set("tenant-1:project-1:planning-auto-solver-run-1", seededSolverRun());
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
    async listWorkspaceUsers() { return []; },
    async findSessionByTokenHash() {
      return { id: "s", tenantId: "tenant-1", userId: "user-planner", tokenHash: "ignored", expiresAt: new Date("2099-01-01T00:00:00.000Z") };
    },
    async withTransaction(operation) { return operation(dataSource as ApiTenantDataSource); },
    async lockTenantResourcePlanning() { return; },
    async getPlanSnapshot(_tenantId, projectId) { return projectId === "project-1" ? snapshot : undefined; },
    async findPlanningSolverRun(tenantId, projectId, runId) {
      return runs.get(scopedKey(tenantId, projectId, runId));
    },
    async markPlanningSolverRunApplied({ tenantId, projectId, runId, proposalId, appliedAt }) {
      const key = scopedKey(tenantId, projectId, runId);
      const record = runs.get(key);
      if (record) runs.set(key, { ...record, appliedProposalId: proposalId, appliedAt });
    },
    async markPlanningSolverRunRejected({ tenantId, projectId, runId, rejectedAt, rejectedReason }) {
      const key = scopedKey(tenantId, projectId, runId);
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

const REJECT_PATH = "/api/workspace/projects/project-1/planning/auto-solver-runs/planning-auto-solver-run-1/reject";
const APPLY_PATH = "/api/workspace/projects/project-1/planning/auto-solver-runs/planning-auto-solver-run-1/proposals/proposal-1/apply";

describe("POST /planning/auto-solver-runs/:runId/reject", () => {
  it("отклоняет persisted run: 200, rejectedAt/rejectedReason персистятся, audit planning.auto_solver.run_rejected, план не меняется", async () => {
    const harness = createHarness();
    const reject = await post(harness.app, REJECT_PATH, { reason: "не подходит" });

    expect(reject.status).toBe(200);
    expect(reject.body.runId).toBe("planning-auto-solver-run-1");
    expect(typeof reject.body.rejectedAt).toBe("string");
    const record = harness.runs.get("tenant-1:project-1:planning-auto-solver-run-1");
    expect(record?.rejectedAt).toBeInstanceOf(Date);
    expect(record?.rejectedReason).toBe("не подходит");
    expect(harness.planVersion).toBe(5);
    expect(harness.auditActionTypes).toContain("planning.auto_solver.run_rejected");
  });

  it("повторный reject того же run → 409 planning_solver_run_already_rejected", async () => {
    const harness = createHarness();
    await post(harness.app, REJECT_PATH, {});
    const second = await post(harness.app, REJECT_PATH, {});
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("planning_solver_run_already_rejected");
  });

  it("apply отклонённого run → 409 planning_solver_run_already_rejected, план не меняется", async () => {
    const harness = createHarness();
    await post(harness.app, REJECT_PATH, {});
    const apply = await post(harness.app, APPLY_PATH, { clientPlanVersion: 5 });
    expect(apply.status).toBe(409);
    expect(apply.body.error).toBe("planning_solver_run_already_rejected");
    expect(harness.planVersion).toBe(5);
  });

  it("reject несуществующего run → 404 planning_solver_run_not_found", async () => {
    const harness = createHarness();
    const reject = await post(harness.app, "/api/workspace/projects/project-1/planning/auto-solver-runs/planning-auto-solver-run-missing/reject", {});
    expect(reject.status).toBe(404);
    expect(reject.body.error).toBe("planning_solver_run_not_found");
  });

  it("без права управления ресурсами reject недоступен → 403, run не отклоняется", async () => {
    const restricted = createHarness({
      permissions: [
        "tenant.projects.read",
        "tenant.project_plan.read",
        "tenant.project_plan.manage",
        "tenant.project_resources.read"
      ]
    });
    const reject = await post(restricted.app, REJECT_PATH, {});
    expect(reject.status).toBe(403);
    expect(restricted.runs.get("tenant-1:project-1:planning-auto-solver-run-1")?.rejectedAt).toBeNull();
  });

  it("чужой project не находит run → 404 (существование чужих run не раскрываем)", async () => {
    const harness = createHarness();
    const reject = await post(harness.app, "/api/workspace/projects/project-2/planning/auto-solver-runs/planning-auto-solver-run-1/reject", {});
    expect(reject.status).toBe(404);
    expect(harness.runs.get("tenant-1:project-1:planning-auto-solver-run-1")?.rejectedAt).toBeNull();
  });
});
