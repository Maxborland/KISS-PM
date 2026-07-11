import { describe, expect, it } from "vitest";
import type { AccessProfile } from "@kiss-pm/access-control";
import {
  reducePlanningCommand,
  type PlanSnapshot,
  type PlanTask,
  type PlanningCommand,
  type TenantUser
} from "@kiss-pm/domain";
import type {
  AuditEventRecord,
  PlanningCommandIdempotencyRecord
} from "@kiss-pm/persistence";
import { Hono } from "hono";

import type {
  ApiTenantDataSource,
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../apiTypes";
import { registerPlanningRevertRoute } from "./planningRevertRoute";
import type { PlanningRouteDeps } from "./planningRouteHelpers";

const actor = {
  id: "user-alpha-admin",
  tenantId: "tenant-alpha",
  accessProfileId: "access-profile-admin",
  name: "Admin"
} as TenantUser;

const profile = {
  id: "access-profile-admin",
  permissions: [
    "tenant.projects.read",
    "tenant.project_plan.read",
    "tenant.project_plan.manage",
    "tenant.project_resources.read",
    "tenant.project_resources.manage"
  ]
} as AccessProfile;

const planReaderProfile = {
  id: "access-profile-plan-reader",
  permissions: ["tenant.projects.read", "tenant.project_plan.read"]
} as AccessProfile;

type HarnessState = {
  snapshot: PlanSnapshot;
  events: AuditEventRecord[];
  idempotency: Map<string, PlanningCommandIdempotencyRecord>;
};

type RevertBody = {
  reverted: string;
  auditEventId: string;
  newPlanVersion: number;
};

describe("planning revert route atomicity and idempotency", () => {
  it("replays a double click without a second audit event or version bump", async () => {
    const harness = createHarness();
    const first = await harness.revert("revert-double-click");
    const second = await harness.revert("revert-double-click");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = (await first.json()) as RevertBody;
    expect(await second.json()).toEqual(firstBody);
    const changedTarget = await harness.revert("revert-double-click", {
      targetCommitId: "different-commit"
    });
    expect(changedTarget.status).toBe(409);
    expect(await changedTarget.json()).toEqual({ error: "idempotency_key_conflict" });
    expectSingleRevert(harness, firstBody.newPlanVersion);
  });

  it("denies a plan reader before parsing the target commit envelope", async () => {
    const harness = createHarness({ actorProfile: planReaderProfile });
    const denied = await harness.requestRevert({});

    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: "permission_missing" });
    expect(harness.state.snapshot.planVersion).toBe(2);
    expect(revertEvents(harness)).toHaveLength(0);
  });

  it("requires an explicit target commit and request key", async () => {
    const harness = createHarness();
    const missingTarget = await harness.requestRevert({
      clientPlanVersion: 2,
      idempotencyKey: "revert-missing-target"
    });
    const missingKey = await harness.requestRevert({
      targetCommitId: "commit-target",
      clientPlanVersion: 2
    });

    expect(missingTarget.status).toBe(400);
    expect(await missingTarget.json()).toEqual({ error: "planning_revert_invalid" });
    expect(missingKey.status).toBe(400);
    expect(await missingKey.json()).toEqual({ error: "planning_revert_invalid" });
  });

  it("serializes a concurrent duplicate and replays the committed result", async () => {
    const harness = createHarness();
    const [left, right] = await Promise.all([
      harness.revert("revert-concurrent"),
      harness.revert("revert-concurrent")
    ]);

    expect(left.status).toBe(200);
    expect(right.status).toBe(200);
    const leftBody = (await left.json()) as RevertBody;
    expect(await right.json()).toEqual(leftBody);
    expectSingleRevert(harness, leftBody.newPlanVersion);
  });

  it("replays the same result after a successful response is lost", async () => {
    const harness = createHarness();
    const lostResponse = await harness.revert("revert-lost-response");
    expect(lostResponse.status).toBe(200);

    const retry = await harness.revert("revert-lost-response");
    expect(retry.status).toBe(200);
    const retryBody = (await retry.json()) as RevertBody;
    expectSingleRevert(harness, retryBody.newPlanVersion);
  });

  it("rolls back all compensation commands when a later command fails", async () => {
    const harness = createHarness({
      tasks: [
        task("task-a", { title: "Changed A" }),
        task("task-b", { title: "Changed B" })
      ],
      compensatingCommands: [
        {
          type: "task.update_identity",
          payload: { taskId: "task-b", title: "Original B" }
        },
        {
          type: "task.update_identity",
          payload: { taskId: "task-a", title: "Original A" }
        }
      ]
    });
    harness.failOnApply(2);

    const failed = await harness.revert("revert-rollback");
    expect(failed.status).toBe(500);
    expect(harness.state.snapshot.planVersion).toBe(2);
    expect(taskTitle(harness.state.snapshot, "task-a")).toBe("Changed A");
    expect(taskTitle(harness.state.snapshot, "task-b")).toBe("Changed B");
    expect(revertEvents(harness)).toHaveLength(0);
    expect(harness.state.idempotency.has("revert-rollback")).toBe(false);
  });

  it("rejects a stale version without applying compensation", async () => {
    const harness = createHarness();
    harness.mutate((state) => {
      state.snapshot = {
        ...state.snapshot,
        planVersion: 3,
        tasks: state.snapshot.tasks.map((item) =>
          item.id === "task-revert" ? { ...item, percentComplete: 70 } : item
        )
      };
    });

    const stale = await harness.revert("revert-stale", { clientPlanVersion: 2 });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({
      error: "plan_version_conflict",
      currentPlanVersion: 3
    });
    expect(harness.state.snapshot.planVersion).toBe(3);
    expect(taskProgress(harness.state.snapshot, "task-revert")).toBe(70);
    expect(revertEvents(harness)).toHaveLength(0);
  });

  it("prevents a second request key from reverting the same commit again", async () => {
    const harness = createHarness();
    const first = await harness.revert("revert-once");
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as RevertBody;

    const second = await harness.revert("revert-again", {
      clientPlanVersion: firstBody.newPlanVersion
    });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "planning_commit_already_reverted" });
    expectSingleRevert(harness, firstBody.newPlanVersion);
  });
});

function createHarness(options: {
  tasks?: PlanTask[];
  compensatingCommands?: PlanningCommand[];
  actorProfile?: AccessProfile;
} = {}) {
  let state: HarnessState = {
    snapshot: snapshotWith(options.tasks ?? [task("task-revert", { percentComplete: 55 })]),
    events: [targetEvent(options.compensatingCommands ?? [progressCommand(0)])],
    idempotency: new Map()
  };
  let transactionTail: Promise<unknown> = Promise.resolve();
  let failOnApplyNumber: number | null = null;
  let auditSequence = 0;

  const baseDataSource = dataSourceFor(state);
  const deps: PlanningRouteDeps = {
    dataSource: baseDataSource,
    getSessionActorFromHeaders: async () => actor,
    getActorProfile: async () => options.actorProfile ?? profile,
    runDataSourceTransaction: async (operation) => {
      const run = async () => {
        const draft = structuredClone(state);
        const transactionDataSource = dataSourceFor(draft, failOnApplyNumber);
        const result = await operation(transactionDataSource);
        state = draft;
        return result;
      };
      const pending = transactionTail.then(run, run);
      transactionTail = pending.then(
        () => undefined,
        () => undefined
      );
      return pending;
    },
    appendManagementAuditEvent: async (
      input: ManagementAuditEventInput,
      auditDataSource: ManagementAuditDataSource = baseDataSource
    ) => {
      const id = `audit-revert-${++auditSequence}`;
      await auditDataSource.appendAuditEvent?.({
        id,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actionType: input.actionType,
        sourceSurfaceId: null,
        sourceWorkflow: input.sourceWorkflow,
        sourceEntity: input.sourceEntity,
        input: input.commandInput,
        beforeState: input.beforeState,
        afterState: input.afterState,
        permissionResult: input.permissionResult,
        executionResult: input.executionResult ?? { status: "succeeded" },
        correlationId: id,
        createdAt: new Date("2026-07-10T00:00:00.000Z")
      });
      return id;
    }
  };
  const app = new Hono();
  registerPlanningRevertRoute(app, deps);

  function dataSourceFor(
    targetState: HarnessState,
    injectedFailureAt: number | null = null
  ): ApiTenantDataSource {
    let applyCount = 0;
    const partial: Partial<ApiTenantDataSource> = {
      appendAuditEvent: async (event) => {
        targetState.events.unshift({
          ...event,
          sourceSurfaceId: event.sourceSurfaceId ?? null,
          sourceWorkflow: event.sourceWorkflow ?? null
        });
      },
      applyPlanningCommand: async (input) => {
        applyCount += 1;
        if (injectedFailureAt === applyCount) {
          throw new Error("injected_compensation_failure");
        }
        const reduction = reducePlanningCommand(targetState.snapshot, input.command);
        targetState.snapshot = {
          ...reduction.nextSnapshot,
          planVersion: targetState.snapshot.planVersion
        };
      },
      createPlanningCommandIdempotency: async (input) => {
        targetState.idempotency.set(input.idempotencyKey, {
          ...input,
          createdAt: input.createdAt ?? new Date("2026-07-10T00:00:00.000Z")
        });
      },
      findPlanningCommandIdempotency: async (_tenantId, _projectId, idempotencyKey) =>
        targetState.idempotency.get(idempotencyKey),
      getPlanSnapshot: async () => targetState.snapshot,
      incrementPlanVersion: async () => {
        const next = targetState.snapshot.planVersion + 1;
        targetState.snapshot = { ...targetState.snapshot, planVersion: next };
        return next;
      },
      listAuditEventsByTenantId: async (_tenantId, listOptions) =>
        targetState.events.filter(
          (event) =>
            listOptions?.projectId === undefined ||
            listOptions.projectId === null ||
            event.sourceEntity.id === listOptions.projectId
        ),
      lockTenantResourcePlanning: async () => undefined
    };
    return partial as ApiTenantDataSource;
  }

  return {
    get state() {
      return state;
    },
    mutate(operation: (current: HarnessState) => void) {
      operation(state);
    },
    failOnApply(applyNumber: number) {
      failOnApplyNumber = applyNumber;
    },
    requestRevert(body: unknown) {
      return app.request("/api/workspace/projects/project-alpha/planning/revert-last", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
    },
    revert(
      idempotencyKey: string,
      overrides: Partial<{ targetCommitId: string; clientPlanVersion: number }> = {}
    ) {
      return this.requestRevert({
        targetCommitId: overrides.targetCommitId ?? "commit-target",
        clientPlanVersion: overrides.clientPlanVersion ?? 2,
        idempotencyKey
      });
    }
  };
}

function targetEvent(compensatingCommands: PlanningCommand[]): AuditEventRecord {
  return {
    id: "commit-target",
    tenantId: "tenant-alpha",
    actorUserId: actor.id,
    actionType: "planning.task.updated",
    sourceSurfaceId: null,
    sourceWorkflow: "planning",
    sourceEntity: { type: "Project", id: "project-alpha" },
    input: { command: progressCommand(55) },
    beforeState: { planVersion: 1 },
    afterState: { planVersion: 2, compensatingCommands },
    permissionResult: { allowed: true },
    executionResult: { status: "succeeded" },
    correlationId: "commit-target",
    createdAt: new Date("2026-07-10T00:00:00.000Z")
  };
}

function snapshotWith(tasks: PlanTask[]): PlanSnapshot {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 2,
    project: {
      id: "project-alpha",
      sourceType: "opportunity",
      sourceOpportunityId: "opportunity-alpha",
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-30",
      deadline: "2026-06-30",
      calendarId: "calendar-default"
    },
    tasks,
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [
      {
        id: "calendar-default",
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480
      }
    ],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-07-10T00:00:00.000Z"
  };
}

function task(id: string, overrides: Partial<PlanTask> = {}): PlanTask {
  return {
    id,
    parentTaskId: null,
    wbsCode: id,
    title: id,
    statusId: "task-status-new",
    schedulingMode: "auto",
    taskType: "fixed_units",
    effortDriven: false,
    plannedStart: "2026-06-10",
    plannedFinish: "2026-06-11",
    durationMinutes: 480,
    workMinutes: 480,
    percentComplete: 0,
    calendarId: "calendar-default",
    constraint: null,
    ...overrides
  };
}

function progressCommand(percentComplete: number): PlanningCommand {
  return {
    type: "task.update_progress",
    payload: { taskId: "task-revert", percentComplete }
  };
}

function revertEvents(harness: ReturnType<typeof createHarness>) {
  return harness.state.events.filter((event) => event.actionType === "planning.commit.reverted");
}

function expectSingleRevert(
  harness: ReturnType<typeof createHarness>,
  expectedVersion: number
) {
  expect(harness.state.snapshot.planVersion).toBe(expectedVersion);
  expect(taskProgress(harness.state.snapshot, "task-revert")).toBe(0);
  const events = revertEvents(harness);
  expect(events).toHaveLength(1);
  expect(events[0]?.input.targetCommitId).toBe("commit-target");
  expect(events[0]?.afterState?.compensatingCommands).toEqual([]);
}

function taskTitle(snapshot: PlanSnapshot, taskId: string) {
  return snapshot.tasks.find((item) => item.id === taskId)?.title;
}

function taskProgress(snapshot: PlanSnapshot, taskId: string) {
  return snapshot.tasks.find((item) => item.id === taskId)?.percentComplete;
}
