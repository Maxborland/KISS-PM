import { planningAssignmentId } from "@kiss-pm/domain";
import { describe, expect, it, vi } from "vitest";

import { buildCreateTaskPlanningCommand } from "../planningTaskCompatibility";
import { createWorkspaceInboxTask } from "./taskCreateCommands";
import type {
  CreateWorkspaceInboxTaskInput,
  TaskCommandWorkspaceDeps
} from "./taskCommandTypes";

vi.mock("./taskCreateSupport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./taskCreateSupport")>();
  return {
    ...actual,
    authorizeCreateTask: () => ({
      allowed: true,
      createDecision: { allowed: true, reason: "test" },
      legacyManageDecision: { allowed: false, reason: "test" }
    }),
    hasWorkspaceInboxCreateTaskDeps: () => true,
    prepareCreateTaskParticipants: () => ({
      ok: true,
      participants: [],
      ownerUserId: "user-actor",
      requesterUserId: "user-actor"
    })
  };
});

function createInput(id?: string): CreateWorkspaceInboxTaskInput {
  return {
    actor: { id: "user-actor", tenantId: "tenant-test" },
    profile: {},
    body: id === undefined ? {} : { id }
  } as CreateWorkspaceInboxTaskInput;
}

function createDepsRejecting(error: unknown): TaskCommandWorkspaceDeps {
  return {
    dataSource: {},
    runDataSourceTransaction: vi.fn().mockRejectedValue(error),
    appendManagementAuditEvent: vi.fn()
  } as unknown as TaskCommandWorkspaceDeps;
}

function nestedTasksPrimaryKeyConflict(): unknown {
  return {
    cause: {
      cause: {
        code: "23505",
        constraint_name: "tasks_pkey"
      }
    }
  };
}

describe("createWorkspaceInboxTask duplicate handling", () => {
  it("maps a nested tasks_pkey conflict for an explicit task id", async () => {
    await expect(
      createWorkspaceInboxTask(
        createDepsRejecting(nestedTasksPrimaryKeyConflict()),
        createInput("task-explicit")
      )
    ).resolves.toEqual({ ok: false, status: 409, error: "task_id_taken" });
  });

  it("preserves generated-id conflict behavior", async () => {
    const error = nestedTasksPrimaryKeyConflict();

    await expect(
      createWorkspaceInboxTask(createDepsRejecting(error), createInput())
    ).rejects.toBe(error);
  });

  it("rethrows non-conflict transaction errors", async () => {
    const error = new Error("transaction_failed");

    await expect(
      createWorkspaceInboxTask(createDepsRejecting(error), createInput("task-explicit"))
    ).rejects.toBe(error);
  });
});

describe("create task planning assignment ids", () => {
  it("allocates a new id when another project assignment owns the deterministic id", () => {
    const occupiedId = planningAssignmentId("task-new", "user-executor", "executor");
    const participants = [{ userId: "user-executor", role: "executor" as const }];
    const command = buildCreateTaskPlanningCommand({
      taskId: "task-new",
      projectId: "project-alpha",
      statusId: "task-status-new",
      body: {
        id: "task-new",
        title: "New task",
        description: null,
        priority: "normal",
        statusId: "task-status-new",
        plannedStart: new Date("2026-07-13T00:00:00.000Z"),
        plannedFinish: new Date("2026-07-13T00:00:00.000Z"),
        durationWorkingDays: 1,
        plannedWork: 1,
        requiresAcceptance: false,
        participants
      },
      participants,
      projectAssignments: [
        {
          id: occupiedId,
          taskId: "task-imported",
          resourceId: "user-imported",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: null,
          calendarId: null
        }
      ]
    });

    expect(command).toMatchObject({
      type: "task.create",
      payload: {
        assignments: [
          {
            id: `${occupiedId}-2`,
            resourceId: "user-executor"
          }
        ]
      }
    });
  });
});
