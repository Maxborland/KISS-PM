import { describe, expect, it } from "vitest";
import type { PlanningReadModel } from "@kiss-pm/planning-client";

import { mapRows } from "./schedule-rows";

const task = (
  overrides: Partial<PlanningReadModel["authored"]["tasks"][number]>
): PlanningReadModel["authored"]["tasks"][number] => ({
  id: "task",
  parentTaskId: null,
  wbsCode: "10",
  title: "Task",
  statusId: "todo",
  schedulingMode: "auto",
  taskType: "fixed_duration",
  effortDriven: false,
  plannedStart: null,
  plannedFinish: null,
  durationMinutes: 480,
  workMinutes: 480,
  percentComplete: 0,
  calendarId: null,
  constraint: null,
  customFields: {},
  ...overrides
});

const calc = (
  taskOverrides: PlanningReadModel["authored"]["tasks"][number],
  start: string,
  finish: string
): PlanningReadModel["calculatedPlan"]["tasks"][number] => ({
  ...taskOverrides,
  calculatedStart: start,
  calculatedFinish: finish,
  calculatedStartInstant: null,
  calculatedFinishInstant: null,
  earliestStart: start,
  earliestFinish: finish,
  earliestStartInstant: null,
  earliestFinishInstant: null,
  latestStart: start,
  latestFinish: finish,
  latestStartInstant: null,
  latestFinishInstant: null,
  totalSlackMinutes: 0,
  isCritical: false
});

describe("schedule row mapping", () => {
  it("treats tasks with parentTaskId children as summaries without mock kind or WBS conventions", () => {
    const parent = task({
      id: "parent",
      wbsCode: "A",
      title: "Live parent",
      durationMinutes: 480,
      workMinutes: 480,
      percentComplete: 5
    });
    const childA = task({
      id: "child-a",
      parentTaskId: "parent",
      wbsCode: "B",
      title: "Child A",
      durationMinutes: 960,
      workMinutes: 960,
      percentComplete: 25
    });
    const childB = task({
      id: "child-b",
      parentTaskId: "parent",
      wbsCode: "C",
      title: "Child B",
      durationMinutes: 480,
      workMinutes: 1440,
      percentComplete: 75
    });
    const rm = {
      project: {
        id: "project",
        sourceType: "manual",
        sourceOpportunityId: null,
        plannedStart: "2026-03-02",
        plannedFinish: "2026-03-08",
        deadline: null,
        calendarId: null
      },
      authored: {
        tasks: [parent, childA, childB],
        dependencies: [],
        assignments: [],
        assignmentAllocations: [],
        baselines: []
      },
      calculatedPlan: {
        tenantId: "tenant",
        projectId: "project",
        planVersion: 1,
        engineVersion: "test",
        calculatedAt: "2026-03-01T00:00:00.000Z",
        tasks: [
          calc(parent, "2026-03-02", "2026-03-03"),
          calc(childA, "2026-03-04", "2026-03-06"),
          calc(childB, "2026-03-06", "2026-03-07")
        ],
        dependencies: [],
        projectFinish: "2026-03-07",
        criticalPathTaskIds: [],
        criticalPath: { taskIds: [] },
        scheduleTrace: [],
        validationIssues: []
      },
      baselineComparison: { baselineId: null, capturedAt: null, tasks: [] },
      resourceLoad: { buckets: [], overloads: [], acceptedOverloads: [], freeCapacityBuckets: [] },
      calendars: [],
      calendarExceptions: [],
      validationIssues: [],
      planVersion: 1,
      engineVersion: "test"
    } satisfies PlanningReadModel;

    const { rows } = mapRows(rm, (id) => id);

    expect(rows.find((row) => row.id === "parent")).toMatchObject({
      kind: "summary",
      hasChildren: true,
      workH: 40,
      durDays: 3,
      startIso: "2026-03-04",
      finishIso: "2026-03-07",
      pct: 55
    });
    expect(rows.find((row) => row.id === "child-a")).toMatchObject({
      kind: "task",
      parentId: "parent",
      hasChildren: false
    });
  });
});
