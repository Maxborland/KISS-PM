import { describe, expect, it } from "vitest";

import type { DemandEstimate } from "./index";
import {
  ResourcePlanningModelError,
  assessCapacityFeasibility,
  createResourceReservation,
  createRoleCapacityBucket
} from "./index";

const tenantId = "tenant-a";
const opportunityId = "opportunity-acme-portal";
const expectedWindow = {
  startDate: "2026-06-01",
  endDate: "2026-06-30"
};

function createDemandEstimate(): DemandEstimate {
  return {
    tenantId,
    opportunityId,
    template: {
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      version: 2
    },
    scenario: {
      key: "baseline",
      label: "Базовый сценарий"
    },
    formula: {
      key: "phase3.template_scope_linear",
      version: 1,
      label: "Базовая оценка по шаблону и признакам объема"
    },
    stageRoleDemands: [
      {
        stageKey: "initiation",
        stageLabel: "Инициация",
        roleKey: "project_manager",
        roleLabel: "Руководитель проекта",
        plannedWorkHours: 64,
        confidence: 0.86,
        formulaRef: "phase3.template_scope_linear@1",
        sourceAssumptions: []
      },
      {
        stageKey: "delivery",
        stageLabel: "Поставка",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        plannedWorkHours: 140,
        confidence: 0.82,
        formulaRef: "phase3.template_scope_linear@1",
        sourceAssumptions: []
      }
    ],
    totalPlannedWorkHours: 204,
    confidence: 0.82,
    assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }],
    trace: ["demand_estimate:template:implementation.integration_heavy@2"]
  };
}

describe("capacity feasibility draft", () => {
  it("marks opportunity demand as fit when seeded role capacity covers the expected window", () => {
    const result = assessCapacityFeasibility({
      tenantId,
      opportunityId,
      expectedWindow,
      demandEstimate: createDemandEstimate(),
      capacityBuckets: [
        createRoleCapacityBucket({
          id: "capacity-pm-june",
          tenantId,
          roleKey: "project_manager",
          roleLabel: "Руководитель проекта",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          capacityHours: 120,
          committedHours: 20,
          sourceLabel: "Seed Tenant A / June"
        }),
        createRoleCapacityBucket({
          id: "capacity-arch-june",
          tenantId,
          roleKey: "solution_architect",
          roleLabel: "Архитектор решения",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          capacityHours: 180,
          committedHours: 30,
          sourceLabel: "Seed Tenant A / June"
        })
      ],
      reservations: []
    });

    expect(result).toEqual({
      tenantId,
      opportunityId,
      expectedWindow,
      status: "fit",
      severity: "none",
      roleResults: [
        {
          roleKey: "project_manager",
          roleLabel: "Руководитель проекта",
          demandedHours: 64,
          capacityHours: 120,
          committedHours: 20,
          conflictingReservedHours: 0,
          availableHours: 100,
          gapHours: 0,
          severity: "none",
          conflictingReservationIds: []
        },
        {
          roleKey: "solution_architect",
          roleLabel: "Архитектор решения",
          demandedHours: 140,
          capacityHours: 180,
          committedHours: 30,
          conflictingReservedHours: 0,
          availableHours: 150,
          gapHours: 0,
          severity: "none",
          conflictingReservationIds: []
        }
      ],
      blockers: [],
      conflictingReservations: [],
      assumptions: [
        { code: "integration_delivery", message: "Учтены интеграционные работы." },
        {
          code: "seeded_capacity_window",
          message: "Проверка использует seeded capacity buckets for 2026-06-01..2026-06-30."
        }
      ],
      trace: [
        "capacity_feasibility:window:2026-06-01..2026-06-30",
        "capacity_feasibility:demand_roles:2",
        "capacity_feasibility:capacity_buckets:2",
        "capacity_feasibility:conflicting_reservations:0",
        "capacity_feasibility:status:fit"
      ]
    });
  });

  it("reports overload gaps and seeded conflicting reservations deterministically", () => {
    const result = assessCapacityFeasibility({
      tenantId,
      opportunityId,
      expectedWindow,
      demandEstimate: createDemandEstimate(),
      capacityBuckets: [
        createRoleCapacityBucket({
          id: "capacity-pm-june",
          tenantId,
          roleKey: "project_manager",
          roleLabel: "Руководитель проекта",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          capacityHours: 60,
          committedHours: 10,
          sourceLabel: "Seed Tenant A / constrained PM"
        }),
        createRoleCapacityBucket({
          id: "capacity-arch-june",
          tenantId,
          roleKey: "solution_architect",
          roleLabel: "Архитектор решения",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          capacityHours: 120,
          committedHours: 0,
          sourceLabel: "Seed Tenant A / constrained architecture"
        })
      ],
      reservations: [
        createResourceReservation({
          id: "reservation-other-opportunity-pm",
          tenantId,
          sourceType: "opportunity",
          sourceId: "opportunity-other",
          roleKey: "project_manager",
          roleLabel: "Руководитель проекта",
          periodStart: "2026-06-10",
          periodEnd: "2026-06-20",
          reservedHours: 20,
          status: "active",
          sourceLabel: "Другая возможность"
        })
      ]
    });

    expect(result.status).toBe("overloaded");
    expect(result.severity).toBe("critical");
    expect(result.roleResults).toEqual([
      {
        roleKey: "project_manager",
        roleLabel: "Руководитель проекта",
        demandedHours: 64,
        capacityHours: 60,
        committedHours: 10,
        conflictingReservedHours: 20,
        availableHours: 30,
        gapHours: 34,
        severity: "critical",
        conflictingReservationIds: ["reservation-other-opportunity-pm"]
      },
      {
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        demandedHours: 140,
        capacityHours: 120,
        committedHours: 0,
        conflictingReservedHours: 0,
        availableHours: 120,
        gapHours: 20,
        severity: "critical",
        conflictingReservationIds: []
      }
    ]);
    expect(result.blockers).toEqual([
      {
        code: "role_capacity_gap",
        severity: "critical",
        roleKey: "project_manager",
        message: "Недостаточно емкости роли: Руководитель проекта, дефицит 34 ч.",
        gapHours: 34,
        conflictingReservationIds: ["reservation-other-opportunity-pm"]
      },
      {
        code: "role_capacity_gap",
        severity: "critical",
        roleKey: "solution_architect",
        message: "Недостаточно емкости роли: Архитектор решения, дефицит 20 ч.",
        gapHours: 20,
        conflictingReservationIds: []
      }
    ]);
    expect(result.conflictingReservations).toEqual([
      {
        id: "reservation-other-opportunity-pm",
        sourceType: "opportunity",
        sourceId: "opportunity-other",
        roleKey: "project_manager",
        roleLabel: "Руководитель проекта",
        periodStart: "2026-06-10",
        periodEnd: "2026-06-20",
        reservedHours: 20,
        sourceLabel: "Другая возможность"
      }
    ]);
  });

  it("rejects partial-window capacity buckets and reservations instead of counting full-period hours", () => {
    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [
          createRoleCapacityBucket({
            id: "capacity-partial-arch",
            tenantId,
            roleKey: "solution_architect",
            roleLabel: "Архитектор решения",
            periodStart: "2026-06-30",
            periodEnd: "2026-07-31",
            capacityHours: 180,
            committedHours: 0,
            sourceLabel: "Partial period"
          })
        ],
        reservations: []
      })
    ).toThrow("Capacity bucket period must be inside expected window");

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [],
        reservations: [
          createResourceReservation({
            id: "reservation-partial-arch",
            tenantId,
            sourceType: "opportunity",
            sourceId: "opportunity-other",
            roleKey: "solution_architect",
            roleLabel: "Архитектор решения",
            periodStart: "2026-05-15",
            periodEnd: "2026-06-15",
            reservedHours: 30,
            status: "active",
            sourceLabel: "Partial reservation"
          })
        ]
      })
    ).toThrow("Reservation period must be inside expected window");
  });

  it("rejects duplicate capacity bucket and reservation ids before feasibility math", () => {
    const duplicateBucket = createRoleCapacityBucket({
      id: "capacity-duplicate",
      tenantId,
      roleKey: "solution_architect",
      roleLabel: "Архитектор решения",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      capacityHours: 100,
      committedHours: 0,
      sourceLabel: "Duplicate capacity"
    });

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [duplicateBucket, duplicateBucket],
        reservations: []
      })
    ).toThrow("Duplicate capacity bucket id: capacity-duplicate");

    const duplicateReservation = createResourceReservation({
      id: "reservation-duplicate",
      tenantId,
      sourceType: "opportunity",
      sourceId: "opportunity-other",
      roleKey: "project_manager",
      roleLabel: "Руководитель проекта",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      reservedHours: 20,
      status: "active",
      sourceLabel: "Duplicate reservation"
    });

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [],
        reservations: [duplicateReservation, duplicateReservation]
      })
    ).toThrow("Duplicate reservation id: reservation-duplicate");
  });

  it("rejects demand estimates whose total does not match stage-role demand rows", () => {
    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: {
          ...createDemandEstimate(),
          totalPlannedWorkHours: 1_000
        },
        capacityBuckets: [
          createRoleCapacityBucket({
            id: "capacity-pm-june",
            tenantId,
            roleKey: "project_manager",
            roleLabel: "Руководитель проекта",
            periodStart: "2026-06-01",
            periodEnd: "2026-06-30",
            capacityHours: 2_000,
            committedHours: 0,
            sourceLabel: "Seed Tenant A / PM"
          }),
          createRoleCapacityBucket({
            id: "capacity-arch-june",
            tenantId,
            roleKey: "solution_architect",
            roleLabel: "Архитектор решения",
            periodStart: "2026-06-01",
            periodEnd: "2026-06-30",
            capacityHours: 2_000,
            committedHours: 0,
            sourceLabel: "Seed Tenant A / architecture"
          })
        ],
        reservations: []
      })
    ).toThrow("Demand estimate total must match stage-role demand sum");
  });

  it("rejects cross-tenant demand, capacity, and reservations with typed errors", () => {
    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: { ...createDemandEstimate(), tenantId: "tenant-b" },
        capacityBuckets: [],
        reservations: []
      })
    ).toThrow("Demand estimate tenant mismatch");

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [
          createRoleCapacityBucket({
            id: "capacity-foreign",
            tenantId: "tenant-b",
            roleKey: "project_manager",
            roleLabel: "Руководитель проекта",
            periodStart: "2026-06-01",
            periodEnd: "2026-06-30",
            capacityHours: 120,
            committedHours: 0,
            sourceLabel: "Foreign tenant"
          })
        ],
        reservations: []
      })
    ).toThrow("Capacity bucket tenant mismatch");

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [
          createRoleCapacityBucket({
            id: "capacity-foreign-outside-window",
            tenantId: "tenant-b",
            roleKey: "project_manager",
            roleLabel: "Руководитель проекта",
            periodStart: "2026-07-01",
            periodEnd: "2026-07-31",
            capacityHours: 120,
            committedHours: 0,
            sourceLabel: "Foreign tenant outside window"
          })
        ],
        reservations: []
      })
    ).toThrow("Capacity bucket tenant mismatch");

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [],
        reservations: [
          createResourceReservation({
            id: "reservation-foreign-outside-window",
            tenantId: "tenant-b",
            sourceType: "opportunity",
            sourceId: "opportunity-other",
            roleKey: "project_manager",
            roleLabel: "Руководитель проекта",
            periodStart: "2026-07-01",
            periodEnd: "2026-07-31",
            reservedHours: 20,
            status: "released",
            sourceLabel: "Foreign tenant outside window"
          })
        ]
      })
    ).toThrow("Reservation tenant mismatch");

    const duplicateForeignBucket = createRoleCapacityBucket({
      id: "capacity-foreign-duplicate",
      tenantId: "tenant-b",
      roleKey: "project_manager",
      roleLabel: "Руководитель проекта",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      capacityHours: 120,
      committedHours: 0,
      sourceLabel: "Foreign tenant duplicate"
    });

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [duplicateForeignBucket, duplicateForeignBucket],
        reservations: []
      })
    ).toThrow("Capacity bucket tenant mismatch");

    const duplicateForeignReservation = createResourceReservation({
      id: "reservation-foreign-duplicate",
      tenantId: "tenant-b",
      sourceType: "opportunity",
      sourceId: "opportunity-other",
      roleKey: "project_manager",
      roleLabel: "Руководитель проекта",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      reservedHours: 20,
      status: "active",
      sourceLabel: "Foreign tenant duplicate"
    });

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [],
        reservations: [duplicateForeignReservation, duplicateForeignReservation]
      })
    ).toThrow("Reservation tenant mismatch");

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [
          {
            id: "capacity-foreign-invalid-date",
            tenantId: "tenant-b",
            roleKey: "project_manager",
            roleLabel: "Руководитель проекта",
            periodStart: "2026-02-31",
            periodEnd: "2026-06-30",
            capacityHours: 120,
            committedHours: 0,
            sourceLabel: "Foreign invalid date"
          }
        ],
        reservations: []
      })
    ).toThrow("Capacity bucket tenant mismatch");

    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow,
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [],
        reservations: [
          {
            id: "reservation-foreign-invalid-date",
            tenantId: "tenant-b",
            sourceType: "opportunity",
            sourceId: "opportunity-other",
            roleKey: "project_manager",
            roleLabel: "Руководитель проекта",
            periodStart: "2026-02-31",
            periodEnd: "2026-06-30",
            reservedHours: 20,
            status: "active",
            sourceLabel: "Foreign invalid date"
          }
        ]
      })
    ).toThrow("Reservation tenant mismatch");

    try {
      assessCapacityFeasibility(null as never);
    } catch (error) {
      expect(error).toBeInstanceOf(ResourcePlanningModelError);
      expect((error as ResourcePlanningModelError).code).toBe("validation_error");
    }
  });

  it("rejects impossible calendar dates instead of accepting normalized JavaScript dates", () => {
    expect(() =>
      assessCapacityFeasibility({
        tenantId,
        opportunityId,
        expectedWindow: {
          startDate: "2026-02-31",
          endDate: "2026-03-10"
        },
        demandEstimate: createDemandEstimate(),
        capacityBuckets: [],
        reservations: []
      })
    ).toThrow("capacityFeasibility.expectedWindow.startDate must be a valid calendar date");
  });
});
