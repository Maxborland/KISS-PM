import { describe, expect, it } from "vitest";

import { buildResourceLoadMatrix } from "./resourcePlanning";
import { calculatePlan } from "./schedulingEngine";
import type { PlanSnapshot } from "./types";

describe("resource planning", () => {
  it("builds day, week and month load buckets with overload and free capacity drilldown", () => {
    const snapshot = createSnapshot();
    const plan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const matrix = buildResourceLoadMatrix({
      plan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-05"
    });

    expect(matrix.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: "resource-alpha",
          positionId: "engineer",
          teamId: "team-platform",
          granularity: "day",
          date: "2026-06-01",
          assignedMinutes: 960,
          reservedMinutes: 120,
          capacityMinutes: 480,
          taskIds: ["task-a"],
          assignmentIds: ["assignment-a"],
          reservationIds: ["reservation-a"]
        }),
        expect.objectContaining({
          resourceId: "resource-alpha",
          granularity: "week",
          date: "2026-06-01"
        }),
        expect.objectContaining({
          resourceId: "resource-alpha",
          granularity: "month",
          date: "2026-06-01"
        })
      ])
    );
    expect(matrix.overloads).toEqual([
      expect.objectContaining({
        resourceId: "resource-alpha",
        date: "2026-06-01",
        overloadMinutes: 600,
        reasons: expect.arrayContaining([
          { type: "task", id: "task-a" },
          { type: "assignment", id: "assignment-a" },
          { type: "reservation", id: "reservation-a" }
        ])
      })
    ]);
    expect(matrix.freeCapacityBuckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: "resource-alpha",
          date: "2026-06-02",
          freeMinutes: 480
        })
      ])
    );
  });

  it("uses calendar exceptions as absence capacity changes", () => {
    const snapshot = {
      ...createSnapshot(),
      assignments: [
        {
          id: "assignment-a",
          taskId: "task-a",
          resourceId: "resource-alpha",
          role: "executor" as const,
          unitsPermille: 1000,
          workMinutes: 480,
          calendarId: null
        }
      ],
      reservations: [],
      calendarExceptions: [
        {
          id: "exception-a",
          calendarId: "calendar-default",
          resourceId: "resource-alpha",
          date: "2026-06-01",
          workingMinutes: 240,
          reason: "absence"
        }
      ]
    };
    const plan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const matrix = buildResourceLoadMatrix({
      plan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01",
      granularities: ["day"]
    });

    expect(matrix.buckets[0]).toMatchObject({
      capacityMinutes: 240,
      assignedMinutes: 480,
      assignmentIds: ["assignment-a"],
      calendarExceptionIds: ["exception-a"]
    });
    expect(matrix.overloads).toEqual([
      expect.objectContaining({
        resourceId: "resource-alpha",
        date: "2026-06-01",
        overloadMinutes: 240,
        reasons: expect.arrayContaining([
          { type: "assignment", id: "assignment-a" },
          { type: "calendar_exception", id: "exception-a" }
        ])
      })
    ]);
  });

  it("splits task work across assignments without explicit assignment work", () => {
    const snapshot = {
      ...createSnapshot(),
      resources: [
        ...createSnapshot().resources,
        {
          id: "resource-beta",
          userId: "user-beta",
          positionId: "engineer",
          teamId: "team-platform",
          name: "Beta",
          calendarId: "calendar-default"
        }
      ],
      assignments: [
        {
          id: "assignment-alpha",
          taskId: "task-a",
          resourceId: "resource-alpha",
          role: "executor" as const,
          unitsPermille: 1000,
          workMinutes: null,
          calendarId: null
        },
        {
          id: "assignment-beta",
          taskId: "task-a",
          resourceId: "resource-beta",
          role: "co_executor" as const,
          unitsPermille: 1000,
          workMinutes: null,
          calendarId: null
        }
      ],
      reservations: []
    };
    const plan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const matrix = buildResourceLoadMatrix({
      plan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01",
      granularities: ["day"]
    });

    expect(matrix.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: "resource-alpha",
          assignedMinutes: 480,
          assignmentIds: ["assignment-alpha"]
        }),
        expect.objectContaining({
          resourceId: "resource-beta",
          assignedMinutes: 480,
          assignmentIds: ["assignment-beta"]
        })
      ])
    );
    expect(matrix.overloads).toEqual([]);
  });

  it("uses explicit assignment allocations instead of even distribution", () => {
    const baseTask = createSnapshot().tasks[0];
    if (!baseTask) throw new Error("missing base task");
    const snapshot = {
      ...createSnapshot(),
      tasks: [
        {
          ...baseTask,
          durationMinutes: 960,
          workMinutes: 960
        }
      ],
      assignments: [
        {
          id: "assignment-a",
          taskId: "task-a",
          resourceId: "resource-alpha",
          role: "executor" as const,
          unitsPermille: 1000,
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
          workMinutes: 240
        },
        {
          assignmentId: "assignment-a",
          taskId: "task-a",
          resourceId: "resource-alpha",
          date: "2026-06-02",
          workMinutes: 720
        }
      ],
      reservations: []
    };
    const plan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const matrix = buildResourceLoadMatrix({
      plan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      assignmentAllocations: snapshot.assignmentAllocations,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-02",
      granularities: ["day"]
    });

    expect(matrix.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-06-01",
          assignedMinutes: 240
        }),
        expect.objectContaining({
          date: "2026-06-02",
          assignedMinutes: 720
        })
      ])
    );
    expect(matrix.overloads).toEqual([
      expect.objectContaining({
        date: "2026-06-02",
        overloadMinutes: 240
      })
    ]);
  });

  it("allocates task load by working instants instead of date labels", () => {
    const baseTask = createSnapshot().tasks[0];
    if (!baseTask) throw new Error("missing base task");
    const snapshot = {
      ...createSnapshot(),
      tasks: [
        {
          ...baseTask,
          plannedStart: "2026-06-01",
          plannedFinish: "2026-06-02",
          plannedStartInstant: { date: "2026-06-01", minuteOfDay: 240 },
          durationMinutes: 480,
          workMinutes: 480
        }
      ],
      assignments: [
        {
          id: "assignment-a",
          taskId: "task-a",
          resourceId: "resource-alpha",
          role: "executor" as const,
          unitsPermille: 1000,
          workMinutes: 480,
          calendarId: null
        }
      ],
      reservations: []
    };
    const plan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const matrix = buildResourceLoadMatrix({
      plan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-02",
      granularities: ["day"]
    });

    expect(plan.tasks[0]).toMatchObject({
      calculatedStartInstant: { date: "2026-06-01", minuteOfDay: 240 },
      calculatedFinishInstant: { date: "2026-06-02", minuteOfDay: 240 }
    });
    expect(matrix.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-06-01",
          assignedMinutes: 240
        }),
        expect.objectContaining({
          date: "2026-06-02",
          assignedMinutes: 240
        })
      ])
    );
  });

  it("includes assignment and calendar exception reasons in overload drilldown", () => {
    const snapshot = {
      ...createSnapshot(),
      calendarExceptions: [
        {
          id: "exception-a",
          calendarId: "calendar-default",
          resourceId: "resource-alpha",
          date: "2026-06-01",
          workingMinutes: 240,
          reason: "absence"
        }
      ]
    };
    const plan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const matrix = buildResourceLoadMatrix({
      plan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01",
      granularities: ["day"]
    });

    expect(matrix.overloads).toEqual([
      expect.objectContaining({
        resourceId: "resource-alpha",
        date: "2026-06-01",
        assignmentIds: ["assignment-a"],
        calendarExceptionIds: ["exception-a"],
        reasons: expect.arrayContaining([
          { type: "task", id: "task-a" },
          { type: "assignment", id: "assignment-a" },
          { type: "reservation", id: "reservation-a" },
          { type: "calendar_exception", id: "exception-a" }
        ])
      })
    ]);
  });

  it("does not apply resource-specific calendar exceptions to unrelated resources", () => {
    const snapshot = {
      ...createSnapshot(),
      assignments: [
        {
          id: "assignment-a",
          taskId: "task-a",
          resourceId: "resource-alpha",
          role: "executor" as const,
          unitsPermille: 1000,
          workMinutes: 480,
          calendarId: null
        }
      ],
      reservations: [],
      resources: [
        ...createSnapshot().resources,
        {
          id: "resource-beta",
          userId: "user-beta",
          positionId: "engineer",
          teamId: "team-platform",
          name: "Beta",
          calendarId: "calendar-default"
        }
      ],
      calendarExceptions: [
        {
          id: "exception-beta",
          calendarId: "calendar-default",
          resourceId: "resource-beta",
          date: "2026-06-01",
          workingMinutes: 240,
          reason: "absence"
        }
      ]
    };
    const plan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const matrix = buildResourceLoadMatrix({
      plan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01",
      granularities: ["day"]
    });

    const alphaBucket = matrix.buckets.find((bucket) => bucket.resourceId === "resource-alpha");
    const betaBucket = matrix.buckets.find((bucket) => bucket.resourceId === "resource-beta");

    expect(plan.tasks[0]).toMatchObject({
      calculatedStart: "2026-06-01",
      calculatedFinish: "2026-06-01"
    });
    expect(alphaBucket).toMatchObject({
      capacityMinutes: 480,
      assignedMinutes: 480
    });
    expect(betaBucket).toMatchObject({
      capacityMinutes: 240,
      assignedMinutes: 0
    });
  });

  it("keeps co-executor schedules independent when one resource is absent", () => {
    const snapshot = {
      ...createSnapshot(),
      resources: [
        ...createSnapshot().resources,
        {
          id: "resource-beta",
          userId: "user-beta",
          positionId: "engineer",
          teamId: "team-platform",
          name: "Beta",
          calendarId: "calendar-default"
        }
      ],
      assignments: [
        {
          id: "assignment-alpha",
          taskId: "task-a",
          resourceId: "resource-alpha",
          role: "executor" as const,
          unitsPermille: 1000,
          workMinutes: 480,
          calendarId: null
        },
        {
          id: "assignment-beta",
          taskId: "task-a",
          resourceId: "resource-beta",
          role: "co_executor" as const,
          unitsPermille: 1000,
          workMinutes: 480,
          calendarId: null
        }
      ],
      reservations: [],
      calendarExceptions: [
        {
          id: "exception-alpha",
          calendarId: "calendar-default",
          resourceId: "resource-alpha",
          date: "2026-06-01",
          workingMinutes: 0,
          reason: "absence"
        }
      ]
    };
    const plan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const matrix = buildResourceLoadMatrix({
      plan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01",
      granularities: ["day"]
    });

    expect(plan.tasks[0]).toMatchObject({
      calculatedStart: "2026-06-01",
      calculatedFinish: "2026-06-01"
    });
    expect(matrix.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: "resource-alpha",
          capacityMinutes: 0,
          assignedMinutes: 480,
          calendarExceptionIds: ["exception-alpha"]
        }),
        expect.objectContaining({
          resourceId: "resource-beta",
          capacityMinutes: 480,
          assignedMinutes: 480,
          calendarExceptionIds: []
        })
      ])
    );
    expect(matrix.overloads).toEqual([
      expect.objectContaining({
        resourceId: "resource-alpha",
        overloadMinutes: 480
      })
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
    tasks: [
      {
        id: "task-a",
        parentTaskId: null,
        wbsCode: "1",
        title: "A",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_duration",
        effortDriven: false,
        plannedStart: "2026-06-01",
        plannedFinish: null,
        durationMinutes: 480,
        workMinutes: 960,
        percentComplete: 0,
        calendarId: "calendar-default",
        constraint: null
      }
    ],
    assignments: [
      {
        id: "assignment-a",
        taskId: "task-a",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 960,
        calendarId: null
      }
    ],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [
      {
        id: "resource-alpha",
        userId: "user-alpha",
        positionId: "engineer",
        teamId: "team-platform",
        name: "Alpha",
        calendarId: "calendar-default"
      }
    ],
    reservations: [
      {
        id: "reservation-a",
        resourceId: "resource-alpha",
        projectId: "project-beta",
        start: "2026-06-01",
        finish: "2026-06-01",
        workMinutes: 120,
        reason: "support"
      }
    ],
    constraints: [],
    capturedAt: "2026-05-21T00:00:00.000Z"
  };
}
