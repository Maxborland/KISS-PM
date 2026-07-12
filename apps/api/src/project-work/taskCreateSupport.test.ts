import { describe, expect, it, vi } from "vitest";

import {
  hasProjectCreateTaskDeps,
  hasWorkspaceInboxCreateTaskDeps
} from "./taskCreateSupport";
import {
  preflightCreateProjectTask,
  preflightCreateWorkspaceInboxTask
} from "./taskPreflightGuards";
import type {
  CreateProjectTaskInput,
  CreateWorkspaceInboxTaskInput,
  TaskCommandWorkspaceDeps
} from "./taskCommandTypes";

function createDeps(includePlanningLock: boolean): TaskCommandWorkspaceDeps {
  const dataSource: Record<string, unknown> = {
    ensureWorkspaceInboxProject: vi.fn(),
    listProjects: vi.fn(),
    listWorkspaceUsers: vi.fn(),
    listProjectTaskAssignments: vi.fn(),
    listTaskStatuses: vi.fn(),
    applyPlanningCommand: vi.fn(),
    updateTaskMetadata: vi.fn(),
    findTaskById: vi.fn(),
    incrementPlanVersion: vi.fn(),
    createTaskActivity: vi.fn(),
    withTransaction: vi.fn()
  };
  if (includePlanningLock) dataSource.lockTenantResourcePlanning = vi.fn();
  return {
    dataSource,
    runDataSourceTransaction: vi.fn(),
    appendManagementAuditEvent: vi.fn()
  } as unknown as TaskCommandWorkspaceDeps;
}

describe("create task planning lock capability", () => {
  it("fails both create capabilities and preflights closed without the planning lock", async () => {
    const deps = createDeps(false);
    const unavailable = {
      ok: false,
      status: 501,
      error: "persistence_not_configured"
    };

    expect(hasWorkspaceInboxCreateTaskDeps(deps)).toBe(false);
    expect(hasProjectCreateTaskDeps(deps)).toBe(false);
    await expect(
      preflightCreateWorkspaceInboxTask(deps, {} as CreateWorkspaceInboxTaskInput)
    ).resolves.toEqual(unavailable);
    await expect(
      preflightCreateProjectTask(deps, {} as CreateProjectTaskInput)
    ).resolves.toEqual(unavailable);
  });

  it("rejects a planning lock capability key whose value is undefined", () => {
    const deps = createDeps(true);
    Object.defineProperty(deps.dataSource, "lockTenantResourcePlanning", { value: undefined });

    expect(hasWorkspaceInboxCreateTaskDeps(deps)).toBe(false);
    expect(hasProjectCreateTaskDeps(deps)).toBe(false);
  });

  it("accepts both complete create capability sets", () => {
    const deps = createDeps(true);

    expect(hasWorkspaceInboxCreateTaskDeps(deps)).toBe(true);
    expect(hasProjectCreateTaskDeps(deps)).toBe(true);
  });
});
