import { describe, expect, it } from "vitest";

import { proposeAutoPlanningSolutions } from "./autoSolver";
import type { PlanSnapshot, PlanTask } from "./types";

describe("auto planning solver", () => {
  it("returns a no-overlap allocation proposal before accepted-overload fallbacks", () => {
    const result = proposeAutoPlanningSolutions({
      snapshot: createSnapshot(),
      mode: "schedule",
      targetDeadline: "2026-06-02"
    });

    expect(result.proposals[0]).toMatchObject({
      kind: "no_overlap",
      explainability: {
        overloadMinutes: 0,
        deadlineDeltaDays: 0
      }
    });
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        {
          type: "assignment.allocations.replace",
          payload: {
            assignmentId: "assignment-a",
            allocations: [{ date: "2026-06-01", workMinutes: 480 }]
          }
        },
        {
          type: "assignment.allocations.replace",
          payload: {
            assignmentId: "assignment-b",
            allocations: [{ date: "2026-06-02", workMinutes: 480 }]
          }
        }
      ])
    );
  });

  it("splits work to another resource when the original employee cannot fit the deadline", () => {
    const result = proposeAutoPlanningSolutions({
      snapshot: createSnapshot({
        tasks: [
          { ...createTask("task-a", "1", "2026-06-01"), workMinutes: 960, durationMinutes: 960 }
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
        resources: [
          {
            id: "resource-alpha",
            userId: "user-alpha",
            positionId: "engineer",
            teamId: null,
            name: "Alpha",
            calendarId: null
          },
          {
            id: "resource-beta",
            userId: "user-beta",
            positionId: "engineer",
            teamId: null,
            name: "Beta",
            calendarId: null
          }
        ]
      }),
      mode: "schedule",
      targetDeadline: "2026-06-01"
    });

    expect(result.proposals[0]).toMatchObject({
      kind: "no_overlap",
      explainability: { overloadMinutes: 0 }
    });
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "assignment.upsert",
          payload: expect.objectContaining({
            id: "assignment-a__solver__resource-beta",
            taskId: "task-a",
            resourceId: "resource-beta",
            workMinutes: 480
          })
        }),
        {
          type: "assignment.allocations.replace",
          payload: {
            assignmentId: "assignment-a__solver__resource-beta",
            allocations: [{ date: "2026-06-01", workMinutes: 480 }]
          }
        }
      ])
    );
  });

  it("returns an explainable accepted-overload proposal when the deadline is impossible", () => {
    const result = proposeAutoPlanningSolutions({
      snapshot: createSnapshot({
        tasks: [
          { ...createTask("task-a", "1", "2026-06-01"), workMinutes: 960, durationMinutes: 960 }
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
        ]
      }),
      mode: "repair",
      targetDeadline: "2026-06-01"
    });

    expect(result.proposals[0]).toMatchObject({
      kind: "accepted_overload",
      explainability: {
        overloadMinutes: 480,
        overloadedResourceIds: ["resource-alpha"],
        requiredApprovals: ["tenant.project_plan.manage"]
      }
    });
    expect(result.proposals[0]?.planDelta.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "risk.accept_overload" })
      ])
    );
  });
});

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
      {
        id: "resource-alpha",
        userId: "user-alpha",
        positionId: "engineer",
        teamId: null,
        name: "Alpha",
        calendarId: null
      }
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
