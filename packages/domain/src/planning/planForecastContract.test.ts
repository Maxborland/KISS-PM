import { describe, expect, it } from "vitest";

import {
  classifyPlanForecastHealth,
  createManagerForecastSummary,
  createPlanForecast,
  DISALLOWED_MANAGER_FORECAST_TERMS,
  type PlanForecastHealth
} from "./planForecast";
import type { CalculatedPlan, PlanSnapshot } from "./types";

describe("plan forecast contract coverage", () => {
  it("classifies watch when only informational risk drivers exist", () => {
    const input = createForecastInput({ historicalDelayTaskIds: ["task-a"] });

    expect(classifyPlanForecastHealth(input)).toBe("watch");

    const forecast = createPlanForecast(input);
    expect(forecast.health).toBe("watch");
    expect(forecast.riskDrivers).toEqual([
      expect.objectContaining({
        code: "historical_delay_pattern",
        severity: "info",
        taskIds: ["task-a"]
      })
    ]);
  });

  it("returns manager summaries for every health without forbidden terms", () => {
    const healthValues: PlanForecastHealth[] = [
      "stable",
      "watch",
      "needs_decision",
      "unstable",
      "blocked"
    ];

    for (const health of healthValues) {
      const summary = createManagerForecastSummary(health);

      expect(summary.length).toBeGreaterThan(20);
      expect(summary).not.toMatch(/\bP(50|75|80|95)\b/i);
      for (const term of DISALLOWED_MANAGER_FORECAST_TERMS) {
        expect(summary.toLowerCase()).not.toContain(term.toLowerCase());
      }
    }
  });

  it("returns complete engine metadata for persisted forecast runs", () => {
    const input = createForecastInput({
      autoSolverRun: { proposals: [{ id: "proposal-a" }] }
    });

    expect(createPlanForecast(input)).toMatchObject({
      health: "stable",
      engineMetadata: {
        source: "deterministic_planning_engine",
        tenantId: "tenant-alpha",
        projectId: "project-alpha",
        planVersion: 7,
        engineVersion: "planning-core-v1",
        calculatedAt: "2026-06-21T12:00:00.000Z",
        projectFinish: "2026-06-10",
        deadline: "2026-06-15",
        deadlineDeltaDays: -5,
        solverProposalCount: 1
      }
    });
  });
});

function createForecastInput(
  overrides: Partial<Parameters<typeof createPlanForecast>[0]> = {}
): Parameters<typeof createPlanForecast>[0] {
  const snapshot: PlanSnapshot = {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 7,
    project: {
      id: "project-alpha",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-15",
      deadline: "2026-06-15",
      calendarId: null
    },
    tasks: [
      {
        id: "task-a",
        parentTaskId: null,
        wbsCode: "1",
        title: "Task A",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-10",
        plannedStartInstant: null,
        plannedFinishInstant: null,
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 0,
        calendarId: null,
        constraint: null
      }
    ],
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-06-21T12:00:00.000Z"
  };

  const calculatedPlan: CalculatedPlan = {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 7,
    projectFinish: "2026-06-10",
    calculatedAt: "2026-06-21T12:00:00.000Z",
    engineVersion: "planning-core-v1",
    tasks: [],
    dependencies: [],
    criticalPath: { taskIds: [] },
    criticalPathTaskIds: [],
    scheduleTrace: [],
    validationIssues: []
  };

  return {
    snapshot,
    calculatedPlan,
    ...overrides
  };
}
