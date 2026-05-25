import { describe, expect, it } from "vitest";

import { buildResourceLoadMatrix } from "../planning/resourcePlanning";
import { calculatePlan } from "../planning/schedulingEngine";
import type { KpiDefinition, PlanSnapshot } from "../index";
import {
  createControlSignalsFromEvaluations,
  evaluateProjectKpis,
  proposeManagementActions,
  validateKpiFormula
} from "./index";

const definitions: KpiDefinition[] = [
  {
    id: "kpi-deadline",
    tenantId: "tenant-a",
    entityType: "project",
    code: "deadline_delta",
    label: "Сдвиг срока",
    formula: { type: "builtin", key: "deadline_delta_days" },
    unit: "days",
    period: "snapshot",
    thresholdRules: [
      { severity: "warning", operator: "gt", value: 0 },
      { severity: "critical", operator: "gt", value: 2 }
    ],
    ownerRole: "project_manager",
    allowedActions: ["generate_planning_solution", "apply_planning_delta", "move_deadline"],
    version: 1,
    status: "active"
  },
  {
    id: "kpi-overload",
    tenantId: "tenant-a",
    entityType: "project",
    code: "resource_overload",
    label: "Перегруз ресурсов",
    formula: { type: "builtin", key: "resource_overload_minutes" },
    unit: "minutes",
    period: "snapshot",
    thresholdRules: [{ severity: "critical", operator: "gt", value: 0 }],
    ownerRole: "resource_manager",
    allowedActions: ["generate_planning_solution", "apply_planning_delta", "accept_risk"],
    version: 1,
    status: "active"
  }
];

describe("Phase 7 control engine", () => {
  it("evaluates planning KPI, creates signals and ranks deadline-first solver proposals", () => {
    const snapshot = createLateOverloadedSnapshot();
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-24T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: snapshot.project.plannedStart,
      rangeFinish: calculatedPlan.projectFinish ?? snapshot.project.plannedFinish,
      granularities: ["day"]
    });

    const evaluations = evaluateProjectKpis({
      definitions,
      snapshot,
      calculatedPlan,
      resourceLoad,
      evaluatedAt: "2026-05-24T00:00:00.000Z"
    });

    expect(evaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          definitionId: "kpi-deadline",
          calculatedValue: 3,
          severity: "critical"
        }),
        expect.objectContaining({
          definitionId: "kpi-overload",
          calculatedValue: 960,
          severity: "critical"
        })
      ])
    );

    const signals = createControlSignalsFromEvaluations({
      definitions,
      evaluations,
      snapshot,
      now: "2026-05-24T00:00:00.000Z"
    });
    const actions = proposeManagementActions({
      snapshot,
      calculatedPlan,
      resourceLoad,
      signals,
      calculatedAt: "2026-05-24T00:00:00.000Z"
    });

    expect(signals).toHaveLength(2);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]?.explainability.cost).toBeLessThanOrEqual(
      actions.at(-1)?.explainability.cost ?? Number.MAX_SAFE_INTEGER
    );
    expect(actions.some((action) => action.planDelta?.commands.length)).toBe(true);
  });

  it("accepts only constrained KPI formula AST nodes", () => {
    expect(
      validateKpiFormula({
        type: "expression",
        expression: {
          type: "binary",
          op: "div",
          left: { type: "metric", key: "resource_overload_minutes" },
          right: { type: "number", value: 60 }
        }
      })
    ).toBe(true);

    expect(
      validateKpiFormula({
        type: "expression",
        expression: {
          type: "call",
          callee: "eval",
          args: ["process.exit()"]
        }
      })
    ).toBe(false);
  });

  it("keeps KPI expression arithmetic finite after numeric overflow", () => {
    const snapshot = createLateOverloadedSnapshot();
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: "2026-05-24T00:00:00.000Z",
      engineVersion: "planning-core-v1"
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: snapshot.project.plannedStart,
      rangeFinish: calculatedPlan.projectFinish ?? snapshot.project.plannedFinish,
      granularities: ["day"]
    });
    const [evaluation] = evaluateProjectKpis({
      definitions: [
        {
          id: "kpi-overflow",
          tenantId: "tenant-a",
          entityType: "project",
          code: "overflow",
          label: "Overflow guard",
          formula: {
            type: "expression",
            expression: {
              type: "binary",
              op: "mul",
              left: { type: "number", value: 1e308 },
              right: { type: "number", value: 1e308 }
            }
          },
          unit: "count",
          period: "snapshot",
          thresholdRules: [{ severity: "critical", operator: "gt", value: 0 }],
          ownerRole: null,
          allowedActions: ["create_corrective_action"],
          version: 1,
          status: "active"
        }
      ],
      snapshot,
      calculatedPlan,
      resourceLoad,
      evaluatedAt: "2026-05-24T00:00:00.000Z"
    });

    expect(evaluation).toEqual(
      expect.objectContaining({
        calculatedValue: 0,
        severity: "ok"
      })
    );
  });
});

function createLateOverloadedSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-a",
    projectId: "project-a",
    planVersion: 7,
    project: {
      id: "project-a",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-05-24",
      plannedFinish: "2026-05-31",
      deadline: "2026-05-25",
      calendarId: "calendar-project"
    },
    tasks: [
      {
        id: "task-1",
        parentTaskId: null,
        wbsCode: "1",
        title: "Critical task",
        statusId: "task-status-new",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-05-24",
        plannedFinish: "2026-05-28",
        durationMinutes: 960,
        workMinutes: 1440,
        percentComplete: 0,
        calendarId: "calendar-project",
        constraint: null
      },
      {
        id: "task-2",
        parentTaskId: null,
        wbsCode: "2",
        title: "Follower",
        statusId: "task-status-new",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-05-28",
        plannedFinish: "2026-05-28",
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 0,
        calendarId: "calendar-project",
        constraint: null
      }
    ],
    assignments: [
      {
        id: "assign-1",
        taskId: "task-1",
        resourceId: "resource-a",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 1440,
        calendarId: null
      }
    ],
    dependencies: [
      {
        id: "dep-1",
        predecessorTaskId: "task-1",
        successorTaskId: "task-2",
        type: "FS",
        lagMinutes: 0
      }
    ],
    baselines: [],
    calendars: [
      {
        id: "calendar-project",
        workingWeekdays: [0, 1, 2, 3, 4, 5, 6],
        workingMinutesPerDay: 480
      }
    ],
    calendarExceptions: [],
    resources: [
      {
        id: "resource-a",
        userId: "resource-a",
        positionId: "position-dev",
        teamId: null,
        name: "Анна",
        calendarId: "calendar-project"
      },
      {
        id: "resource-b",
        userId: "resource-b",
        positionId: "position-dev",
        teamId: null,
        name: "Игорь",
        calendarId: "calendar-project"
      }
    ],
    reservations: [
      {
        id: "reservation-1",
        resourceId: "resource-a",
        projectId: "project-a",
        start: "2026-05-24",
        finish: "2026-05-24",
        workMinutes: 960,
        reason: "Production incident"
      }
    ],
    constraints: [],
    capturedAt: "2026-05-24T00:00:00.000Z"
  };
}
