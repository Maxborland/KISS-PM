import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import { reducePlanningCommand, type PlanSnapshot } from "@kiss-pm/domain";
import type { PlanningSolverRunRecord } from "@kiss-pm/persistence";
import type { ApiTenantDataSource } from "./apiTypes";
import { createApp } from "./app";
import { hashJson } from "./planning/planningRouteHelpers";

describe("planning auto-solver API", () => {
  it("persists a solver run and applies the stored proposal through planning commands", async () => {
    const harness = createApiHarness();

    const createBody = await createSolverRun(harness);
    const applyResponse = await applyProposal(harness, createBody);
    const applyBody = await applyResponse.json();

    expect(applyResponse.status).toBe(200);
    expect(harness.appliedCommandTypes).toEqual([
      "task.update_schedule",
      "assignment.upsert",
      "assignment.allocations.replace"
    ]);
    expect(harness.storedRunBox.value).not.toBeNull();
    expect(harness.storedRunBox.value?.appliedProposalId).toBe(firstProposalId(createBody));
    expect(harness.auditActionTypes).toEqual([
      "planning.auto_solver.run_created",
      "planning.auto_solver.proposal_applied"
    ]);
    expect(applyBody.newPlanVersion).toBe(4);
    expect(applyBody.applied.changedAssignmentIds).toEqual(["assignment-alpha"]);
    expect(applyBody.readModel.authored.assignmentAllocations).toEqual([
      {
        assignmentId: "assignment-alpha",
        taskId: "task-alpha",
        resourceId: "resource-alpha",
        date: "2026-06-01",
        workMinutes: 480
      }
    ]);
  });

  it("rejects stale client plan versions before applying persisted proposals", async () => {
    const harness = createApiHarness();
    const createBody = await createSolverRun(harness);

    const response = await applyProposal(harness, createBody, { clientPlanVersion: 2 });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("plan_version_conflict");
    expect(harness.appliedCommandTypes).toEqual([]);
    expect(harness.auditActionTypes).toEqual([
      "planning.auto_solver.run_created",
      "planning.auto_solver.apply_conflict"
    ]);
  });

  it("builds solver runs with resource capacity through the requested deadline", async () => {
    const snapshot = createSnapshot();
    const harness = createApiHarness({
      snapshot: {
        ...snapshot,
        project: {
          ...snapshot.project,
          deadline: "2026-06-02"
        },
        reservations: [
          {
            id: "other-project-day-one",
            resourceId: "resource-alpha",
            projectId: "project-other",
            start: "2026-06-01",
            finish: "2026-06-01",
            workMinutes: 480,
            reason: "Other project commitment"
          }
        ]
      }
    });

    const createBody = await createSolverRun(harness);

    expect(createBody.proposals[0]).toMatchObject({
      conflictEffect: "removed",
      explainability: expect.objectContaining({
        finishDate: "2026-06-02",
        overloadMinutes: 0
      })
    });
  });

  it("rejects invalid target deadline dates before running the solver", async () => {
    const harness = createApiHarness();

    const response = await harness.app.request(
      "/api/workspace/projects/project-solver/planning/auto-solver-runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=solver-token"
        },
        body: JSON.stringify({
          mode: "schedule",
          clientPlanVersion: 3,
          targetDeadline: "2026-02-31"
        })
      }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("planning_solver_invalid");
    expect(harness.storedRunBox.value).toBeNull();
  });

  it("rejects expired persisted solver runs", async () => {
    const harness = createApiHarness();
    const createBody = await createSolverRun(harness);
    if (harness.storedRunBox.value) {
      harness.storedRunBox.value = {
        ...harness.storedRunBox.value,
        expiresAt: new Date("2000-01-01T00:00:00.000Z")
      };
    }

    const response = await applyProposal(harness, createBody);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("planning_solver_run_expired");
    expect(harness.appliedCommandTypes).toEqual([]);
    expect(harness.auditActionTypes).toEqual([
      "planning.auto_solver.run_created",
      "planning.auto_solver.apply_expired"
    ]);
  });

  it("rejects stored proposal payload hash mismatches", async () => {
    const harness = createApiHarness();
    const createBody = await createSolverRun(harness);
    if (harness.storedRunBox.value) {
      harness.storedRunBox.value = {
        ...harness.storedRunBox.value,
        proposalPayloadHash: "tampered"
      };
    }

    const response = await applyProposal(harness, createBody);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("planning_solver_payload_hash_mismatch");
    expect(harness.appliedCommandTypes).toEqual([]);
    expect(harness.auditActionTypes).toEqual([
      "planning.auto_solver.run_created",
      "planning.auto_solver.apply_payload_hash_mismatch"
    ]);
  });

  it("audits missing persisted proposal ids before returning not found", async () => {
    const harness = createApiHarness();
    const createBody = await createSolverRun(harness);

    const response = await harness.app.request(
      `/api/workspace/projects/project-solver/planning/auto-solver-runs/${createBody.runId}/proposals/proposal-missing/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=solver-token"
        },
        body: JSON.stringify({ clientPlanVersion: 3 })
      }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("planning_solver_proposal_not_found");
    expect(harness.appliedCommandTypes).toEqual([]);
    expect(harness.auditActionTypes).toEqual([
      "planning.auto_solver.run_created",
      "planning.auto_solver.apply_proposal_not_found"
    ]);
  });

  it("audits accepted-overload proposals that are missing a risk reason", async () => {
    const harness = createApiHarness();
    const createBody = await createSolverRun(harness);
    const storedRun = harness.storedRunBox.value;
    if (!storedRun) throw new Error("missing_stored_run");
    const proposals = storedRun.proposals.map((proposal, index) =>
      index === 0
        ? {
            ...proposal,
            planDelta: {
              commands: [
                {
                  type: "risk.accept_overload",
                  payload: {
                    overloadId: "overload-alpha",
                    acceptedRiskReason: "placeholder"
                  }
                }
              ]
            }
          }
        : proposal
    );
    harness.storedRunBox.value = {
      ...storedRun,
      proposals,
      proposalPayloadHash: hashJson(proposals)
    };

    const response = await applyProposal(harness, createBody);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("accepted_risk_reason_required");
    expect(harness.appliedCommandTypes).toEqual([]);
    expect(harness.auditActionTypes).toEqual([
      "planning.auto_solver.run_created",
      "planning.auto_solver.apply_precondition_failed"
    ]);
  });

  it("requires project resource management permission before creating solver proposals", async () => {
    const harness = createApiHarness({
      permissions: ["tenant.project_plan.read", "tenant.project_plan.manage"]
    });

    const response = await harness.app.request(
      "/api/workspace/projects/project-solver/planning/auto-solver-runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: "kiss_pm_session=solver-token"
        },
        body: JSON.stringify({ mode: "schedule", clientPlanVersion: 3 })
      }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("permission_missing");
    expect(harness.appliedCommandTypes).toEqual([]);
    expect(harness.storedRunBox.value).toBeNull();
    expect(harness.auditActionTypes).toEqual([]);
  });
});

type ApiHarness = {
  app: ReturnType<typeof createApp>;
  storedRunBox: { value: PlanningSolverRunRecord | null };
  appliedCommandTypes: string[];
  auditActionTypes: string[];
};

type SolverRunResponse = {
  runId: string;
  proposals: Array<{
    id: string;
    conflictEffect?: string;
    explainability?: Record<string, unknown>;
  }>;
};

function createApiHarness(input: {
  permissions?: AccessProfile["permissions"];
  snapshot?: PlanSnapshot;
} = {}): ApiHarness {
  let snapshot = input.snapshot ?? createSnapshot();
  const storedRunBox: { value: PlanningSolverRunRecord | null } = { value: null };
  const appliedCommandTypes: string[] = [];
  const auditActionTypes: string[] = [];
  const permissions: AccessProfile["permissions"] = input.permissions ?? [
    "tenant.project_plan.read",
    "tenant.project_plan.manage",
    "tenant.project_resources.manage"
  ];
  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() {
      return [];
    },
    async findUserById(userId) {
      return userId === "user-planner"
        ? {
            id: "user-planner",
            tenantId: "tenant-solver",
            name: "Планировщик",
            accessProfileId: "solver-profile"
          }
        : undefined;
    },
    async findTenantById(tenantId) {
      return tenantId === "tenant-solver" ? { id: tenantId, name: "Solver Tenant" } : undefined;
    },
    async findAccessProfileById() {
      return {
        id: "solver-profile",
        permissions
      };
    },
    async listUsersByTenantId() {
      return [];
    },
    async listWorkspaceUsers() {
      return [
        {
          id: "resource-alpha",
          tenantId: "tenant-solver",
          name: "Alpha",
          email: "alpha@kiss-pm.local",
          accessProfileId: "solver-profile",
          positionId: "position-engineer",
          positionName: "Инженер",
          phone: null,
          telegram: null,
          status: "active",
          theme: "system",
          accentColor: "blue"
        }
      ];
    },
    async findSessionByTokenHash() {
      return {
        id: "session-solver",
        tenantId: "tenant-solver",
        userId: "user-planner",
        tokenHash: "ignored",
        expiresAt: new Date("2026-07-01T00:00:00.000Z")
      };
    },
    async withTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    },
    async lockTenantResourcePlanning() {
      return;
    },
    async getPlanSnapshot() {
      return snapshot;
    },
    async createPlanningSolverRun(runInput) {
      storedRunBox.value = {
        ...runInput,
        appliedProposalId: runInput.appliedProposalId ?? null,
        appliedAt: runInput.appliedAt ?? null,
        createdAt: runInput.createdAt ?? new Date("2026-05-24T00:00:00.000Z")
      };
      return storedRunBox.value;
    },
    async findPlanningSolverRun() {
      return storedRunBox.value ?? undefined;
    },
    async markPlanningSolverRunApplied(applyInput) {
      if (storedRunBox.value) {
        storedRunBox.value = {
          ...storedRunBox.value,
          appliedProposalId: applyInput.proposalId,
          appliedAt: applyInput.appliedAt
        };
      }
    },
    async applyPlanningCommand(commandInput) {
      appliedCommandTypes.push(commandInput.command.type);
      snapshot = reducePlanningCommand(snapshot, commandInput.command).nextSnapshot;
    },
    async incrementPlanVersion() {
      snapshot = { ...snapshot, planVersion: snapshot.planVersion + 1 };
      return snapshot.planVersion;
    },
    async appendAuditEvent(auditInput) {
      auditActionTypes.push(auditInput.actionType);
    }
  };

  return {
    app: createApp({ dataSource: dataSource as ApiTenantDataSource }),
    storedRunBox,
    appliedCommandTypes,
    auditActionTypes
  };
}

async function createSolverRun(harness: ApiHarness): Promise<SolverRunResponse> {
  const createResponse = await harness.app.request(
    "/api/workspace/projects/project-solver/planning/auto-solver-runs",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=solver-token"
      },
      body: JSON.stringify({ mode: "schedule", clientPlanVersion: 3 })
    }
  );
  const createBody = await createResponse.json();

  expect(createResponse.status).toBe(200);
  expect(createBody.proposals[0]).toMatchObject({ conflictEffect: "removed" });
  return createBody as SolverRunResponse;
}

async function applyProposal(
  harness: ApiHarness,
  run: SolverRunResponse,
  input: { clientPlanVersion?: number } = {}
) {
  return harness.app.request(
    `/api/workspace/projects/project-solver/planning/auto-solver-runs/${run.runId}/proposals/${firstProposalId(run)}/apply`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: "kiss_pm_session=solver-token"
      },
      body: JSON.stringify({ clientPlanVersion: input.clientPlanVersion ?? 3 })
    }
  );
}

function firstProposalId(run: SolverRunResponse): string {
  const proposal = run.proposals[0];
  if (!proposal) throw new Error("missing_solver_proposal");
  return proposal.id;
}

function createSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-solver",
    projectId: "project-solver",
    planVersion: 3,
    project: {
      id: "project-solver",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-05",
      deadline: "2026-06-01",
      calendarId: "calendar-default"
    },
    tasks: [
      {
        id: "task-alpha",
        parentTaskId: null,
        wbsCode: "1",
        title: "Task",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-01",
        plannedFinish: null,
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 0,
        calendarId: "calendar-default",
        constraint: null
      }
    ],
    assignments: [
      {
        id: "assignment-alpha",
        taskId: "task-alpha",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      }
    ],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [
      {
        id: "resource-alpha",
        userId: "resource-alpha",
        positionId: "position-engineer",
        teamId: null,
        name: "Alpha",
        calendarId: "calendar-default"
      }
    ],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-24T00:00:00.000Z"
  };
}
