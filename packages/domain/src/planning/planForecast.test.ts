import { describe, expect, it } from "vitest";

import { proposeAutoPlanningSolutions } from "./autoSolver";
import {
  classifyPlanForecastHealth,
  createManagerForecastSummary,
  createPlanForecast,
  DISALLOWED_MANAGER_FORECAST_TERMS,
  extractPlanForecastRiskDrivers
} from "./planForecast";
import { buildResourceLoadMatrix } from "./resourcePlanning";
import { calculatePlan } from "./schedulingEngine";
import type { PlanSnapshot, PlanTask } from "./types";

describe("plan forecast", () => {
  it("creates manager-facing output without statistical forecasting terms or solver mutations", () => {
    const snapshot = createSnapshot({
      project: {
        ...createSnapshot().project,
        deadline: "2026-05-31"
      }
    });
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      assignmentAllocations: snapshot.assignmentAllocations,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-03",
      granularities: ["day"]
    });
    const autoSolverRun = proposeAutoPlanningSolutions({
      snapshot,
      mode: "repair",
      targetDeadline: "2026-05-31",
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const forecast = createPlanForecast({ snapshot, calculatedPlan, resourceLoad, autoSolverRun });
    const serialized = JSON.stringify(forecast).toLowerCase();

    expect(forecast.health).toBe("needs_decision");
    expect(forecast.riskDrivers.map((driver) => driver.code)).toEqual(
      expect.arrayContaining(["deadline_too_tight", "resource_overloaded"])
    );
    expect(forecast.recommendations[0]?.code).toBe("use_auto_solver");
    expect(serialized).not.toContain("assignment.upsert");
    for (const term of DISALLOWED_MANAGER_FORECAST_TERMS) {
      expect(serialized).not.toContain(term.toLowerCase());
    }
  });

  it("classifies a clear plan as stable and recommends keeping the plan", () => {
    const snapshot = createSnapshot({
      tasks: [createTask("task-a", "1", "2026-06-01")],
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
      ]
    });
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      assignmentAllocations: snapshot.assignmentAllocations,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: "2026-06-01",
      rangeFinish: "2026-06-01",
      granularities: ["day"]
    });

    expect(classifyPlanForecastHealth({ snapshot, calculatedPlan, resourceLoad })).toBe("stable");
    expect(createPlanForecast({ snapshot, calculatedPlan, resourceLoad })).toMatchObject({
      health: "stable",
      managerSummary: createManagerForecastSummary("stable"),
      riskDrivers: [],
      recommendations: [{
        code: "keep_plan"
      }]
    });
  });

  it("prioritizes blocked tasks over other risks without scoring people", () => {
    const snapshot = createSnapshot({
      tasks: [
        {
          ...createTask("task-a", "1", "2026-06-01"),
          statusId: "blocked"
        }
      ],
      assignments: []
    });
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    const forecast = createPlanForecast({ snapshot, calculatedPlan });

    expect(forecast.health).toBe("blocked");
    expect(forecast.recommendations[0]?.code).toBe("resolve_blocker");
    expect(forecast.riskDrivers).toEqual([
      expect.objectContaining({
        code: "blocked_task",
        taskIds: ["task-a"]
      })
    ]);
    expect(JSON.stringify(forecast).toLowerCase()).not.toContain("person score");
  });

  it("reports unstable plans when validation errors have no safe solver proposal", () => {
    const snapshot = createSnapshot({
      dependencies: [
        {
          id: "dependency-a",
          predecessorTaskId: "task-a",
          successorTaskId: "task-b",
          type: "FS",
          lagMinutes: 0
        },
        {
          id: "dependency-b",
          predecessorTaskId: "task-b",
          successorTaskId: "task-a",
          type: "FS",
          lagMinutes: 0
        }
      ]
    });
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-21T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });

    expect(extractPlanForecastRiskDrivers({ snapshot, calculatedPlan, autoSolverRun: { proposals: [] } })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "dependency_chain_fragile" }),
        expect.objectContaining({ code: "solver_has_no_safe_proposal" })
      ])
    );
    expect(classifyPlanForecastHealth({ snapshot, calculatedPlan, autoSolverRun: { proposals: [] } })).toBe(
      "unstable"
    );
    expect(createPlanForecast({ snapshot, calculatedPlan, autoSolverRun: { proposals: [] } }).recommendations[0]?.code).toBe(
      "reduce_scope"
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
    calendars: [
      {
        id: "calendar-default",
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480
      }
    ],
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
    plannedStartInstant: null,
    plannedFinishInstant: null,
    durationMinutes: 480,
    workMinutes: 480,
    percentComplete: 0,
    calendarId: "calendar-default",
    constraint: null
  };
}
