import { describe, expect, it } from "vitest";

import {
  buildClosurePlanFactSummary,
  buildTemplateImprovementImpact,
  type PlanSnapshot
} from "./index";

describe("retrospectives domain", () => {
  it("builds plan/fact summary from immutable planning snapshot and task facts", () => {
    const summary = buildClosurePlanFactSummary({
      snapshot: createSnapshot(),
      factTasks: [
        {
          id: "task-1",
          actualWorkMinutes: 600,
          progress: 100,
          statusCategory: "done"
        },
        {
          id: "task-2",
          actualWorkMinutes: 300,
          progress: 50,
          statusCategory: "in_progress"
        }
      ]
    });

    expect(summary).toMatchObject({
      planVersion: 7,
      plannedStart: "2026-05-01",
      plannedFinish: "2026-05-10",
      actualStart: "2026-05-01",
      actualFinish: "2026-05-04",
      plannedWorkMinutes: 720,
      actualWorkMinutes: 900,
      workVarianceMinutes: 180,
      scheduleVarianceDays: -6,
      taskCount: 2,
      completedTaskCount: 1,
      openTaskCount: 1,
      baselineId: "baseline-1"
    });
    expect(buildTemplateImprovementImpact(summary)).toEqual({
      plannedWorkDeltaMinutes: 180,
      plannedDurationDeltaDays: -6,
      confidence: "medium",
      sourceMetric: "closure_plan_fact"
    });
  });

  it("keeps actual start and finish empty before any task execution", () => {
    const summary = buildClosurePlanFactSummary({
      snapshot: createSnapshot({
        tasks: createSnapshot().tasks.map((task) => ({ ...task, percentComplete: 0 }))
      }),
      factTasks: [
        {
          id: "task-1",
          actualWorkMinutes: 0,
          progress: 0,
          statusCategory: "todo"
        },
        {
          id: "task-2",
          actualWorkMinutes: 0,
          progress: 0,
          statusCategory: "todo"
        }
      ]
    });

    expect(summary).toMatchObject({
      actualStart: null,
      actualFinish: null,
      scheduleVarianceDays: 0,
      completedTaskCount: 0,
      openTaskCount: 2
    });
  });

  it("sets actual start from started tasks but keeps actual finish empty until completion", () => {
    const summary = buildClosurePlanFactSummary({
      snapshot: createSnapshot({
        tasks: createSnapshot().tasks.map((task) => ({ ...task, percentComplete: 0 }))
      }),
      factTasks: [
        {
          id: "task-1",
          actualWorkMinutes: 120,
          progress: 25,
          statusCategory: "in_progress"
        },
        {
          id: "task-2",
          actualWorkMinutes: 0,
          progress: 0,
          statusCategory: "todo"
        }
      ]
    });

    expect(summary).toMatchObject({
      actualStart: "2026-05-01",
      actualFinish: null,
      scheduleVarianceDays: 0,
      completedTaskCount: 0,
      openTaskCount: 2
    });
  });
});

function createSnapshot(input: Partial<PlanSnapshot> = {}): PlanSnapshot {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 7,
    project: {
      id: "project-alpha",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-05-01",
      plannedFinish: "2026-05-10",
      deadline: "2026-05-10",
      calendarId: null
    },
    tasks: [
      {
        id: "task-1",
        parentTaskId: null,
        wbsCode: "1",
        title: "Discovery",
        statusId: "done",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-05-01",
        plannedFinish: "2026-05-04",
        plannedStartInstant: { date: "2026-05-01", minuteOfDay: 540 },
        plannedFinishInstant: { date: "2026-05-04", minuteOfDay: 1080 },
        durationMinutes: 960,
        workMinutes: 480,
        percentComplete: 100,
        calendarId: null,
        customFields: {},
        constraint: null
      },
      {
        id: "task-2",
        parentTaskId: null,
        wbsCode: "2",
        title: "Build",
        statusId: "in-progress",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-05-05",
        plannedFinish: "2026-05-10",
        plannedStartInstant: { date: "2026-05-05", minuteOfDay: 540 },
        plannedFinishInstant: { date: "2026-05-10", minuteOfDay: 1080 },
        durationMinutes: 1440,
        workMinutes: 240,
        percentComplete: 50,
        calendarId: null,
        customFields: {},
        constraint: null
      }
    ],
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [{ id: "baseline-1", label: "Baseline 1", capturedAt: "2026-05-01T00:00:00.000Z", tasks: [] }],
    calendars: [],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-11T10:00:00.000Z",
    ...input
  };
}
