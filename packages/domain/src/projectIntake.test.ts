import { describe, expect, it } from "vitest";

import {
  assessOpportunityFeasibility,
  calculatePlannedHours,
  countWorkingDays
} from "./projectIntake";

describe("Phase 3 project intake domain", () => {
  it("calculates planned hours from contract value and planned hourly rate", () => {
    expect(calculatePlannedHours(1_200_000, 6_000)).toBe(200);
    expect(calculatePlannedHours(1_205_000, 6_000)).toBe(200);
  });

  it("counts weekdays inclusively between planned start and finish", () => {
    expect(
      countWorkingDays(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-07T00:00:00.000Z")
      )
    ).toBe(5);
  });

  it("checks demand by position against available hours and existing reservations", () => {
    const assessment = assessOpportunityFeasibility({
      opportunity: {
        id: "opportunity-alpha",
        plannedStart: new Date("2026-06-01T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-12T00:00:00.000Z"),
        contractValue: 960_000,
        plannedHourlyRate: 6_000
      },
      demand: [
        { positionId: "position-engineer", requiredHours: 120 },
        { positionId: "position-analyst", requiredHours: 80 }
      ],
      positions: [
        { id: "position-engineer", name: "Инженер", activeUsers: 2 },
        { id: "position-analyst", name: "Аналитик", activeUsers: 1 }
      ],
      activeProjectReservations: [
        {
          projectId: "project-existing",
          positionId: "position-engineer",
          requiredHours: 32,
          plannedStart: new Date("2026-06-03T00:00:00.000Z"),
          plannedFinish: new Date("2026-06-10T00:00:00.000Z")
        }
      ]
    });

    expect(assessment.plannedHours).toBe(160);
    expect(assessment.totalRequiredHours).toBe(200);
    expect(assessment.status).toBe("conflict");
    expect(assessment.blockers).toContain("demand_exceeds_planned_hours");
    expect(assessment.rows).toEqual([
      {
        positionId: "position-engineer",
        positionName: "Инженер",
        requiredHours: 120,
        availableHours: 128,
        reservedHours: 32,
        shortageHours: 0,
        status: "ok"
      },
      {
        positionId: "position-analyst",
        positionName: "Аналитик",
        requiredHours: 80,
        availableHours: 80,
        reservedHours: 0,
        shortageHours: 0,
        status: "ok"
      }
    ]);
  });

  it("reports missing position capacity as a blocker", () => {
    const assessment = assessOpportunityFeasibility({
      opportunity: {
        id: "opportunity-alpha",
        plannedStart: new Date("2026-06-01T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
        contractValue: 320_000,
        plannedHourlyRate: 4_000
      },
      demand: [{ positionId: "position-designer", requiredHours: 40 }],
      positions: [],
      activeProjectReservations: []
    });

    expect(assessment.status).toBe("conflict");
    expect(assessment.blockers).toContain("missing_position_capacity");
    expect(assessment.rows[0]).toMatchObject({
      positionId: "position-designer",
      availableHours: 0,
      shortageHours: 40,
      status: "conflict"
    });
  });
});
