import { describe, expect, it } from "vitest";

import { calculatePlan } from "./schedulingEngine";
import type { DependencyType, PlanSnapshot, PlanTask } from "./types";

describe("scheduling engine", () => {
  it("calculates a deterministic forward and backward pass in dependency order", () => {
    const snapshot = createSnapshot({
      tasks: [
        createTask("task-b", "1", "2026-06-01"),
        createTask("task-a", "2", "2026-06-01")
      ],
      dependencies: [
        {
          id: "dep-a-b",
          predecessorTaskId: "task-a",
          successorTaskId: "task-b",
          type: "FS",
          lagMinutes: 0
        }
      ]
    });

    const result = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    expect(result.validationIssues).toEqual([]);
    expect(result.tasks.map((task) => task.id)).toEqual(["task-b", "task-a"]);
    expect(task(result, "task-a")).toMatchObject({
      calculatedStartInstant: { date: "2026-06-01", minuteOfDay: 0 },
      calculatedFinishInstant: { date: "2026-06-01", minuteOfDay: 480 },
      totalSlackMinutes: 0,
      isCritical: true
    });
    expect(task(result, "task-b")).toMatchObject({
      calculatedStartInstant: { date: "2026-06-02", minuteOfDay: 0 },
      calculatedFinishInstant: { date: "2026-06-02", minuteOfDay: 480 },
      totalSlackMinutes: 0,
      isCritical: true
    });
    expect(result.criticalPath).toEqual({ taskIds: ["task-b", "task-a"] });
    expect(result.scheduleTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "task-b",
          dependencyStart: { date: "2026-06-02", minuteOfDay: 0 },
          earliestStart: { date: "2026-06-02", minuteOfDay: 0 },
          latestFinish: { date: "2026-06-02", minuteOfDay: 480 },
          durationMinutes: 480,
          issueCodes: []
        })
      ])
    );
  });

  it.each<DependencyType>(["FS", "SS", "FF", "SF"])(
    "supports %s dependencies in schedule calculation",
    (dependencyType) => {
      const result = calculatePlan(
        createSnapshot({
          dependencies: [
            {
              id: `dep-${dependencyType}`,
              predecessorTaskId: "task-a",
              successorTaskId: "task-b",
              type: dependencyType,
              lagMinutes: dependencyType === "SS" ? 120 : 0
            }
          ]
        }),
        {
          calculatedAt: "2026-05-21T00:00:00.000Z",
          engineVersion: "planning-core-v1"
        }
      );

      expect(result.validationIssues).toEqual([]);
      expect(task(result, "task-b").calculatedStartInstant).toEqual(
        expectedStartByDependency[dependencyType]
      );
    }
  );

  it("uses Work/Duration/Units through executor assignments", () => {
    const result = calculatePlan(
      createSnapshot({
        tasks: [
          {
            ...createTask("task-a", "1", "2026-06-01"),
            workMinutes: 960,
            durationMinutes: 480,
            taskType: "fixed_units"
          }
        ],
        assignments: [
          {
            id: "assignment-a",
            taskId: "task-a",
            resourceId: "resource-alpha",
            role: "executor",
            unitsPermille: 2000,
            workMinutes: 960,
            calendarId: null
          }
        ]
      }),
      {
        calculatedAt: "2026-05-21T00:00:00.000Z",
        engineVersion: "planning-core-v1"
      }
    );

    expect(task(result, "task-a")).toMatchObject({
      durationMinutes: 480,
      calculatedFinishInstant: { date: "2026-06-01", minuteOfDay: 480 }
    });
  });

  it("uses explicit assignment allocations as the calculated task span", () => {
    const result = calculatePlan(
      createSnapshot({
        tasks: [
          {
            ...createTask("task-a", "1", "2026-06-01"),
            workMinutes: 960,
            durationMinutes: 480,
            taskType: "fixed_work",
            effortDriven: true,
            plannedFinish: "2026-06-03"
          }
        ],
        assignments: [
          {
            id: "assignment-a",
            taskId: "task-a",
            resourceId: "resource-alpha",
            role: "executor",
            unitsPermille: 2000,
            workMinutes: 960,
            calendarId: null
          }
        ],
        assignmentAllocations: [
          {
            assignmentId: "assignment-a",
            taskId: "task-a",
            resourceId: "resource-alpha",
            date: "2026-06-01",
            workMinutes: 480
          },
          {
            assignmentId: "assignment-a",
            taskId: "task-a",
            resourceId: "resource-alpha",
            date: "2026-06-03",
            workMinutes: 480
          }
        ]
      }),
      {
        calculatedAt: "2026-05-21T00:00:00.000Z",
        engineVersion: "planning-core-v1"
      }
    );

    expect(task(result, "task-a")).toMatchObject({
      durationMinutes: 1440,
      calculatedStartInstant: { date: "2026-06-01", minuteOfDay: 0 },
      calculatedFinishInstant: { date: "2026-06-03", minuteOfDay: 480 },
      calculatedFinish: "2026-06-03"
    });
    expect(result.projectFinish).toBe("2026-06-03");
  });

  it("reports cycles, impossible constraints and missing resource warnings", () => {
    const result = calculatePlan(
      createSnapshot({
        tasks: [
          {
            ...createTask("task-a", "1", "2026-06-01"),
            constraint: {
              id: "constraint-a",
              taskId: "task-a",
              type: "finish_no_later_than",
              date: "2026-05-29"
            }
          },
          createTask("task-b", "2", "2026-06-01")
        ],
        assignments: [],
        dependencies: [
          { id: "dep-a-b", predecessorTaskId: "task-a", successorTaskId: "task-b", type: "FS", lagMinutes: 0 },
          { id: "dep-b-a", predecessorTaskId: "task-b", successorTaskId: "task-a", type: "FS", lagMinutes: 0 }
        ]
      }),
      {
        calculatedAt: "2026-05-21T00:00:00.000Z",
        engineVersion: "planning-core-v1"
      }
    );

    expect(result.validationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "dependency_cycle_detected" }),
        expect.objectContaining({ code: "constraint_impossible" }),
        expect.objectContaining({ code: "assignment_without_resource" })
      ])
    );
    expect(result.dependencies.every((dependency) => dependency.valid === false)).toBe(true);
    expect(result.criticalPathTaskIds).toEqual([]);
  });

  it("reports must-start constraints that conflict with dependencies", () => {
    const result = calculatePlan(
      createSnapshot({
        tasks: [
          createTask("task-a", "1", "2026-06-01"),
          {
            ...createTask("task-b", "2", "2026-06-01"),
            constraint: {
              id: "constraint-b",
              taskId: "task-b",
              type: "must_start_on",
              date: "2026-06-01"
            }
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
        ]
      }),
      {
        calculatedAt: "2026-05-21T00:00:00.000Z",
        engineVersion: "planning-core-v1"
      }
    );

    expect(result.validationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "constraint_impossible",
          entity: { type: "Task", id: "task-b" }
        })
      ])
    );
    expect(result.scheduleTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "task-b",
          dependencyStart: { date: "2026-06-02", minuteOfDay: 0 },
          appliedConstraintType: "must_start_on",
          issueCodes: ["constraint_impossible"]
        })
      ])
    );
  });

  it("reports calendars with no working time instead of throwing", () => {
    const result = calculatePlan(
      createSnapshot({
        calendars: [
          {
            id: "calendar-default",
            workingWeekdays: [],
            workingMinutesPerDay: 0
          }
        ],
        calendarExceptions: []
      }),
      {
        calculatedAt: "2026-05-21T00:00:00.000Z",
        engineVersion: "planning-core-v1"
      }
    );

    expect(result.validationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "calendar_has_no_working_time",
          severity: "error",
          entity: { type: "Task", id: "task-a" }
        }),
        expect.objectContaining({
          code: "calendar_has_no_working_time",
          severity: "error",
          entity: { type: "Task", id: "task-b" }
        })
      ])
    );
    expect(result.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "task-a", calculatedStart: null, calculatedFinish: null }),
        expect.objectContaining({ id: "task-b", calculatedStart: null, calculatedFinish: null })
      ])
    );
  });
});

const expectedStartByDependency = {
  FS: { date: "2026-06-02", minuteOfDay: 0 },
  SS: { date: "2026-06-01", minuteOfDay: 120 },
  FF: { date: "2026-06-01", minuteOfDay: 0 },
  SF: { date: "2026-06-01", minuteOfDay: 0 }
} as const;

// Регресс BUG-PROJ-23: нулевая веха (work=0, duration=0) — валидна, а задача с
// трудоёмкостью, но нулевой длительностью — нет.
describe("invalid_work_model validation", () => {
  it("does not flag a zero-work, zero-duration milestone", () => {
    const milestone: PlanTask = {
      ...createTask("task-milestone", "1", "2026-06-01"),
      workMinutes: 0,
      durationMinutes: 0
    };
    const result = calculatePlan(createSnapshot({ tasks: [milestone], assignments: [] }), {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    expect(result.validationIssues.filter((i) => i.code === "invalid_work_model")).toEqual([]);
  });

  it("flags a task that has work but zero duration", () => {
    const broken: PlanTask = {
      ...createTask("task-broken", "1", "2026-06-01"),
      workMinutes: 480,
      durationMinutes: 0
    };
    const result = calculatePlan(createSnapshot({ tasks: [broken], assignments: [] }), {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    expect(result.validationIssues.some((i) => i.code === "invalid_work_model")).toBe(true);
  });
});

function task(result: ReturnType<typeof calculatePlan>, taskId: string) {
  const found = result.tasks.find((candidate) => candidate.id === taskId);
  if (!found) throw new Error(`missing task ${taskId}`);
  return found;
}

function createSnapshot(overrides: Partial<PlanSnapshot> = {}): PlanSnapshot {
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
    tasks: [createTask("task-a", "1", "2026-06-01"), createTask("task-b", "2", "2026-06-01")],
    assignments: [
      {
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      },
      {
        id: "assignment-b",
        taskId: "task-b",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      }
    ],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [
      { id: "resource-alpha", userId: "user-alpha", positionId: "engineer", teamId: null, name: "Alpha", calendarId: null }
    ],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z",
    ...overrides
  };
}

function createTask(id: string, wbsCode: string, plannedStart: string): PlanTask {
  return {
    id,
    parentTaskId: null,
    wbsCode,
    title: id,
    statusId: "todo",
    schedulingMode: "auto",
    taskType: "fixed_units",
    effortDriven: false,
    plannedStart,
    plannedFinish: null,
    durationMinutes: 480,
    workMinutes: 480,
    percentComplete: 0,
    calendarId: "calendar-default",
    constraint: null
  };
}
