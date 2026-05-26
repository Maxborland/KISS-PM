import { describe, expect, it } from "vitest";

import {
  createPlanningCommand,
  isBlockingValidationIssue,
  type PlanningCommand,
  type PlanSnapshot
} from "./planningCommands";

describe("planning command contract", () => {
  it("creates a task.create planning command for task CRUD wrappers", () => {
    const command = createPlanningCommand({
      type: "task.create",
      payload: {
        id: "task-alpha",
        projectId: "project-alpha",
        title: "Prepare plan",
        statusId: "todo",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-05",
        durationMinutes: 2400,
        workMinutes: 2400,
        assignments: []
      }
    });

    expect(command).toMatchObject({
      type: "task.create",
      payload: {
        id: "task-alpha",
        projectId: "project-alpha",
        durationMinutes: 2400,
        workMinutes: 2400
      }
    });
  });

  it("keeps all plan mutations inside the PlanningCommand union", () => {
    const commandTypes: PlanningCommand["type"][] = [
      "task.create",
      "task.update_identity",
      "task.update_schedule",
      "task.update_work_model",
      "task.update_status",
      "task.move_wbs",
      "task.delete_or_archive",
      "dependency.upsert",
      "dependency.delete",
      "assignment.upsert",
      "assignment.allocations.replace",
      "assignment.delete",
      "baseline.capture",
      "calendar.exception.upsert",
      "constraint.update",
      "resource.reserve",
      "risk.accept_overload",
      "project.deadline.move"
    ];

    expect(commandTypes).toHaveLength(18);
    expect(commandTypes).toContain("task.create");
    expect(commandTypes).toContain("dependency.upsert");
    expect(commandTypes).toContain("assignment.upsert");
  });

  it("marks blocking validation severities explicitly", () => {
    expect(
      isBlockingValidationIssue({
        code: "dependency_cycle_detected",
        severity: "error",
        message: "Dependency cycle",
        entity: { type: "TaskDependency", id: "dep-alpha" }
      })
    ).toBe(true);
  });

  it("defines PlanSnapshot as immutable calculation input", () => {
    const snapshot: PlanSnapshot = {
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      planVersion: 1,
      project: {
        id: "project-alpha",
        sourceType: "opportunity",
        sourceOpportunityId: "opportunity-alpha",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-30",
        deadline: "2026-06-30",
        calendarId: "calendar-project-alpha"
      },
      tasks: [],
      assignments: [],
      assignmentAllocations: [],
      dependencies: [],
      baselines: [],
      calendars: [],
      calendarExceptions: [],
      resources: [],
      reservations: [],
      constraints: [],
      capturedAt: "2026-05-21T00:00:00.000Z"
    };

    expect(snapshot.planVersion).toBe(1);
  });
});
