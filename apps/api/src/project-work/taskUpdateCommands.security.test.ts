import type { AccessProfile } from "@kiss-pm/access-control";
import type { PlanSnapshot, PlanningCommand, TenantUser } from "@kiss-pm/domain";
import type { TaskRecord, TaskStatusRecord } from "@kiss-pm/persistence";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "../apiTypes";
import { canApplyTaskCompatibilityPlanningCommands } from "./taskCommandGuards";
import { createTaskCommandWorkspace } from "./taskCommandWorkspace";

const actor: TenantUser = {
  id: "user-requester",
  tenantId: "tenant-alpha",
  name: "Requester",
  accessProfileId: "profile-requester"
};

const requesterProfile: AccessProfile = {
  id: "profile-requester",
  permissions: []
};

const taskEditorProfile: AccessProfile = {
  id: "profile-task-editor",
  permissions: ["tenant.tasks.edit", "tenant.project_resources.manage"]
};
const taskOnlyEditorProfile: AccessProfile = {
  id: "profile-task-only-editor",
  permissions: ["tenant.tasks.edit"]
};

const now = new Date("2026-07-10T08:00:00.000Z");
const plannedStart = new Date("2026-07-13T00:00:00.000Z");
const plannedFinish = new Date("2026-07-13T00:00:00.000Z");

const statuses: TaskStatusRecord[] = [
  {
    id: "task-status-new",
    tenantId: actor.tenantId,
    name: "New",
    category: "new",
    sortOrder: 1,
    status: "active",
    isSystem: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "task-status-done",
    tenantId: actor.tenantId,
    name: "Done",
    category: "done",
    sortOrder: 5,
    status: "active",
    isSystem: true,
    createdAt: now,
    updatedAt: now
  }
];

function createTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-alpha",
    tenantId: actor.tenantId,
    projectId: "project-alpha",
    stageId: null,
    title: "Security review",
    description: "Original description",
    status: "new",
    statusId: "task-status-new",
    statusName: "New",
    statusCategory: "new",
    priority: "normal",
    requesterUserId: actor.id,
    ownerUserId: "user-executor",
    plannedStart,
    plannedFinish,
    durationWorkingDays: 1,
    plannedWork: 8,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: true,
    source: "manual",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    participants: [
      { userId: actor.id, role: "requester" },
      { userId: "user-executor", role: "executor" }
    ],
    ...overrides
  };
}

function createHarness(
  initialTask = createTask(),
  taskAtTransactionStart?: TaskRecord,
  assignment: {
    id?: string;
    resourceId?: string;
    unitsPermille?: number;
    workMinutes?: number | null;
  } = {},
  snapshotWorkModel?: {
    workMinutes: number;
    durationMinutes: number;
  }
) {
  let currentTask = initialTask;
  let transactionCalls = 0;
  let metadataCalls = 0;
  const appliedCommands: PlanningCommand[] = [];
  const snapshot = {
    tenantId: actor.tenantId,
    projectId: initialTask.projectId,
    planVersion: 1,
    tasks: snapshotWorkModel
      ? [
          {
            id: initialTask.id,
            workMinutes: snapshotWorkModel.workMinutes,
            durationMinutes: snapshotWorkModel.durationMinutes
          }
        ]
      : [],
    assignments: [
      {
        id: assignment.id ?? `${initialTask.id}-user-executor-executor`,
        taskId: initialTask.id,
        resourceId: assignment.resourceId ?? "user-executor",
        role: "executor",
        unitsPermille: assignment.unitsPermille ?? 1000,
        workMinutes: assignment.workMinutes ?? null
      }
    ]
  } as unknown as PlanSnapshot;

  const dataSource = {
    findTaskById: async () => currentTask,
    getPlanSnapshot: async () => snapshot,
    applyPlanningCommand: async (input: { command: PlanningCommand }) => {
      appliedCommands.push(input.command);
      if (input.command.type === "task.update_identity") {
        currentTask = {
          ...currentTask,
          title: input.command.payload.title
        };
      }
      if (input.command.type === "task.update_status") {
        const statusId = (input.command.payload as { statusId: string }).statusId;
        const targetStatus = statuses.find((status) => status.id === statusId);
        if (targetStatus) {
          currentTask = {
            ...currentTask,
            status: targetStatus.category,
            statusId: targetStatus.id,
            statusName: targetStatus.name,
            statusCategory: targetStatus.category
          };
        }
      }
    },
    updateTaskMetadata: async (input: {
      description: string | null;
      priority: TaskRecord["priority"];
      requesterUserId: string;
      ownerUserId: string;
      requiresAcceptance: boolean;
      participants: TaskRecord["participants"];
    }) => {
      metadataCalls += 1;
      currentTask = {
        ...currentTask,
        description: input.description,
        priority: input.priority,
        requesterUserId: input.requesterUserId,
        ownerUserId: input.ownerUserId,
        requiresAcceptance: input.requiresAcceptance,
        participants: input.participants
      };
      return currentTask;
    },
    incrementPlanVersion: async () => 2,
    listTaskStatuses: async () => statuses,
    listWorkspaceUsers: async () => [
      { id: actor.id, status: "active" },
      { id: "user-executor", status: "active" },
      { id: "user-next-executor", status: "active" }
    ],
    createTaskActivity: async (input: Record<string, unknown>) => ({
      ...input,
      createdAt: now,
      updatedAt: now
    }),
    withTransaction: async (operation: (transaction: ApiTenantDataSource) => Promise<unknown>) =>
      operation(dataSource as unknown as ApiTenantDataSource)
  } as unknown as ApiTenantDataSource;

  const workspace = createTaskCommandWorkspace({
    dataSource,
    runDataSourceTransaction: async <T>(
      operation: (transaction: ApiTenantDataSource) => Promise<T>
    ) => {
      transactionCalls += 1;
      if (taskAtTransactionStart) currentTask = taskAtTransactionStart;
      return operation(dataSource);
    },
    appendManagementAuditEvent: async () => "audit-task-update"
  });

  return {
    workspace,
    appliedCommands,
    get transactionCalls() {
      return transactionCalls;
    },
    get metadataCalls() {
      return metadataCalls;
    }
  };
}

function updateBody(task: TaskRecord, overrides: Record<string, unknown> = {}) {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    statusId: task.statusId,
    plannedStart: task.plannedStart,
    plannedFinish: task.plannedFinish,
    durationWorkingDays: task.durationWorkingDays,
    plannedWork: task.plannedWork,
    requiresAcceptance: task.requiresAcceptance,
    participants: task.participants,
    clientUpdatedAt: task.updatedAt,
    ...overrides
  };
}

describe("updateTask status boundary", () => {
  it("rejects a status change that would bypass transition and acceptance rules", async () => {
    const task = createTask();
    const harness = createHarness(task);

    const result = await harness.workspace.updateTask({
      actor,
      profile: requesterProfile,
      taskId: task.id,
      body: updateBody(task, { statusId: "task-status-done" })
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "task_status_transition_not_allowed"
    });
    expect(harness.transactionCalls).toBe(0);
    expect(harness.appliedCommands).toEqual([]);
  });

  it("does not overwrite a status changed concurrently before the transaction", async () => {
    const initialTask = createTask({ requiresAcceptance: false });
    const currentTask = createTask({
      status: "done",
      statusId: "task-status-done",
      statusName: "Done",
      statusCategory: "done",
      progress: 100,
      requiresAcceptance: false
    });
    const harness = createHarness(initialTask, currentTask);

    const result = await harness.workspace.updateTask({
      actor,
      profile: requesterProfile,
      taskId: initialTask.id,
      body: updateBody(initialTask)
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "task_status_transition_not_allowed"
    });
    expect(harness.transactionCalls).toBe(1);
    expect(harness.appliedCommands).toEqual([]);
  });

  it("preserves metadata and assignment updates when statusId is unchanged", async () => {
    const task = createTask({ requiresAcceptance: false });
    const harness = createHarness(task);

    const result = await harness.workspace.updateTask({
      actor,
      profile: taskEditorProfile,
      taskId: task.id,
      body: updateBody(task, {
        description: "Updated description",
        participants: [
          { userId: actor.id, role: "requester" },
          { userId: "user-next-executor", role: "executor" }
        ]
      })
    });

    expect(result).toMatchObject({
      ok: true,
      task: {
        description: "Updated description",
        statusId: task.statusId,
        ownerUserId: "user-next-executor"
      }
    });
    expect(harness.appliedCommands.map((command) => command.type)).toEqual([
      "assignment.upsert",
      "assignment.delete"
    ]);
    expect(harness.appliedCommands).not.toContainEqual(
      expect.objectContaining({ type: "task.update_status" })
    );
  });

  it("does not require resource management for a title-only edit with an imported assignment id", async () => {
    const task = createTask({ plannedWork: 2 });
    const harness = createHarness(
      task,
      undefined,
      {
        id: "assignment-imported-executor",
        unitsPermille: 1000,
        workMinutes: 300
      },
      {
        workMinutes: 90,
        durationMinutes: 480
      }
    );

    const result = await harness.workspace.updateTask({
      actor,
      profile: taskOnlyEditorProfile,
      taskId: task.id,
      body: updateBody(task, { title: "Updated security review" })
    });

    expect(result).toMatchObject({
      ok: true,
      task: {
        title: "Updated security review",
        ownerUserId: "user-executor"
      }
    });
    expect(harness.appliedCommands.map((command) => command.type)).toEqual([
      "task.update_identity"
    ]);
    expect(harness.appliedCommands).not.toContainEqual(
      expect.objectContaining({
        type: expect.stringMatching(/^assignment\./)
      })
    );
  });

  it("preserves an imported assignment id when work-model changes require a sync", async () => {
    const task = createTask();
    const harness = createHarness(task, undefined, { id: "assignment-imported-executor" });

    const result = await harness.workspace.updateTask({
      actor,
      profile: taskEditorProfile,
      taskId: task.id,
      body: updateBody(task, { plannedWork: 4 })
    });

    expect(result).toMatchObject({ ok: true });
    expect(harness.appliedCommands).toContainEqual(
      expect.objectContaining({
        type: "assignment.upsert",
        payload: expect.objectContaining({
          id: "assignment-imported-executor",
          resourceId: "user-executor",
          role: "executor",
          unitsPermille: 500
        })
      })
    );
    expect(harness.appliedCommands).not.toContainEqual({
      type: "assignment.delete",
      payload: { assignmentId: "assignment-imported-executor" }
    });
  });

  it("requires resource management for participant changes even when assignment sync is empty", async () => {
    const task = createTask();
    const harness = createHarness(task, undefined, {
      id: "assignment-imported-next-executor",
      resourceId: "user-next-executor",
      unitsPermille: 1000,
      workMinutes: null
    });

    expect(
      canApplyTaskCompatibilityPlanningCommands(actor, taskOnlyEditorProfile, [], true)
    ).toMatchObject({ allowed: false });

    const result = await harness.workspace.updateTask({
      actor,
      profile: taskOnlyEditorProfile,
      taskId: task.id,
      body: updateBody(task, {
        participants: [
          { userId: actor.id, role: "requester" },
          { userId: "user-next-executor", role: "executor" }
        ]
      })
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(harness.appliedCommands).toEqual([]);
    expect(harness.metadataCalls).toBe(0);
  });
});
