import { describe, expect, it } from "vitest";

import { buildProjectResourceMatrixData } from "@/lib/runtime/project-resources";
import type { Project, Task, WorkspaceUser } from "@/lib/api-types";

describe("buildProjectResourceMatrixData", () => {
  it("builds a read-only resource matrix from live project tasks and users", () => {
    const data = buildProjectResourceMatrixData({
      project: project({
        demand: [
          { positionId: "position-architect", requiredHours: 120 },
          { positionId: "position-bim-coordinator", requiredHours: 60 },
          { positionId: "position-interior-designer", requiredHours: 40 }
        ]
      }),
      tasks: [
        task({
          id: "task-a",
          durationWorkingDays: 2,
          ownerUserId: "usr-architect",
          plannedStart: "2026-06-01",
          plannedFinish: "2026-06-02",
          plannedWork: 16
        }),
        task({
          id: "task-b",
          ownerUserId: "usr-bim",
          plannedStart: "2026-06-02",
          plannedFinish: "2026-06-02",
          plannedWork: 10
        })
      ],
      workspaceUsers: [
        user("usr-architect", "Анна Архитектор", "Архитектор", "position-architect"),
        user("usr-bim", "Ольга BIM", "BIM-координатор", "position-bim-coordinator")
      ],
      now: new Date("2026-06-02T00:00:00.000Z")
    });

    expect(data.days.map((day) => day.day)).toEqual([1, 2, 3, 4, 5]);
    expect(data.rows.map((row) => row.name)).toEqual([
      "Школа",
      "архитектор",
      "Анна Архитектор",
      "bim координатор",
      "Ольга BIM",
      "Дизайнер интерьеров"
    ]);
    expect(data.rows.find((row) => row.id === "role-missing-position-interior-designer")).toMatchObject({
      kind: "role",
      status: "missing-role",
      requiredHours: 40
    });
    expect(data.stats.employees).toBe(2);
    expect(data.stats.assignedHours).toBe(26);
    expect(data.rows.find((row) => row.id === "usr-bim")?.cells[1]).toMatchObject({
      kind: "load",
      hours: 10,
      level: "normal"
    });
  });
});

function project(overrides: Partial<Project> = {}): Project {
  return {
    activatedAt: null,
    clientId: null,
    clientName: "ГК Северный квартал",
    contractValue: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    demand: [],
    id: "project-1",
    plannedFinish: "2026-06-05",
    plannedHours: 120,
    plannedStart: "2026-06-01",
    projectTypeId: null,
    sourceOpportunityId: null,
    sourceType: "manual",
    status: "active",
    templateId: null,
    tenantId: "tenant-1",
    title: "Школа",
    ...overrides
  };
}

function task(overrides: Partial<Task>): Task {
  return {
    actualWork: 0,
    archivedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    description: null,
    durationWorkingDays: 1,
    id: "task-1",
    ownerUserId: "usr-1",
    participants: [],
    plannedFinish: "2026-06-01",
    plannedStart: "2026-06-01",
    plannedWork: 8,
    priority: "normal",
    progress: 0,
    projectId: "project-1",
    requesterUserId: "usr-1",
    requiresAcceptance: false,
    source: "manual",
    stageId: null,
    status: "in_progress",
    statusCategory: "in_progress",
    statusId: "status-progress",
    statusName: "В работе",
    tenantId: "tenant-1",
    title: "Задача",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function user(id: string, name: string, positionName: string, positionId = `pos-${id}`): WorkspaceUser {
  return {
    accentColor: "c1",
    accessProfileId: "profile",
    email: `${id}@kiss-pm.local`,
    id,
    name,
    phone: null,
    positionId,
    positionName,
    status: "active",
    telegram: null,
    tenantId: "tenant-1",
    theme: "system"
  };
}
