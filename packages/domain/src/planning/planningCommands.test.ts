import { describe, expect, it } from "vitest";

import {
  createPlanningCommand,
  isBlockingValidationIssue,
  type PlanningCommand,
  type PlanSnapshot
} from "./planningCommands";
import { reducePlanningCommand } from "./commandReducer";

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
      "assignment.delete",
      "assignment.allocations.replace",
      "baseline.capture",
      "calendar.exception.upsert",
      "constraint.update",
      "resource.reserve",
      "risk.accept_overload",
      "project.deadline.move",
      "project.settings.update",
      "task.update_custom_field"
    ];

    expect(commandTypes).toHaveLength(20);
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

  it("rejects task schedule updates where finish is before start", () => {
    const snapshot = createPlanSnapshotWithTask();
    const result = reducePlanningCommand(snapshot, {
      type: "task.update_schedule",
      payload: {
        taskId: "task-alpha",
        plannedStart: "2026-06-10",
        plannedFinish: "2026-06-09"
      }
    });

    expect(result.nextSnapshot).toBe(snapshot);
    expect(result.validationIssues).toEqual([
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error"
      })
    ]);
  });

  it("rejects task schedule updates that would make the stored finish earlier than a new start", () => {
    const snapshot = createPlanSnapshotWithTask();
    const result = reducePlanningCommand(snapshot, {
      type: "task.update_schedule",
      payload: {
        taskId: "task-alpha",
        plannedStart: "2026-06-10",
        plannedFinish: null
      }
    });

    expect(result.nextSnapshot).toBe(snapshot);
    expect(result.validationIssues).toEqual([
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error"
      })
    ]);
  });

  it("rejects explicit allocations whose total does not match assignment work", () => {
    const snapshot = {
      ...createPlanSnapshotWithTask(),
      resources: [
        {
          id: "resource-alpha",
          userId: "user-alpha",
          positionId: "engineer",
          teamId: "team-platform",
          name: "Alpha",
          calendarId: "calendar-project-alpha"
        }
      ],
      assignments: [
        {
          id: "assignment-alpha",
          taskId: "task-alpha",
          resourceId: "resource-alpha",
          role: "executor" as const,
          unitsPermille: 1000,
          workMinutes: 2400,
          calendarId: null
        }
      ],
      assignmentAllocations: []
    };
    const result = reducePlanningCommand(snapshot, {
      type: "assignment.allocations.replace",
      payload: {
        assignmentId: "assignment-alpha",
        allocations: [{ date: "2026-06-01", workMinutes: 60 }]
      }
    });

    expect(result.nextSnapshot).toBe(snapshot);
    expect(result.validationIssues).toEqual([
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error"
      })
    ]);
  });

  it("defines PlanSnapshot as immutable calculation input", () => {
    const snapshot: PlanSnapshot = {
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      planVersion: 1,
      project: {
        id: "project-alpha",
        title: "Project Alpha",
        sourceType: "opportunity",
        sourceOpportunityId: "opportunity-alpha",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-30",
        deadline: "2026-06-30",
        calendarId: "calendar-project-alpha"
      },
      tasks: [],
      assignments: [],
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

function createPlanSnapshotWithTask(): PlanSnapshot {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 1,
    project: {
      id: "project-alpha",
      title: "Project Alpha",
      sourceType: "opportunity",
      sourceOpportunityId: "opportunity-alpha",
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-30",
      deadline: "2026-06-30",
      calendarId: "calendar-project-alpha"
    },
    tasks: [
      {
        id: "task-alpha",
        parentTaskId: null,
        wbsCode: "1",
        title: "Prepare plan",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-05",
        durationMinutes: 2400,
        workMinutes: 2400,
        percentComplete: 0,
        calendarId: "calendar-project-alpha",
        constraint: null
      }
    ],
    assignments: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-project-alpha", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}
