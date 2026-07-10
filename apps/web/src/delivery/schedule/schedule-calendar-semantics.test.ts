import {
  calculatePlan,
  reducePlanningCommand,
  type CalculatedPlan,
  type PlanCalendar,
  type PlanSnapshot,
  type PlanTask
} from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { describe, expect, it } from "vitest";

import { buildFinishDateFillCommands } from "./schedule-productivity";
import { mapRows } from "./schedule-rows";
import { resolveScheduleWorkingTime } from "./schedule-working-time";

const standardCalendar: PlanCalendar = {
  id: "calendar-standard",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480
};
const sixHourCalendar: PlanCalendar = {
  id: "calendar-six-hour",
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 360
};

function task(overrides: Partial<PlanTask> = {}): PlanTask {
  return {
    id: "task",
    parentTaskId: null,
    wbsCode: "1",
    title: "Task",
    statusId: "todo",
    schedulingMode: "auto",
    taskType: "fixed_duration",
    effortDriven: false,
    plannedStart: "2026-07-10",
    plannedFinish: "2026-07-10",
    durationMinutes: 360,
    workMinutes: 360,
    percentComplete: 0,
    calendarId: sixHourCalendar.id,
    constraint: null,
    customFields: {},
    ...overrides
  };
}

function snapshot(tasks: PlanTask[], holiday = false): PlanSnapshot {
  return {
    tenantId: "tenant",
    projectId: "project",
    planVersion: 1,
    project: {
      id: "project",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-07-10",
      plannedFinish: "2026-07-31",
      deadline: null,
      calendarId: standardCalendar.id
    },
    tasks,
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [standardCalendar, sixHourCalendar],
    calendarExceptions: holiday
      ? [{
          id: "holiday",
          calendarId: sixHourCalendar.id,
          resourceId: null,
          date: "2026-07-13",
          workingMinutes: 0,
          reason: "holiday"
        }]
      : [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-07-10T00:00:00.000Z"
  };
}

function calculatedTask(
  source: PlanTask,
  start: string,
  finish: string,
  totalSlackMinutes: number
): CalculatedPlan["tasks"][number] {
  return {
    ...source,
    calculatedStart: start,
    calculatedFinish: finish,
    calculatedStartInstant: { date: start, minuteOfDay: 0 },
    calculatedFinishInstant: { date: finish, minuteOfDay: 360 },
    earliestStart: start,
    earliestFinish: finish,
    earliestStartInstant: { date: start, minuteOfDay: 0 },
    earliestFinishInstant: { date: finish, minuteOfDay: 360 },
    latestStart: start,
    latestFinish: finish,
    latestStartInstant: { date: start, minuteOfDay: 0 },
    latestFinishInstant: { date: finish, minuteOfDay: 360 },
    totalSlackMinutes,
    isCritical: false
  };
}

function readModel(
  source: PlanSnapshot,
  calculatedPlan: CalculatedPlan,
  dependencies = source.dependencies
): PlanningReadModel {
  return {
    project: source.project,
    authored: {
      tasks: source.tasks,
      dependencies,
      assignments: source.assignments,
      assignmentAllocations: source.assignmentAllocations ?? [],
      baselines: source.baselines
    },
    calculatedPlan,
    baselineComparison: {
      baselineId: null,
      label: null,
      capturedAt: null,
      tasks: []
    },
    resourceLoad: {
      buckets: [],
      overloads: [],
      acceptedOverloads: [],
      freeCapacityBuckets: []
    },
    calendars: source.calendars,
    calendarExceptions: source.calendarExceptions,
    validationIssues: calculatedPlan.validationIssues,
    planVersion: source.planVersion,
    engineVersion: calculatedPlan.engineVersion
  };
}

describe("schedule calendar semantics", () => {
  it("uses the engine fallback for partial read models without calendar arrays", () => {
    expect(resolveScheduleWorkingTime({ project: {} }, null)).toMatchObject({
      calendar: {
        id: "default-calendar",
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480
      },
      exceptions: [],
      workingMinutesPerDay: 480
    });
  });

  it("maps duration, successor lag and slack through the task override while keeping calendar-day geometry", () => {
    const predecessor = task({
      id: "predecessor",
      wbsCode: "1",
      calendarId: standardCalendar.id,
      durationMinutes: 480,
      workMinutes: 480
    });
    const successor = task({
      id: "successor",
      wbsCode: "2",
      durationMinutes: 720,
      workMinutes: 720
    });
    const source = snapshot([predecessor, successor]);
    const dependency = {
      id: "dependency",
      predecessorTaskId: predecessor.id,
      successorTaskId: successor.id,
      type: "FS" as const,
      lagMinutes: 360
    };
    const calculatedPlan: CalculatedPlan = {
      tenantId: source.tenantId,
      projectId: source.projectId,
      planVersion: source.planVersion,
      engineVersion: "test",
      calculatedAt: source.capturedAt,
      tasks: [
        calculatedTask(predecessor, "2026-07-09", "2026-07-09", 0),
        calculatedTask(successor, "2026-07-10", "2026-07-13", 360)
      ],
      dependencies: [],
      projectFinish: "2026-07-13",
      criticalPathTaskIds: [],
      criticalPath: { taskIds: [] },
      scheduleTrace: [],
      validationIssues: []
    };

    const row = mapRows(
      readModel(source, calculatedPlan, [dependency]),
      (resourceId) => resourceId
    ).rows.find((candidate) => candidate.id === successor.id);

    expect(row).toMatchObject({
      durDays: 2,
      slackDays: 1,
      dayDur: 3,
      finishIso: "2026-07-13",
      effectiveCalendarId: sixHourCalendar.id,
      workingMinutesPerDay: 360,
      predList: [expect.objectContaining({ lagDays: 1 })]
    });
  });

  it("normalizes a holiday finish, builds working-minute commands and matches calculated visible finish", () => {
    let source = snapshot([task()], true);
    const result = buildFinishDateFillCommands({
      firstFinishIso: "2026-07-13",
      mode: "same",
      rows: [{
        id: "task",
        startIso: "2026-07-10",
        durationDays: 1,
        durationMinutes: 360,
        workHours: 6,
        calendarId: sixHourCalendar.id
      }],
      assignments: [],
      calendarSource: source
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview).toEqual([{
      taskId: "task",
      finishIso: "2026-07-14",
      durationDays: 2,
      workHours: 12
    }]);
    expect(result.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "task.update_work_model",
        payload: expect.objectContaining({
          durationMinutes: 720,
          workMinutes: 720
        })
      })
    ]));

    for (const command of result.commands) {
      const reduction = reducePlanningCommand(source, command);
      expect(reduction.validationIssues).toEqual([]);
      source = reduction.nextSnapshot;
    }
    const calculatedPlan = calculatePlan(source, {
      calculatedAt: "2026-07-10T01:00:00.000Z",
      engineVersion: "test"
    });
    const visibleRow = mapRows(
      readModel(source, calculatedPlan),
      (resourceId) => resourceId
    ).rows[0];

    expect(calculatedPlan.tasks[0]?.calculatedFinish).toBe("2026-07-14");
    expect(visibleRow).toMatchObject({
      finishIso: result.preview[0]?.finishIso,
      durDays: 2,
      dayDur: 4
    });
  });
});
