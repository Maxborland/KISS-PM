import { describe, expect, it } from "vitest";

import type { ResourceLoadBucket } from "./resourcePlanning";
import {
  buildEmployeeRows,
  buildMonthDays,
  collectProjectsWithOverloadedEmployees,
  HIDDEN_PROJECT_ID,
  mergeWorkspaceDayBuckets,
  monthDateSet
} from "./employeeCapacity";

function dayBucket(input: {
  resourceId: string;
  projectId: string;
  date: string;
  assignedMinutes: number;
  capacityMinutes?: number;
}): ResourceLoadBucket {
  return {
    resourceId: input.resourceId,
    positionId: null,
    teamId: null,
    projectId: input.projectId,
    date: input.date,
    granularity: "day",
    assignedMinutes: input.assignedMinutes,
    reservedMinutes: 0,
    capacityMinutes: input.capacityMinutes ?? 480,
    freeMinutes: 0,
    taskIds: [],
    assignmentIds: [],
    reservationIds: [],
    calendarExceptionIds: []
  };
}

describe("employeeCapacity", () => {
  it("merges cross-project load and flags overload at employee total", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a", "p-b"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 240 })]
        },
        {
          projectId: "p-b",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-b", date, assignedMinutes: 288 })]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [
        { id: "u1", name: "User", positionId: null, positionName: null }
      ],
      mergedByUserDate: merged
    });

    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.workMinutes).toBe(528);
    expect(cell?.isOverload).toBe(true);
  });

  it("collectProjectsWithOverloadedEmployees lists all projects from overload-day mix", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a", "p-b"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 240 })]
        },
        {
          projectId: "p-b",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-b", date, assignedMinutes: 288 })]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [{ id: "u1", name: "User", positionId: null, positionName: null }],
      mergedByUserDate: merged
    });

    const projectIds = collectProjectsWithOverloadedEmployees(rows);
    expect(projectIds.has("p-a")).toBe(true);
    expect(projectIds.has("p-b")).toBe(true);
  });

  it("project filter shows portion work but keeps employee-total overload", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a", "p-b"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 240 })]
        },
        {
          projectId: "p-b",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-b", date, assignedMinutes: 288 })]
        }
      ]
    });

    const { rows } = buildEmployeeRows({
      monthIso,
      workspaceUsers: [
        { id: "u1", name: "User", positionId: null, positionName: null }
      ],
      mergedByUserDate: merged,
      projectFilterId: "p-a"
    });

    const cell = rows[0]?.days.find((day) => day.date === date);
    expect(cell?.workMinutes).toBe(240);
    expect(cell?.isOverload).toBe(true);
  });

  it("hides unreadable project ids in mix", () => {
    const monthIso = "2026-06-01".slice(0, 7);
    const monthDates = monthDateSet(monthIso);
    const date = "2026-06-02";
    const merged = mergeWorkspaceDayBuckets({
      monthDates,
      readableProjectIds: new Set(["p-a"]),
      projects: [
        {
          projectId: "p-a",
          buckets: [dayBucket({ resourceId: "u1", projectId: "p-a", date, assignedMinutes: 100 })]
        },
        {
          projectId: "secret",
          buckets: [dayBucket({ resourceId: "u1", projectId: "secret", date, assignedMinutes: 50 })]
        }
      ]
    });

    const mix = merged.get("u1")?.get(date)?.projectsMix;
    expect(mix?.has(HIDDEN_PROJECT_ID)).toBe(true);
    expect(mix?.has("secret")).toBe(false);
  });

  it("builds month days with weekends", () => {
    const days = buildMonthDays("2026-06-01");
    expect(days.length).toBe(30);
    expect(days.some((day) => day.isWeekend)).toBe(true);
  });
});
