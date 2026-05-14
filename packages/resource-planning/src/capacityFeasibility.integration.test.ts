import { describe, expect, it } from "vitest";

import {
  assessCapacityFeasibility,
  createDemandTemplateProfile,
  createResourceReservation,
  createRoleCapacityBucket,
  estimateDemandFromTemplateMatch
} from "./index";

const tenantId = "tenant-a";
const opportunityId = "opportunity-acme-portal";

describe("demand to capacity feasibility integration", () => {
  it("runs a deterministic feasibility analysis from matched template demand to seeded capacity", () => {
    const demandEstimate = estimateDemandFromTemplateMatch({
      tenantId,
      opportunityId,
      templateMatch: {
        tenantId,
        opportunityId,
        matched: true,
        template: {
          id: "process-template-integrations",
          key: "implementation.integration_heavy",
          label: "Внедрение с интеграциями",
          version: 2
        },
        confidence: 0.9,
        assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }]
      },
      scopeHints: [
        {
          tenantId,
          opportunityId,
          key: "integrations_count",
          label: "Количество интеграций",
          value: 3
        },
        {
          tenantId,
          opportunityId,
          key: "modules_count",
          label: "Количество модулей",
          value: 5
        }
      ],
      demandProfile: createDemandTemplateProfile({
        id: "demand-profile-implementation-integrations",
        tenantId,
        templateKey: "implementation.integration_heavy",
        templateVersion: 2,
        scenarioKey: "baseline",
        scenarioLabel: "Базовый сценарий",
        formula: {
          key: "phase3.template_scope_linear",
          version: 1,
          label: "Базовая оценка по шаблону и признакам объема"
        },
        roleRules: [
          {
            stageKey: "delivery",
            stageLabel: "Поставка",
            roleKey: "solution_architect",
            roleLabel: "Архитектор решения",
            baseWorkHours: 80,
            scopeHintDrivers: [{ scopeHintKey: "modules_count", hoursPerUnit: 12 }],
            confidence: 0.82,
            sortOrder: 20,
            assumptions: []
          },
          {
            stageKey: "initiation",
            stageLabel: "Инициация",
            roleKey: "project_manager",
            roleLabel: "Руководитель проекта",
            baseWorkHours: 40,
            scopeHintDrivers: [{ scopeHintKey: "integrations_count", hoursPerUnit: 8 }],
            confidence: 0.86,
            sortOrder: 10,
            assumptions: []
          }
        ],
        updatedAt: "2026-05-14T20:10:00+07:00"
      })
    });

    const feasibility = assessCapacityFeasibility({
      tenantId,
      opportunityId,
      expectedWindow: {
        startDate: "2026-06-01",
        endDate: "2026-06-30"
      },
      demandEstimate,
      capacityBuckets: [
        createRoleCapacityBucket({
          id: "capacity-pm-june",
          tenantId,
          roleKey: "project_manager",
          roleLabel: "Руководитель проекта",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          capacityHours: 80,
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
          capacityHours: 180,
          committedHours: 0,
          sourceLabel: "Seed Tenant A / architecture"
        })
      ],
      reservations: [
        createResourceReservation({
          id: "reservation-other-architecture",
          tenantId,
          sourceType: "opportunity",
          sourceId: "opportunity-other",
          roleKey: "solution_architect",
          roleLabel: "Архитектор решения",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
          reservedHours: 30,
          status: "active",
          sourceLabel: "Другая возможность"
        })
      ]
    });

    expect(demandEstimate.totalPlannedWorkHours).toBe(204);
    expect(feasibility.status).toBe("fit");
    expect(feasibility.severity).toBe("warning");
    expect(feasibility.roleResults.map((roleResult) => [roleResult.roleKey, roleResult.gapHours])).toEqual([
      ["project_manager", 0],
      ["solution_architect", 0]
    ]);
    expect(feasibility.blockers).toEqual([
      {
        code: "conflicting_reservation",
        severity: "warning",
        roleKey: "solution_architect",
        message: "Есть пересекающиеся резервы роли: Архитектор решения.",
        gapHours: 0,
        conflictingReservationIds: ["reservation-other-architecture"]
      }
    ]);
    expect(feasibility.trace).toContain("capacity_feasibility:status:fit");
  });
});
