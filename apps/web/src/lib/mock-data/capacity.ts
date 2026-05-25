import type { Absence, PlanBaseline, ProductionCalendar } from "@/lib/api-types";

import { MOCK_TENANT_ID } from "./users";

export const MOCK_PRODUCTION_CALENDAR = {
  calendarId: "cal-ru-5x8",
  year: 2026,
  workingWeekdays: [1, 2, 3, 4, 5],
  workingMinutesPerDay: 480,
  exceptions: [
    {
      id: "cal-ex-2026-05-01",
      date: "2026-05-01",
      workingMinutes: 0,
      reason: "Праздник",
      resourceId: null
    },
    {
      id: "cal-ex-2026-05-08",
      date: "2026-05-08",
      workingMinutes: 300,
      reason: "Сокращённый день",
      resourceId: null
    }
  ]
} satisfies ProductionCalendar;

export const MOCK_ABSENCES = [
  {
    id: "abs-1",
    tenantId: MOCK_TENANT_ID,
    userId: "usr-kozlova",
    type: "vacation",
    dateFrom: "2026-06-03",
    dateTo: "2026-06-07",
    status: "approved",
    reason: "Плановый отпуск",
    createdBy: "usr-kozlova",
    approvedBy: "usr-ivanova",
    createdAt: "2026-05-20T09:00:00.000Z",
    updatedAt: "2026-05-21T09:00:00.000Z"
  },
  {
    id: "abs-2",
    tenantId: MOCK_TENANT_ID,
    userId: "usr-volkov",
    type: "sick_leave",
    dateFrom: "2026-05-28",
    dateTo: "2026-05-29",
    status: "requested",
    reason: "Больничный",
    createdBy: "usr-volkov",
    approvedBy: null,
    createdAt: "2026-05-25T09:00:00.000Z",
    updatedAt: "2026-05-25T09:00:00.000Z"
  }
] satisfies Absence[];

export const MOCK_PLAN_BASELINES = [
  {
    id: "baseline-1",
    capturedAt: "2026-05-20T09:00:00.000Z",
    tasks: [
      {
        taskId: "MDS-39",
        plannedStart: "2026-05-27",
        plannedFinish: "2026-05-29",
        workMinutes: 1920
      },
      {
        taskId: "MDS-2",
        plannedStart: "2026-05-28",
        plannedFinish: "2026-05-30",
        workMinutes: 960
      }
    ]
  }
] satisfies PlanBaseline[];

export const MOCK_PLANNING_SCENARIOS = [
  {
    id: "scenario-balanced",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-014",
    name: "Сбалансированный сценарий",
    deadline: "2026-08-12",
    cost: 32000,
    risk: 18,
    spi: 0.94,
    recommended: true,
    status: "draft",
    createdAt: "2026-05-25T08:00:00.000Z"
  },
  {
    id: "scenario-aggressive",
    tenantId: MOCK_TENANT_ID,
    projectId: "PRJ-2026-014",
    name: "Агрессивное сжатие",
    deadline: "2026-08-08",
    cost: 64000,
    risk: 36,
    spi: 1.02,
    recommended: false,
    status: "draft",
    createdAt: "2026-05-25T08:00:00.000Z"
  }
];
