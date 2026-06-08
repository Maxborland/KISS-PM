import { describe, expect, it } from "vitest";

import type { PlanSnapshot } from "@kiss-pm/domain";

import { createPlanningReadModel } from "./planningReadModel";

describe("planning read model", () => {
  it("compares resource drift with effective work for implicit assignments", () => {
    const readModel = createPlanningReadModel({
      ...createSnapshot(),
      tasks: [
        {
          ...createTask(),
          workMinutes: 960,
          durationMinutes: 960
        }
      ],
      assignments: [
        {
          id: "assignment-alpha",
          taskId: "task-alpha",
          resourceId: "resource-alpha",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: null,
          calendarId: null
        }
      ],
      baselines: [
        {
          id: "baseline-alpha",
          capturedAt: "2026-05-21T00:00:00.000Z",
          tasks: [
            {
              taskId: "task-alpha",
              plannedStart: "2026-06-01",
              plannedFinish: "2026-06-01",
              workMinutes: 480
            }
          ],
          assignments: [
            {
              assignmentId: "assignment-alpha",
              taskId: "task-alpha",
              resourceId: "resource-alpha",
              workMinutes: null
            }
          ]
        }
      ]
    });

    expect(readModel.baselineComparison.assignments).toEqual([
      {
        assignmentId: "assignment-alpha",
        status: "changed",
        baselineTaskId: "task-alpha",
        currentTaskId: "task-alpha",
        baselineResourceId: "resource-alpha",
        currentResourceId: "resource-alpha",
        baselineWorkMinutes: 480,
        currentWorkMinutes: 960,
        workDeltaMinutes: 480
      }
    ]);

    expect(readModel.baselineComparison.resources).toEqual([
      {
        resourceId: "resource-alpha",
        status: "changed",
        baselineWorkMinutes: 480,
        currentWorkMinutes: 960,
        workDeltaMinutes: 480
      }
    ]);
  });

  it("keeps baseline implicit assignment work independent of current assignment splits", () => {
    const readModel = createPlanningReadModel({
      ...createSnapshot(),
      resources: [createResource("resource-alpha"), createResource("resource-beta")],
      assignments: [
        {
          id: "assignment-alpha",
          taskId: "task-alpha",
          resourceId: "resource-alpha",
          role: "executor",
          unitsPermille: 500,
          workMinutes: null,
          calendarId: null
        },
        {
          id: "assignment-beta",
          taskId: "task-alpha",
          resourceId: "resource-beta",
          role: "co_executor",
          unitsPermille: 500,
          workMinutes: null,
          calendarId: null
        }
      ],
      baselines: [
        {
          id: "baseline-alpha",
          capturedAt: "2026-05-21T00:00:00.000Z",
          tasks: [
            {
              taskId: "task-alpha",
              plannedStart: "2026-06-01",
              plannedFinish: "2026-06-01",
              workMinutes: 480
            }
          ],
          assignments: [
            {
              assignmentId: "assignment-alpha",
              taskId: "task-alpha",
              resourceId: "resource-alpha",
              workMinutes: null
            }
          ]
        }
      ]
    });

    expect(readModel.baselineComparison.resources).toEqual([
      {
        resourceId: "resource-alpha",
        status: "changed",
        baselineWorkMinutes: 480,
        currentWorkMinutes: 240,
        workDeltaMinutes: -240
      },
      {
        resourceId: "resource-beta",
        status: "added",
        baselineWorkMinutes: 0,
        currentWorkMinutes: 240,
        workDeltaMinutes: 240
      }
    ]);
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
    tasks: [createTask()],
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [
      {
        id: "calendar-default",
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480
      }
    ],
    calendarExceptions: [],
    resources: [createResource("resource-alpha")],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}

function createTask() {
  return {
    id: "task-alpha",
    parentTaskId: null,
    wbsCode: "1",
    title: "Task alpha",
    statusId: "todo",
    schedulingMode: "auto" as const,
    taskType: "fixed_work" as const,
    effortDriven: false,
    plannedStart: "2026-06-01",
    plannedFinish: "2026-06-01",
    durationMinutes: 480,
    workMinutes: 480,
    percentComplete: 0,
    calendarId: "calendar-default",
    constraint: null
  };
}

function createResource(id: string) {
  return {
    id,
    userId: id,
    positionId: "engineer",
    teamId: null,
    name: id,
    calendarId: "calendar-default"
  };
}
