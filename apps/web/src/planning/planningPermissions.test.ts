import { describe, expect, it } from "vitest";

import { canApplyPlanningCommand, canReadPlanningWorkspace } from "./planningPermissions";

describe("planning permissions", () => {
  it("requires both plan and resource read permissions for the planning workspace", () => {
    expect(canReadPlanningWorkspace([
      "tenant.projects.read",
      "tenant.project_plan.read",
      "tenant.project_resources.read"
    ])).toBe(true);

    expect(canReadPlanningWorkspace([
      "tenant.projects.read",
      "tenant.project_plan.read"
    ])).toBe(false);
  });

  it("matches backend command permission split for plan, baseline and resource commands", () => {
    expect(canApplyPlanningCommand({
      type: "task.create",
      payload: {
        id: "task-a",
        projectId: "project-alpha",
        parentTaskId: null,
        title: "Новая задача",
        statusId: "task-status-active",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationMinutes: null,
        workMinutes: 480,
        assignments: []
      }
    }, ["tenant.project_plan.manage"])).toBe(true);

    expect(canApplyPlanningCommand({
      type: "task.create",
      payload: {
        id: "task-a",
        projectId: "project-alpha",
        parentTaskId: null,
        title: "Новая задача",
        statusId: "task-status-active",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationMinutes: null,
        workMinutes: 480,
        assignments: [{
          id: "assignment-a",
          resourceId: "resource-alpha",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: null
        }]
      }
    }, ["tenant.project_plan.manage"])).toBe(false);

    expect(canApplyPlanningCommand({
      type: "baseline.capture",
      payload: { baselineId: "baseline-a", label: "Baseline" }
    }, ["tenant.project_baselines.manage"])).toBe(true);
  });
});
