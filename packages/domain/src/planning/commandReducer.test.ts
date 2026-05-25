import { describe, expect, it } from "vitest";

import { reducePlanningCommand } from "./commandReducer";
import type { PlanningCommand } from "./planningCommands";
import type { PlanSnapshot } from "./types";

describe("planning command reducer", () => {
  it("routes every planning command variant through one pure reducer", () => {
    const commands: PlanningCommand[] = [
      {
        type: "task.create",
        payload: {
          id: "task-new",
          projectId: "project-alpha",
          title: "New task",
          statusId: "todo",
          plannedStart: "2026-06-04",
          plannedFinish: null,
          durationMinutes: 1920,
          workMinutes: 480,
          assignments: []
        }
      },
      { type: "task.update_identity", payload: { taskId: "task-a", title: "Renamed" } },
      {
        type: "task.update_schedule",
        payload: { taskId: "task-a", plannedStart: "2026-06-02", plannedFinish: "2026-06-03" }
      },
      {
        type: "task.update_work_model",
        payload: {
          taskId: "task-a",
          taskType: "fixed_work",
          effortDriven: true,
          durationMinutes: 480,
          workMinutes: 960
        }
      },
      { type: "task.update_status", payload: { taskId: "task-a", statusId: "doing" } },
      { type: "task.move_wbs", payload: { taskId: "task-a", parentTaskId: null, sortOrder: 1 } },
      { type: "task.delete_or_archive", payload: { taskId: "task-a", mode: "archive" } },
      {
        type: "dependency.upsert",
        payload: {
          id: "dep-a-b",
          predecessorTaskId: "task-a",
          successorTaskId: "task-b",
          dependencyType: "SS",
          lagMinutes: 120
        }
      },
      { type: "dependency.delete", payload: { dependencyId: "dep-a-b" } },
      {
        type: "assignment.upsert",
        payload: {
          id: "assignment-a",
          taskId: "task-a",
          resourceId: "resource-alpha",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 480
        }
      },
      { type: "assignment.delete", payload: { assignmentId: "assignment-a" } },
      { type: "baseline.capture", payload: { baselineId: "baseline-1", label: "Baseline" } },
      {
        type: "calendar.exception.upsert",
        payload: {
          id: "exception-1",
          calendarId: "calendar-default",
          resourceId: null,
          date: "2026-06-08",
          workingMinutes: 0,
          reason: "holiday"
        }
      },
      {
        type: "constraint.update",
        payload: {
          taskId: "task-a",
          constraintId: "constraint-a",
          type: "start_no_earlier_than",
          date: "2026-06-03"
        }
      },
      {
        type: "resource.reserve",
        payload: {
          id: "reservation-a",
          resourceId: "resource-alpha",
          start: "2026-06-10",
          finish: "2026-06-10",
          workMinutes: 240,
          reason: "support"
        }
      },
      {
        type: "risk.accept_overload",
        payload: { overloadId: "resource-alpha:2026-06-10", acceptedRiskReason: "approved" }
      },
      {
        type: "project.deadline.move",
        payload: { deadline: "2026-07-01", reason: "scope changed" }
      },
      {
        type: "project.settings.update",
        payload: { calendarId: "tenant-default" }
      },
      {
        type: "task.update_custom_field",
        payload: { taskId: "task-a", fieldKey: "sprint", value: "S1" }
      }
    ];

    for (const command of commands) {
      const result = reducePlanningCommand(createSnapshot(), command);
      expect(result.validationIssues, command.type).toEqual([]);
      expect(result.planDelta.commands).toEqual([command]);
    }
  });

  it("rejects task.create for another project without mutating the snapshot", () => {
    const snapshot = createSnapshot();
    const result = reducePlanningCommand(snapshot, {
      type: "task.create",
      payload: {
        id: "task-other",
        projectId: "project-other",
        title: "Other",
        statusId: "todo",
        plannedStart: null,
        plannedFinish: null,
        workMinutes: 0,
        assignments: []
      }
    });

    expect(result.nextSnapshot).toBe(snapshot);
    expect(result.validationIssues).toEqual([
      expect.objectContaining({ code: "planning_command_invalid", severity: "error" })
    ]);
  });

  it("normalizes nullable task schedule payloads to the same dates persistence can store", () => {
    const snapshot = createSnapshot();

    const created = reducePlanningCommand(snapshot, {
      type: "task.create",
      payload: {
        id: "task-new",
        projectId: "project-alpha",
        title: "New task",
        statusId: "todo",
        plannedStart: null,
        plannedFinish: null,
        durationMinutes: 1920,
        workMinutes: 480,
        assignments: []
      }
    });
    expect(created.nextSnapshot.tasks.find((task) => task.id === "task-new")).toMatchObject({
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-01",
      durationMinutes: 1920
    });

    const updated = reducePlanningCommand(snapshot, {
      type: "task.update_schedule",
      payload: {
        taskId: "task-a",
        plannedStart: null,
        plannedFinish: null
      }
    });
    expect(updated.nextSnapshot.tasks.find((task) => task.id === "task-a")).toMatchObject({
      plannedStart: "2026-06-01",
      plannedFinish: null
    });
  });

  it("updates plannedStartInstant date when a scheduled task start changes", () => {
    const snapshot = {
      ...createSnapshot(),
      tasks: [
        { ...createTask("task-a", "1"), plannedStartInstant: { date: "2026-06-01", minuteOfDay: 240 } },
        createTask("task-b", "2")
      ]
    };

    const updated = reducePlanningCommand(snapshot, {
      type: "task.update_schedule",
      payload: {
        taskId: "task-a",
        plannedStart: "2026-06-05",
        plannedFinish: "2026-06-06"
      }
    });

    expect(updated.nextSnapshot.tasks.find((task) => task.id === "task-a")).toMatchObject({
      plannedStart: "2026-06-05",
      plannedFinish: "2026-06-06",
      plannedStartInstant: { date: "2026-06-05", minuteOfDay: 240 }
    });
  });

  it("rejects task schedule updates that finish before they start", () => {
    const snapshot = createSnapshot();

    const result = reducePlanningCommand(snapshot, {
      type: "task.update_schedule",
      payload: {
        taskId: "task-a",
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

  it("removes archived tasks and their active planning edges from preview snapshots", () => {
    const snapshot = createSnapshot();
    const result = reducePlanningCommand(snapshot, {
      type: "task.delete_or_archive",
      payload: { taskId: "task-a", mode: "archive" }
    });

    expect(result.nextSnapshot.tasks.map((task) => task.id)).toEqual(["task-b"]);
    expect(result.nextSnapshot.assignments).toEqual([]);
    expect(result.nextSnapshot.dependencies).toEqual([]);
    expect(result.planDelta).toMatchObject({
      changedTaskIds: ["task-a"],
      changedAssignmentIds: ["assignment-a"],
      changedDependencyIds: ["dep-a-b"]
    });
  });

  it("rejects moving a task under one of its descendants", () => {
    const snapshot = {
      ...createSnapshot(),
      tasks: [
        { ...createTask("task-a", "1"), parentTaskId: null },
        { ...createTask("task-b", "1.1"), parentTaskId: "task-a" },
        { ...createTask("task-c", "1.1.1"), parentTaskId: "task-b" }
      ]
    };

    const result = reducePlanningCommand(snapshot, {
      type: "task.move_wbs",
      payload: { taskId: "task-a", parentTaskId: "task-c", sortOrder: 2 }
    });

    expect(result.nextSnapshot).toBe(snapshot);
    expect(result.validationIssues).toEqual([
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error"
      })
    ]);
  });

  it("creates and moves child tasks with hierarchical WBS codes", () => {
    const snapshot = createSnapshot();
    const created = reducePlanningCommand(snapshot, {
      type: "task.create",
      payload: {
        id: "task-child",
        projectId: "project-alpha",
        parentTaskId: "task-a",
        title: "Child",
        statusId: "todo",
        plannedStart: null,
        plannedFinish: null,
        durationMinutes: 480,
        workMinutes: 480,
        assignments: []
      }
    });

    expect(
      created.nextSnapshot.tasks.map((task) => ({
        id: task.id,
        parentTaskId: task.parentTaskId,
        wbsCode: task.wbsCode
      }))
    ).toEqual([
      { id: "task-a", parentTaskId: null, wbsCode: "1" },
      { id: "task-child", parentTaskId: "task-a", wbsCode: "1.1" },
      { id: "task-b", parentTaskId: null, wbsCode: "2" }
    ]);

    const moved = reducePlanningCommand(created.nextSnapshot, {
      type: "task.move_wbs",
      payload: { taskId: "task-b", parentTaskId: "task-a", sortOrder: 0 }
    });

    expect(
      moved.nextSnapshot.tasks.map((task) => ({
        id: task.id,
        parentTaskId: task.parentTaskId,
        wbsCode: task.wbsCode
      }))
    ).toEqual([
      { id: "task-a", parentTaskId: null, wbsCode: "1" },
      { id: "task-b", parentTaskId: "task-a", wbsCode: "1.1" },
      { id: "task-child", parentTaskId: "task-a", wbsCode: "1.2" }
    ]);
  });

  it("creates top-level tasks after the highest active WBS code in preview snapshots", () => {
    const snapshot = {
      ...createSnapshot(),
      tasks: [
        createTask("task-a", "1"),
        createTask("task-c", "3")
      ]
    };

    const result = reducePlanningCommand(snapshot, {
      type: "task.create",
      payload: {
        id: "task-new",
        projectId: "project-alpha",
        title: "New",
        statusId: "todo",
        plannedStart: null,
        plannedFinish: null,
        workMinutes: 480,
        assignments: []
      }
    });

    expect(result.nextSnapshot.tasks.map((task) => ({ id: task.id, wbsCode: task.wbsCode }))).toEqual([
      { id: "task-a", wbsCode: "1" },
      { id: "task-c", wbsCode: "3" },
      { id: "task-new", wbsCode: "4" }
    ]);
  });

  it("rejects invalid task, dependency, assignment and reservation command references", () => {
    const invalidCommands: PlanningCommand[] = [
      {
        type: "task.create",
        payload: {
          id: "task-orphan",
          projectId: "project-alpha",
          parentTaskId: "task-missing",
          title: "Orphan",
          statusId: "todo",
          plannedStart: null,
          plannedFinish: null,
          workMinutes: 480,
          assignments: []
        }
      },
      {
        type: "dependency.upsert",
        payload: {
          id: "dep-self",
          predecessorTaskId: "task-a",
          successorTaskId: "task-a",
          dependencyType: "FS",
          lagMinutes: 0
        }
      },
      {
        type: "dependency.upsert",
        payload: {
          id: "dep-missing",
          predecessorTaskId: "task-a",
          successorTaskId: "task-missing",
          dependencyType: "FS",
          lagMinutes: 0
        }
      },
      {
        type: "assignment.upsert",
        payload: {
          id: "assignment-missing-resource",
          taskId: "task-a",
          resourceId: "resource-missing",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 480
        }
      },
      {
        type: "task.update_work_model",
        payload: {
          taskId: "task-a",
          taskType: "fixed_units",
          effortDriven: false,
          durationMinutes: 0,
          workMinutes: 480
        }
      },
      {
        type: "resource.reserve",
        payload: {
          id: "reservation-invalid",
          resourceId: "resource-alpha",
          start: "2026-06-11",
          finish: "2026-06-10",
          workMinutes: 240,
          reason: "support"
        }
      }
    ];

    for (const command of invalidCommands) {
      const snapshot = createSnapshot();
      const result = reducePlanningCommand(snapshot, command);

      expect(result.nextSnapshot, command.type).toBe(snapshot);
      expect(result.validationIssues, command.type).toEqual([
        expect.objectContaining({ code: "planning_command_invalid", severity: "error" })
      ]);
    }
  });
});

function createSnapshot(): PlanSnapshot {
  return {
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
      calendarId: "calendar-default"
    },
    tasks: [
      createTask("task-a", "1"),
      createTask("task-b", "2")
    ],
    assignments: [
      {
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      }
    ],
    dependencies: [
      {
        id: "dep-a-b",
        predecessorTaskId: "task-a",
        successorTaskId: "task-b",
        type: "FS",
        lagMinutes: 0
      }
    ],
    baselines: [],
    calendars: [
      { id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 },
      { id: "tenant-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }
    ],
    calendarExceptions: [],
    resources: [
      { id: "resource-alpha", userId: "user-alpha", positionId: "engineer", teamId: null, name: "Alpha", calendarId: null }
    ],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}

function createTask(id: string, wbsCode: string) {
  return {
    id,
    parentTaskId: null,
    wbsCode,
    title: id,
    statusId: "todo",
    schedulingMode: "auto" as const,
    taskType: "fixed_units" as const,
    effortDriven: false,
    plannedStart: "2026-06-01",
    plannedFinish: null,
    durationMinutes: 480,
    workMinutes: 480,
    percentComplete: 0,
    calendarId: "calendar-default",
    constraint: null
  };
}
