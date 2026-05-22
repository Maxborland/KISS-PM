import { describe, expect, it } from "vitest";

import {
  mapPlanningGanttIntentToCommand,
  type PlanningCommandIntentContext
} from "./planningCommandIntentMapper";

const context: PlanningCommandIntentContext = {
  projectId: "project-alpha",
  defaultStatusId: "task-status-new",
  defaultStart: "2026-06-01",
  defaultFinish: "2026-06-01",
  defaultWorkMinutes: 480,
  makeId: (prefix) => `${prefix}-generated`
};

describe("planning command intent mapper", () => {
  it("maps task intents to Phase 5/6 planning commands", () => {
    expect(mapPlanningGanttIntentToCommand({
      type: "task.create",
      parentTaskId: "task-parent",
      insertAfterTaskId: null
    }, context)).toEqual({
      type: "task.create",
      payload: {
        id: "task-generated",
        projectId: "project-alpha",
        parentTaskId: "task-parent",
        title: "Новая задача",
        statusId: "task-status-new",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-01",
        durationMinutes: null,
        workMinutes: 480,
        assignments: []
      }
    });
    expect(mapPlanningGanttIntentToCommand({
      type: "task.rename",
      taskId: "task-a",
      title: "Новый заголовок"
    }, context)).toEqual({
      type: "task.update_identity",
      payload: { taskId: "task-a", title: "Новый заголовок" }
    });
    expect(mapPlanningGanttIntentToCommand({
      type: "task.schedule.drag",
      taskId: "task-a",
      plannedStart: "2026-06-02",
      plannedFinish: "2026-06-05"
    }, context)).toEqual({
      type: "task.update_schedule",
      payload: { taskId: "task-a", plannedStart: "2026-06-02", plannedFinish: "2026-06-05" }
    });
    expect(mapPlanningGanttIntentToCommand({
      type: "task.work_model.edit",
      taskId: "task-a",
      taskType: "fixed_work",
      effortDriven: true,
      durationMinutes: 960,
      workMinutes: 1440
    }, context)).toEqual({
      type: "task.update_work_model",
      payload: {
        taskId: "task-a",
        taskType: "fixed_work",
        effortDriven: true,
        durationMinutes: 960,
        workMinutes: 1440
      }
    });
  });

  it("maps dependency, assignment, WBS and baseline intents without local apply behavior", () => {
    expect(mapPlanningGanttIntentToCommand({
      type: "task.move_wbs",
      taskId: "task-a",
      parentTaskId: null,
      sortOrder: 2
    }, context)).toEqual({
      type: "task.move_wbs",
      payload: { taskId: "task-a", parentTaskId: null, sortOrder: 2 }
    });
    expect(mapPlanningGanttIntentToCommand({
      type: "dependency.upsert",
      id: "dep-a",
      predecessorTaskId: "task-a",
      successorTaskId: "task-b",
      dependencyType: "SS",
      lagMinutes: -120
    }, context)).toEqual({
      type: "dependency.upsert",
      payload: {
        id: "dep-a",
        predecessorTaskId: "task-a",
        successorTaskId: "task-b",
        dependencyType: "SS",
        lagMinutes: -120
      }
    });
    expect(mapPlanningGanttIntentToCommand({
      type: "dependency.delete",
      dependencyId: "dep-a"
    }, context)).toEqual({
      type: "dependency.delete",
      payload: { dependencyId: "dep-a" }
    });
    expect(mapPlanningGanttIntentToCommand({
      type: "assignment.upsert",
      id: "assignment-a",
      taskId: "task-a",
      resourceId: "user-alpha",
      role: "executor",
      unitsPermille: 1000,
      workMinutes: null
    }, context)).toEqual({
      type: "assignment.upsert",
      payload: {
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "user-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: null
      }
    });
    expect(mapPlanningGanttIntentToCommand({
      type: "assignment.delete",
      assignmentId: "assignment-a"
    }, context)).toEqual({
      type: "assignment.delete",
      payload: { assignmentId: "assignment-a" }
    });
    expect(mapPlanningGanttIntentToCommand({
      type: "baseline.capture",
      label: "Baseline 1"
    }, context)).toEqual({
      type: "baseline.capture",
      payload: { baselineId: "baseline-generated", label: "Baseline 1" }
    });
  });
});
