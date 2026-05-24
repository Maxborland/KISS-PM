import { describe, expect, it } from "vitest";

import {
  mapPlanningReadModelToGanttViewModel,
  type PlanningReadModel
} from "./planningReadModelMapper";

describe("planning read model mapper", () => {
  it("maps backend authored and calculated plan state into the controlled Gantt view model", () => {
    const viewModel = mapPlanningReadModelToGanttViewModel(createReadModel());

    expect(viewModel).toMatchObject({
      project: {
        id: "project-alpha",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-30",
        deadline: "2026-06-28",
        calendarId: "calendar-project"
      },
      planVersion: 3,
      engineVersion: "planning-core-v1"
    });
    expect(viewModel.tasks).toEqual([
      expect.objectContaining({
        id: "task-a",
        wbsCode: "1",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-03",
        baselineStart: "2026-06-01",
        baselineFinish: "2026-06-02",
        startVarianceDays: 1,
        finishVarianceDays: 1,
        isSummary: true,
        isCritical: true,
        slackMinutes: 0,
        validationIssueIds: ["schedule_outside_project_bounds:task:task-a:0"]
      }),
      expect.objectContaining({
        id: "task-a-1",
        parentTaskId: "task-a",
        isSummary: false
      })
    ]);
    expect(viewModel.dependencies).toEqual([
      {
        id: "dep-a",
        predecessorTaskId: "task-a",
        successorTaskId: "task-a-1",
        type: "FS",
        lagMinutes: 480,
        valid: true,
        issueCodes: []
      }
    ]);
    expect(viewModel.baselines).toEqual([
      {
        baselineId: "baseline-1",
        capturedAt: "2026-05-22T00:00:00.000Z",
        taskId: "task-a",
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-02",
        workMinutes: 960
      }
    ]);
    expect(viewModel.validationIssues).toEqual([
      {
        id: "schedule_outside_project_bounds:task:task-a:0",
        code: "schedule_outside_project_bounds",
        severity: "warning",
        message: "Задача выходит за границы проекта",
        entity: { type: "task", id: "task-a" }
      }
    ]);
    expect(viewModel.resourceLoadBuckets).toEqual([
      {
        id: "user-alpha:day:2026-06-02",
        resourceId: "user-alpha",
        resourceName: "user-alpha",
        bucketStart: "2026-06-02",
        bucketFinish: "2026-06-02",
        granularity: "day",
        plannedMinutes: 600,
        availableMinutes: 480,
        reservedMinutes: 60,
        freeMinutes: 0,
        overloadMinutes: 180,
        taskIds: ["task-a"]
      }
    ]);
  });

  it("uses backend resource overload rows instead of recomputing overloads in the mapper", () => {
    const viewModel = mapPlanningReadModelToGanttViewModel({
      ...createReadModel(),
      resourceLoad: {
        ...createReadModel().resourceLoad,
        overloads: []
      }
    });

    expect(viewModel.resourceLoadBuckets[0]?.overloadMinutes).toBe(0);
  });

  it("maps backend Task validation entities to row markers", () => {
    const viewModel = mapPlanningReadModelToGanttViewModel({
      ...createReadModel(),
      validationIssues: [
        {
          code: "constraint_impossible",
          severity: "warning",
          message: "Task violates constraint",
          entity: { type: "Task", id: "task-a" }
        }
      ]
    });

    expect(viewModel.tasks[0]?.validationIssueIds).toEqual([
      "constraint_impossible:Task:task-a:0"
    ]);
  });
});

function createReadModel(): PlanningReadModel {
  return {
    project: {
      id: "project-alpha",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-30",
      deadline: "2026-06-28",
      calendarId: "calendar-project"
    },
    authored: {
      tasks: [
        {
          id: "task-a",
          parentTaskId: null,
          wbsCode: "1",
          title: "Подготовка",
          statusId: "todo",
          schedulingMode: "auto",
          taskType: "fixed_units",
          effortDriven: false,
          plannedStart: "2026-06-01",
          plannedFinish: "2026-06-02",
          durationMinutes: 960,
          workMinutes: 960,
          percentComplete: 25,
          calendarId: "calendar-project",
          constraint: null
        },
        {
          id: "task-a-1",
          parentTaskId: "task-a",
          wbsCode: "1.1",
          title: "Детализация",
          statusId: "todo",
          schedulingMode: "auto",
          taskType: "fixed_units",
          effortDriven: false,
          plannedStart: "2026-06-03",
          plannedFinish: "2026-06-03",
          durationMinutes: 480,
          workMinutes: 480,
          percentComplete: 0,
          calendarId: "calendar-project",
          constraint: null
        }
      ],
      dependencies: [
        {
          id: "dep-a",
          predecessorTaskId: "task-a",
          successorTaskId: "task-a-1",
          type: "FS",
          lagMinutes: 480
        }
      ],
      assignments: [],
      baselines: [
        {
          id: "baseline-1",
          capturedAt: "2026-05-22T00:00:00.000Z",
          tasks: [
            {
              taskId: "task-a",
              plannedStart: "2026-06-01",
              plannedFinish: "2026-06-02",
              workMinutes: 960
            }
          ]
        }
      ]
    },
    calculatedPlan: {
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      planVersion: 3,
      engineVersion: "planning-core-v1",
      calculatedAt: "2026-05-22T00:00:00.000Z",
      tasks: [
        {
          id: "task-a",
          parentTaskId: null,
          wbsCode: "1",
          title: "Подготовка",
          statusId: "todo",
          schedulingMode: "auto",
          taskType: "fixed_units",
          effortDriven: false,
          plannedStart: "2026-06-01",
          plannedFinish: "2026-06-02",
          durationMinutes: 960,
          workMinutes: 960,
          percentComplete: 25,
          calendarId: "calendar-project",
          constraint: null,
          calculatedStart: "2026-06-02",
          calculatedFinish: "2026-06-03",
          calculatedStartInstant: { date: "2026-06-02", minuteOfDay: 0 },
          calculatedFinishInstant: { date: "2026-06-03", minuteOfDay: 480 },
          earliestStart: "2026-06-02",
          earliestFinish: "2026-06-03",
          earliestStartInstant: { date: "2026-06-02", minuteOfDay: 0 },
          earliestFinishInstant: { date: "2026-06-03", minuteOfDay: 480 },
          latestStart: "2026-06-02",
          latestFinish: "2026-06-03",
          latestStartInstant: { date: "2026-06-02", minuteOfDay: 0 },
          latestFinishInstant: { date: "2026-06-03", minuteOfDay: 480 },
          totalSlackMinutes: 0,
          isCritical: true
        },
        {
          id: "task-a-1",
          parentTaskId: "task-a",
          wbsCode: "1.1",
          title: "Детализация",
          statusId: "todo",
          schedulingMode: "auto",
          taskType: "fixed_units",
          effortDriven: false,
          plannedStart: "2026-06-03",
          plannedFinish: "2026-06-03",
          durationMinutes: 480,
          workMinutes: 480,
          percentComplete: 0,
          calendarId: "calendar-project",
          constraint: null,
          calculatedStart: "2026-06-04",
          calculatedFinish: "2026-06-04",
          calculatedStartInstant: { date: "2026-06-04", minuteOfDay: 0 },
          calculatedFinishInstant: { date: "2026-06-04", minuteOfDay: 480 },
          earliestStart: "2026-06-04",
          earliestFinish: "2026-06-04",
          earliestStartInstant: { date: "2026-06-04", minuteOfDay: 0 },
          earliestFinishInstant: { date: "2026-06-04", minuteOfDay: 480 },
          latestStart: "2026-06-04",
          latestFinish: "2026-06-04",
          latestStartInstant: { date: "2026-06-04", minuteOfDay: 0 },
          latestFinishInstant: { date: "2026-06-04", minuteOfDay: 480 },
          totalSlackMinutes: 480,
          isCritical: false
        }
      ],
      dependencies: [
        {
          id: "dep-a",
          predecessorTaskId: "task-a",
          successorTaskId: "task-a-1",
          type: "FS",
          lagMinutes: 480,
          valid: true,
          issueCodes: []
        }
      ],
      projectFinish: "2026-06-04",
      criticalPathTaskIds: ["task-a"],
      criticalPath: { taskIds: ["task-a"] },
      scheduleTrace: [],
      validationIssues: []
    },
    baselineComparison: {
      baselineId: "baseline-1",
      capturedAt: "2026-05-22T00:00:00.000Z",
      tasks: [
        {
          taskId: "task-a",
          baselineStart: "2026-06-01",
          baselineFinish: "2026-06-02",
          baselineWorkMinutes: 960,
          currentStart: "2026-06-02",
          currentFinish: "2026-06-03",
          currentWorkMinutes: 960,
          startDeltaDays: 1,
          finishDeltaDays: 1,
          workDeltaMinutes: 0
        }
      ]
    },
    resourceLoad: {
      buckets: [
        {
          resourceId: "user-alpha",
          positionId: "position-engineer",
          teamId: null,
          projectId: "project-alpha",
          date: "2026-06-02",
          granularity: "day",
          assignedMinutes: 600,
          reservedMinutes: 60,
          capacityMinutes: 480,
          freeMinutes: 0,
          taskIds: ["task-a"],
          assignmentIds: ["assignment-a"],
          reservationIds: ["reservation-a"],
          calendarExceptionIds: []
        }
      ],
      overloads: [
        {
          resourceId: "user-alpha",
          positionId: "position-engineer",
          teamId: null,
          projectId: "project-alpha",
          date: "2026-06-02",
          granularity: "day",
          assignedMinutes: 600,
          reservedMinutes: 60,
          capacityMinutes: 480,
          freeMinutes: 0,
          overloadMinutes: 180,
          taskIds: ["task-a"],
          assignmentIds: ["assignment-a"],
          reservationIds: ["reservation-a"],
          calendarExceptionIds: [],
          reasons: [{ type: "task", id: "task-a" }]
        }
      ],
      freeCapacityBuckets: []
    },
    validationIssues: [
      {
        code: "schedule_outside_project_bounds",
        severity: "warning",
        message: "Задача выходит за границы проекта",
        entity: { type: "task", id: "task-a" }
      }
    ],
    planVersion: 3,
    engineVersion: "planning-core-v1"
  };
}
