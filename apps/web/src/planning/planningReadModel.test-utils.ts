import type { PlanningReadModel } from "./planningReadModelMapper";

export function createPlanningReadModelFixture(
  overrides: Partial<PlanningReadModel> = {}
): PlanningReadModel {
  const base: PlanningReadModel = {
    project: {
      id: "project-alpha",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-30",
      deadline: "2026-06-28",
      calendarId: "calendar-project"
    },
    authored: {
      tasks: [
        {
          id: "task-a",
          parentTaskId: null,
          wbsCode: "1",
          title: "Подготовка",
          statusId: "task-status-active",
          schedulingMode: "auto",
          taskType: "fixed_units",
          effortDriven: false,
          plannedStart: "2026-06-01",
          plannedFinish: "2026-06-03",
          durationMinutes: 1440,
          workMinutes: 960,
          percentComplete: 25,
          calendarId: "calendar-project",
          constraint: null
        }
      ],
      dependencies: [],
      assignments: [],
      baselines: []
    },
    calculatedPlan: {
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      planVersion: 3,
      engineVersion: "planning-core-v1",
      calculatedAt: "2026-05-22T00:00:00.000Z",
      tasks: [
        {
          id: "task-a",
          parentTaskId: null,
          wbsCode: "1",
          title: "Подготовка",
          statusId: "task-status-active",
          schedulingMode: "auto",
          taskType: "fixed_units",
          effortDriven: false,
          plannedStart: "2026-06-01",
          plannedFinish: "2026-06-03",
          durationMinutes: 1440,
          workMinutes: 960,
          percentComplete: 25,
          calendarId: "calendar-project",
          constraint: null,
          calculatedStart: "2026-06-01",
          calculatedFinish: "2026-06-03",
          calculatedStartInstant: { date: "2026-06-01", minuteOfDay: 0 },
          calculatedFinishInstant: { date: "2026-06-03", minuteOfDay: 480 },
          earliestStart: "2026-06-01",
          earliestFinish: "2026-06-03",
          earliestStartInstant: { date: "2026-06-01", minuteOfDay: 0 },
          earliestFinishInstant: { date: "2026-06-03", minuteOfDay: 480 },
          latestStart: "2026-06-01",
          latestFinish: "2026-06-03",
          latestStartInstant: { date: "2026-06-01", minuteOfDay: 0 },
          latestFinishInstant: { date: "2026-06-03", minuteOfDay: 480 },
          totalSlackMinutes: 0,
          isCritical: true
        }
      ],
      dependencies: [],
      projectFinish: "2026-06-03",
      criticalPathTaskIds: ["task-a"],
      criticalPath: { taskIds: ["task-a"] },
      scheduleTrace: [],
      validationIssues: []
    },
    baselineComparison: {
      baselineId: null,
      capturedAt: null,
      tasks: []
    },
    resourceLoad: {
      buckets: [
        {
          resourceId: "resource-alpha",
          positionId: "position-engineer",
          teamId: null,
          projectId: "project-alpha",
          date: "2026-06-01",
          granularity: "day",
          assignedMinutes: 600,
          reservedMinutes: 60,
          capacityMinutes: 480,
          freeMinutes: 0,
          taskIds: ["task-a"],
          assignmentIds: ["assignment-a"],
          reservationIds: ["reservation-a"],
          calendarExceptionIds: []
        }
      ],
      overloads: [
        {
          resourceId: "resource-alpha",
          positionId: "position-engineer",
          teamId: null,
          projectId: "project-alpha",
          date: "2026-06-01",
          granularity: "day",
          assignedMinutes: 600,
          reservedMinutes: 60,
          capacityMinutes: 480,
          freeMinutes: 0,
          taskIds: ["task-a"],
          assignmentIds: ["assignment-a"],
          reservationIds: ["reservation-a"],
          calendarExceptionIds: [],
          overloadMinutes: 180,
          reasons: [{ type: "task", id: "task-a" }]
        }
      ],
      freeCapacityBuckets: []
    },
    validationIssues: [],
    planVersion: 3,
    engineVersion: "planning-core-v1"
  };

  return {
    ...base,
    ...overrides,
    authored: { ...base.authored, ...overrides.authored },
    calculatedPlan: { ...base.calculatedPlan, ...overrides.calculatedPlan },
    baselineComparison: { ...base.baselineComparison, ...overrides.baselineComparison },
    resourceLoad: { ...base.resourceLoad, ...overrides.resourceLoad }
  };
}
