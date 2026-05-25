import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { ProjectRecord, TaskRecord } from "@kiss-pm/persistence";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "./apiTypes";
import { registerSearchRoutes } from "./searchRoutes";

describe("unified search routes", () => {
  it("filters project tasks before applying the source limit", async () => {
    const app = new Hono();
    const actor = {
      id: "user-alpha",
      tenantId: "tenant-alpha",
      accessProfileId: "profile-alpha"
    } as TenantUser;
    const profile = {
      id: "profile-alpha",
      permissions: ["tenant.projects.read"]
    } as AccessProfile;
    const firstProject = project("project-first", "Первый проект");
    const secondProject = project("project-second", "Второй проект");

    registerSearchRoutes(app, {
      dataSource: {
        findTenantById: async () => ({ id: "tenant-alpha", name: "Tenant Alpha" }),
        findUserById: async () => actor,
        listDevUsers: async () => [actor],
        listProjects: async () => [firstProject, secondProject],
        listProjectTasks: async (_tenantId: string, projectId: string) => {
          if (projectId === firstProject.id) {
            return Array.from({ length: 40 }, (_, index) =>
              task(`task-noise-${index}`, `Подготовить договор ${index}`, firstProject.id)
            );
          }
          return [task("task-target", "договор", secondProject.id)];
        },
        listUsersByTenantId: async () => [actor]
      } satisfies ApiTenantDataSource,
      getActorProfile: async () => profile,
      getSessionActorFromHeaders: async () => actor
    });

    const response = await app.request("/api/workspace/search?q=договор&limit=1", {
      headers: { cookie: "kiss_pm_session=test" }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [
        expect.objectContaining({
          id: "task:task-target",
          route: "/tasks/task-target",
          subtitle: "Второй проект"
        })
      ]
    });
  });
});

function project(id: string, title: string): ProjectRecord {
  return {
    id,
    tenantId: "tenant-alpha",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: null,
    projectTypeId: null,
    title,
    clientName: "Клиент",
    status: "active",
    plannedStart: new Date("2026-05-24T00:00:00.000Z"),
    plannedFinish: new Date("2026-05-25T00:00:00.000Z"),
    contractValue: 0,
    plannedHours: 0,
    templateId: null,
    createdAt: new Date("2026-05-24T00:00:00.000Z"),
    activatedAt: new Date("2026-05-24T00:00:00.000Z"),
    closedAt: null,
    demand: []
  };
}

function task(id: string, title: string, projectId: string): TaskRecord {
  return {
    id,
    tenantId: "tenant-alpha",
    projectId,
    stageId: null,
    title,
    description: null,
    status: "new",
    statusId: "status-todo",
    statusName: "Новая",
    statusCategory: "new",
    priority: "normal",
    requesterUserId: "user-alpha",
    ownerUserId: "user-alpha",
    plannedStart: new Date("2026-05-24T00:00:00.000Z"),
    plannedFinish: new Date("2026-05-25T00:00:00.000Z"),
    durationWorkingDays: 1,
    plannedWork: 0,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: false,
    source: "manual",
    createdAt: new Date("2026-05-24T00:00:00.000Z"),
    updatedAt: new Date("2026-05-24T00:00:00.000Z"),
    archivedAt: null,
    participants: []
  };
}
