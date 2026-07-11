import { describe, expect, it, vi } from "vitest";

import { preflightTransitionTaskStatus } from "./taskPreflightGuards";
import { archiveTask, transitionTaskStatus } from "./taskLifecycleCommands";
import type {
  ArchiveTaskInput,
  TaskCommandWorkspaceDeps,
  TransitionTaskStatusInput
} from "./taskCommandTypes";

function createDepsWithoutPlanningLock(
  dataSource: Record<string, unknown>
): TaskCommandWorkspaceDeps {
  return {
    dataSource,
    runDataSourceTransaction: vi.fn(),
    appendManagementAuditEvent: vi.fn()
  } as unknown as TaskCommandWorkspaceDeps;
}

describe("task lifecycle planning lock capability", () => {
  it("fails archive closed when the planning lock is unavailable", async () => {
    const deps = createDepsWithoutPlanningLock({
      findTaskByIdIncludingArchived: vi.fn(),
      applyPlanningCommand: vi.fn(),
      incrementPlanVersion: vi.fn(),
      withTransaction: vi.fn()
    });

    await expect(archiveTask(deps, {} as ArchiveTaskInput)).resolves.toEqual({
      ok: false,
      status: 501,
      error: "persistence_not_configured"
    });
    expect(deps.runDataSourceTransaction).not.toHaveBeenCalled();
  });

  it("fails status transition closed when the planning lock is unavailable", async () => {
    const deps = createDepsWithoutPlanningLock({
      listProjects: vi.fn(),
      listProjectTasks: vi.fn(),
      listTaskStatuses: vi.fn(),
      applyPlanningCommand: vi.fn(),
      findTaskById: vi.fn(),
      incrementPlanVersion: vi.fn(),
      createTaskActivity: vi.fn(),
      withTransaction: vi.fn()
    });

    await expect(
      transitionTaskStatus(deps, {} as TransitionTaskStatusInput)
    ).resolves.toEqual({
      ok: false,
      status: 501,
      error: "persistence_not_configured"
    });
    expect(deps.runDataSourceTransaction).not.toHaveBeenCalled();
  });

  it("fails status-transition preflight closed when the planning lock is unavailable", async () => {
    const deps = createDepsWithoutPlanningLock({
      listProjects: vi.fn(),
      listProjectTasks: vi.fn(),
      listTaskStatuses: vi.fn(),
      applyPlanningCommand: vi.fn(),
      findTaskById: vi.fn(),
      incrementPlanVersion: vi.fn(),
      createTaskActivity: vi.fn(),
      withTransaction: vi.fn()
    });

    await expect(
      preflightTransitionTaskStatus(deps, {} as TransitionTaskStatusInput)
    ).resolves.toEqual({
      ok: false,
      status: 501,
      error: "persistence_not_configured"
    });
  });
});
