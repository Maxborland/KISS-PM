import { describe, expect, it } from "vitest";

import {
  ResourcePlanningModelError,
  calculateResourceLoadBuckets,
  createAvailabilityException,
  createResourceAssignment,
  createResourceCapacityCalendar,
  createResourceProfile,
  createResourceReservation,
  deriveCapacityPeriodBuckets,
  detectResourceOverloads
} from "./index";

const tenantId = "tenant-a";
const resourceProfileId = "resource-architect-a";

function createArchitectProfile() {
  return createResourceProfile({
    id: resourceProfileId,
    tenantId,
    type: "person",
    label: "Анна Архитектор",
    userId: "executor-architect-a",
    roleKeys: ["solution_architect"],
    skillTags: ["architecture"],
    calendarId: "calendar-architect-a",
    active: true
  });
}

function createArchitectCalendar() {
  return createResourceCapacityCalendar({
    id: "calendar-architect-a",
    tenantId,
    resourceProfileId,
    timezone: "UTC",
    workingDays: [1, 2, 3, 4, 5],
    defaultDailyCapacityHours: 8,
    effectiveFrom: "2026-06-01",
    effectiveTo: "2026-06-30"
  });
}

describe("Phase 6 resource operational planning", () => {
  it("creates tenant-scoped resource profiles, capacity calendars, and exceptions that cannot make capacity negative", () => {
    const profile = createArchitectProfile();
    const calendar = createArchitectCalendar();
    const absence = createAvailabilityException({
      id: "absence-architect-2026-06-03",
      tenantId,
      resourceProfileId,
      type: "absence",
      periodStart: "2026-06-03",
      periodEnd: "2026-06-03",
      capacityHoursPerDay: 0,
      sourceType: "manual",
      sourceId: "absence-request-1",
      sourceLabel: "Отпуск"
    });
    const reducedCapacity = createAvailabilityException({
      id: "reduced-architect-2026-06-04",
      tenantId,
      resourceProfileId,
      type: "reduced_capacity",
      periodStart: "2026-06-04",
      periodEnd: "2026-06-04",
      capacityHoursPerDay: 4,
      sourceType: "manual",
      sourceId: "reduced-capacity-1",
      sourceLabel: "Обучение"
    });

    const buckets = deriveCapacityPeriodBuckets({
      tenantId,
      resourceProfiles: [profile],
      calendars: [calendar],
      availabilityExceptions: [absence, reducedCapacity],
      periodStart: "2026-06-01",
      periodEnd: "2026-06-05",
      granularity: "day"
    });

    expect(buckets.map((bucket) => [bucket.periodStart, bucket.capacityHours, bucket.sourceRefs])).toEqual([
      ["2026-06-01", 8, ["calendar:calendar-architect-a"]],
      ["2026-06-02", 8, ["calendar:calendar-architect-a"]],
      ["2026-06-03", 0, ["calendar:calendar-architect-a", "availability_exception:absence-architect-2026-06-03"]],
      ["2026-06-04", 4, ["calendar:calendar-architect-a", "availability_exception:reduced-architect-2026-06-04"]],
      ["2026-06-05", 8, ["calendar:calendar-architect-a"]]
    ]);

    expect(() =>
      createAvailabilityException({
        id: "bad-absence-exception",
        tenantId,
        resourceProfileId,
        type: "absence",
        periodStart: "2026-06-05",
        periodEnd: "2026-06-05",
        capacityHoursPerDay: 2,
        sourceType: "manual",
        sourceId: "bad",
        sourceLabel: "Bad"
      })
    ).toThrow("availabilityException.absence capacity must be 0");
  });

  it("calculates assignment and reservation load buckets from canonical task schedule data without duplicate resource tasks", () => {
    const profile = createArchitectProfile();
    const capacityBuckets = deriveCapacityPeriodBuckets({
      tenantId,
      resourceProfiles: [profile],
      calendars: [createArchitectCalendar()],
      availabilityExceptions: [],
      periodStart: "2026-06-01",
      periodEnd: "2026-06-05",
      granularity: "week"
    });
    const assignment = createResourceAssignment({
      id: "assignment-task-design-architect",
      tenantId,
      projectId: "project-alpha",
      taskId: "task-design",
      sourceParticipantId: "participant-task-design-architect",
      resourceProfileId,
      roleKey: "solution_architect",
      roleLabel: "Архитектор решения",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-05",
      plannedWorkHours: 30,
      sourceLabel: "Task: concept design"
    });
    const reservation = createResourceReservation({
      id: "reservation-project-draft-architect",
      tenantId,
      sourceType: "project",
      sourceId: "project-draft-alpha",
      resourceProfileId,
      roleKey: "solution_architect",
      roleLabel: "Архитектор решения",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-05",
      reservedHours: 6,
      status: "active",
      sourceLabel: "Черновик проекта"
    });

    const loadBuckets = calculateResourceLoadBuckets({
      tenantId,
      resourceProfiles: [profile],
      capacityBuckets,
      assignments: [assignment],
      reservations: [reservation]
    });

    expect(loadBuckets).toEqual([
      {
        id: "load:resource-architect-a:2026-06-01:2026-06-05",
        tenantId,
        resourceProfileId,
        roleKeys: ["solution_architect"],
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        capacityHours: 40,
        assignedHours: 30,
        reservedHours: 6,
        totalLoadHours: 36,
        loadPercent: 90,
        severity: "warning",
        sourceRefs: [
          "assignment:assignment-task-design-architect",
          "reservation:reservation-project-draft-architect"
        ],
        affectedTaskIds: ["task-design"],
        affectedProjectIds: ["project-alpha", "project-draft-alpha"]
      }
    ]);
  });

  it("detects deterministic overload severity with traceable sources and tenant isolation", () => {
    const profile = createArchitectProfile();
    const capacityBuckets = deriveCapacityPeriodBuckets({
      tenantId,
      resourceProfiles: [profile],
      calendars: [createArchitectCalendar()],
      availabilityExceptions: [],
      periodStart: "2026-06-01",
      periodEnd: "2026-06-05",
      granularity: "week"
    });
    const loadBuckets = calculateResourceLoadBuckets({
      tenantId,
      resourceProfiles: [profile],
      capacityBuckets,
      assignments: [
        createResourceAssignment({
          id: "assignment-task-design-architect",
          tenantId,
          projectId: "project-alpha",
          taskId: "task-design",
          sourceParticipantId: "participant-task-design-architect",
          resourceProfileId,
          roleKey: "solution_architect",
          roleLabel: "Архитектор решения",
          plannedStartDate: "2026-06-01",
          plannedFinishDate: "2026-06-05",
          plannedWorkHours: 46,
          sourceLabel: "Task: concept design"
        })
      ],
      reservations: [
        createResourceReservation({
          id: "reservation-project-draft-architect",
          tenantId,
          sourceType: "project",
          sourceId: "project-draft-alpha",
          resourceProfileId,
          roleKey: "solution_architect",
          roleLabel: "Архитектор решения",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-05",
          reservedHours: 8,
          status: "active",
          sourceLabel: "Черновик проекта"
        })
      ]
    });

    const overloads = detectResourceOverloads({ tenantId, loadBuckets });

    expect(overloads).toEqual([
      {
        id: "overload:resource-architect-a:2026-06-01:2026-06-05",
        tenantId,
        resourceProfileId,
        roleKeys: ["solution_architect"],
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        severity: "critical",
        overloadHours: 14,
        loadPercent: 135,
        sourceRefs: [
          "assignment:assignment-task-design-architect",
          "reservation:reservation-project-draft-architect"
        ],
        affectedTaskIds: ["task-design"],
        affectedProjectIds: ["project-alpha", "project-draft-alpha"],
        recommendedActionKeys: ["shift_work", "split_work", "reassign_resource", "accept_risk", "escalate"],
        status: "open",
        trace: [
          "resource_overload:capacity:40",
          "resource_overload:assigned:46",
          "resource_overload:reserved:8",
          "resource_overload:overload:14",
          "resource_overload:severity:critical"
        ]
      }
    ]);
  });

  it("rejects cross-tenant resources, calendars, exceptions, assignments, and capacity buckets before calculation", () => {
    const profile = createArchitectProfile();

    expect(() =>
      deriveCapacityPeriodBuckets({
        tenantId,
        resourceProfiles: [{ ...profile, tenantId: "tenant-b" }],
        calendars: [createArchitectCalendar()],
        availabilityExceptions: [],
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        granularity: "day"
      })
    ).toThrow("Resource profile tenant mismatch");

    expect(() =>
      deriveCapacityPeriodBuckets({
        tenantId,
        resourceProfiles: [profile],
        calendars: [
          {
            ...createArchitectCalendar(),
            tenantId: "tenant-b",
            effectiveFrom: "2026-02-31"
          }
        ],
        availabilityExceptions: [],
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        granularity: "day"
      })
    ).toThrow("Resource capacity calendar tenant mismatch");

    expect(() =>
      calculateResourceLoadBuckets({
        tenantId,
        resourceProfiles: [profile],
        capacityBuckets: [{ ...deriveCapacityPeriodBuckets({
          tenantId,
          resourceProfiles: [profile],
          calendars: [createArchitectCalendar()],
          availabilityExceptions: [],
          periodStart: "2026-06-01",
          periodEnd: "2026-06-05",
          granularity: "week"
        })[0]!, tenantId: "tenant-b" }],
        assignments: [],
        reservations: []
      })
    ).toThrow("Capacity period bucket tenant mismatch");

    expect(() =>
      createResourceAssignment({
        id: "assignment-cross-tenant",
        tenantId: "tenant-b",
        projectId: "project-alpha",
        taskId: "task-design",
        sourceParticipantId: "participant-task-design-architect",
        resourceProfileId,
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        plannedStartDate: "2026-06-01",
        plannedFinishDate: "2026-06-05",
        plannedWorkHours: Number.NaN,
        sourceLabel: "Bad task"
      })
    ).toThrow(ResourcePlanningModelError);

    expect(() =>
      calculateResourceLoadBuckets({
        tenantId,
        resourceProfiles: [profile],
        capacityBuckets: deriveCapacityPeriodBuckets({
          tenantId,
          resourceProfiles: [profile],
          calendars: [createArchitectCalendar()],
          availabilityExceptions: [],
          periodStart: "2026-06-01",
          periodEnd: "2026-06-05",
          granularity: "week"
        }),
        assignments: [],
        reservations: [
          {
            id: "reservation-cross-tenant",
            tenantId: "tenant-b",
            sourceType: "project",
            sourceId: "tenant-b-project",
            resourceProfileId,
            roleKey: "solution_architect",
            roleLabel: "Архитектор решения",
            periodStart: "2026-02-31",
            periodEnd: "2026-06-05",
            reservedHours: 100,
            status: "active",
            sourceLabel: "Tenant B reservation"
          }
        ]
      })
    ).toThrow("Resource reservation tenant mismatch");
  });

  it("rejects duplicate resource-planning ids before they can double-count capacity or load", () => {
    const profile = createArchitectProfile();
    const calendar = createArchitectCalendar();
    const capacityBucket = deriveCapacityPeriodBuckets({
      tenantId,
      resourceProfiles: [profile],
      calendars: [calendar],
      availabilityExceptions: [],
      periodStart: "2026-06-01",
      periodEnd: "2026-06-05",
      granularity: "week"
    })[0]!;
    const assignment = createResourceAssignment({
      id: "assignment-duplicate",
      tenantId,
      projectId: "project-alpha",
      taskId: "task-design",
      sourceParticipantId: "participant-task-design-architect",
      resourceProfileId,
      roleKey: "solution_architect",
      roleLabel: "Архитектор решения",
      plannedStartDate: "2026-06-01",
      plannedFinishDate: "2026-06-05",
      plannedWorkHours: 10,
      sourceLabel: "Task: concept design"
    });

    expect(() =>
      deriveCapacityPeriodBuckets({
        tenantId,
        resourceProfiles: [profile, profile],
        calendars: [calendar],
        availabilityExceptions: [],
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        granularity: "week"
      })
    ).toThrow("Resource profile ids must be unique");

    expect(() =>
      calculateResourceLoadBuckets({
        tenantId,
        resourceProfiles: [profile],
        capacityBuckets: [capacityBucket, capacityBucket],
        assignments: [],
        reservations: []
      })
    ).toThrow("Capacity period bucket ids must be unique");

    expect(() =>
      calculateResourceLoadBuckets({
        tenantId,
        resourceProfiles: [profile],
        capacityBuckets: [capacityBucket],
        assignments: [assignment, assignment],
        reservations: []
      })
    ).toThrow("Resource assignment ids must be unique");
  });
});
