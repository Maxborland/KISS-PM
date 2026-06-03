import { describe, expect, it } from "vitest";

import { buildProjectTimelineGanttData } from "@/lib/runtime/project-timeline";
import type { Project, Task, TaskStatus, WorkspaceUser } from "@/lib/api-types";

describe("buildProjectTimelineGanttData", () => {
  it("maps live project tasks into read-only Gantt rows with real dates", () => {
    const data = buildProjectTimelineGanttData({
      project: project(),
      tasks: [
        task({
          id: "task-survey",
          ownerUserId: "usr-1",
          plannedStart: "2026-06-02T00:00:00.000Z",
          plannedFinish: "2026-06-04T00:00:00.000Z",
          progress: 0.5,
          title: "Обмерить существующие классы"
        })
      ],
      taskStatuses: [status({ id: "status-progress", name: "В работе", category: "in_progress" })],
      workspaceUsers: [user({ id: "usr-1", name: "Мария Иванова" })],
      now: new Date("2026-06-03T00:00:00.000Z")
    });

    expect(data.monthLabel).toBe("июнь 2026 г.");
    expect(data.days[1]).toMatchObject({ day: 2, isoDate: "2026-06-02", weekdayShort: "вт" });
    expect(data.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "project-runtime",
          kind: "summary",
          name: "Runtime project"
        }),
        expect.objectContaining({
          assignee: { initials: "МИ", color: "c1" },
          critical: true,
          durationDays: 3,
          id: "task-survey",
          level: 1,
          name: "Обмерить существующие классы",
          progress: 0.5,
          scheduleState: "on-track",
          startDay: 1,
          statusName: "В работе"
        })
      ])
    );
  });

  it("does not create fixture rows when runtime project has no active tasks", () => {
    const data = buildProjectTimelineGanttData({
      project: project(),
      tasks: [task({ archivedAt: "2026-06-01T00:00:00.000Z", title: "Archived fixture-looking task" })],
      taskStatuses: [],
      workspaceUsers: [],
      now: new Date("2026-06-03T00:00:00.000Z")
    });

    expect(data.rows).toEqual([]);
    expect(data.rows.map((row) => row.name)).not.toContain("Разработать концепцию");
  });
});

function project(overrides: Partial<Project> = {}): Project {
  return {
    activatedAt: null,
    clientId: "client-runtime",
    clientName: "Runtime client",
    contractValue: 1_000_000,
    createdAt: "2026-06-01T00:00:00.000Z",
    demand: [],
    id: "project-runtime",
    plannedFinish: "2026-06-12T00:00:00.000Z",
    plannedHours: 120,
    plannedStart: "2026-06-01T00:00:00.000Z",
    projectTypeId: "project-type-runtime",
    sourceOpportunityId: null,
    sourceType: "manual",
    status: "active",
    templateId: null,
    tenantId: "tenant-runtime",
    title: "Runtime project",
    ...overrides
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    actualWork: 0,
    archivedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    description: null,
    durationWorkingDays: 1,
    id: "task-runtime",
    ownerUserId: "usr-1",
    participants: [{ role: "executor", userId: "usr-1" }],
    plannedFinish: "2026-06-02T00:00:00.000Z",
    plannedStart: "2026-06-02T00:00:00.000Z",
    plannedWork: 8,
    priority: "critical",
    progress: 0,
    projectId: "project-runtime",
    requesterUserId: "usr-1",
    requiresAcceptance: false,
    source: "manual",
    stageId: null,
    status: "in_progress",
    statusCategory: "in_progress",
    statusId: "status-progress",
    statusName: "В работе",
    tenantId: "tenant-runtime",
    title: "Runtime task",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function status(overrides: Partial<TaskStatus> = {}): TaskStatus {
  return {
    category: "in_progress",
    createdAt: "2026-06-01T00:00:00.000Z",
    id: "status-progress",
    isSystem: true,
    name: "В работе",
    sortOrder: 1,
    status: "active",
    tenantId: "tenant-runtime",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function user(overrides: Partial<WorkspaceUser> = {}): WorkspaceUser {
  return {
    accessProfileId: "profile-runtime",
    accentColor: "blue",
    email: "runtime@kiss-pm.local",
    id: "usr-1",
    name: "Runtime User",
    phone: null,
    positionId: null,
    positionName: null,
    status: "active",
    telegram: null,
    tenantId: "tenant-runtime",
    theme: "light",
    ...overrides
  };
}
