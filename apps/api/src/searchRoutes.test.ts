import { ensureCompleteDataSource } from "./dataSourceCompletion";
import type { AccessProfile } from "@kiss-pm/access-control";
import type { KnowledgeDocument, TenantUser } from "@kiss-pm/domain";
import type { ProjectRecord, TaskRecord } from "@kiss-pm/persistence";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { ApiTenantDataSource } from "./apiTypes";
import { registerSearchRoutes } from "./searchRoutes";

describe("unified search routes", () => {
  it("rejects malformed or oversized search filters before session and source lookup", async () => {
    const app = new Hono();

    registerSearchRoutes(app, {
      dataSource: ensureCompleteDataSource({
        findTenantById: async () => {
          throw new Error("findTenantById should not be called");
        },
        findUserById: async () => {
          throw new Error("findUserById should not be called");
        },
        listDevUsers: async () => {
          throw new Error("listDevUsers should not be called");
        },
        listProjects: async () => {
          throw new Error("listProjects should not be called");
        },
        listUsersByTenantId: async () => {
          throw new Error("listUsersByTenantId should not be called");
        }
      }) satisfies ApiTenantDataSource,
      getActorProfile: async () => {
        throw new Error("getActorProfile should not be called");
      },
      getSessionActorFromHeaders: async () => {
        throw new Error("getSessionActorFromHeaders should not be called");
      }
    });

    const oversizedQuery = await app.request(`/api/workspace/search?q=${"a".repeat(121)}`);
    expect(oversizedQuery.status).toBe(400);
    await expect(oversizedQuery.json()).resolves.toEqual({ error: "search_query_invalid" });

    const invalidTypes = await app.request("/api/workspace/search?q=crm&types=project,../../secret");
    expect(invalidTypes.status).toBe(400);
    await expect(invalidTypes.json()).resolves.toEqual({ error: "search_types_invalid" });

    const invalidLimit = await app.request("/api/workspace/search?q=crm&limit=20.5");
    expect(invalidLimit.status).toBe(400);
    await expect(invalidLimit.json()).resolves.toEqual({ error: "search_limit_invalid" });
  });

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
      dataSource: ensureCompleteDataSource({
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
      }) satisfies ApiTenantDataSource,
      getActorProfile: async () => profile,
      getSessionActorFromHeaders: async () => actor
    });

    const response = await app.request("/api/workspace/search?q=договор&limit=1&types=task", {
      headers: { cookie: "kiss_pm_session=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [
        expect.objectContaining({
          id: "task:task-target",
          // Канонический маршрут задачи; раньше вели в карточку проекта, а палитра
          // подменяла её на `/my-work?task=` — второй владелец маршрутизации.
          route: "/tasks/task-target",
          subtitle: "Второй проект"
        })
      ]
    });
  });

  it("returns readable knowledge metadata results", async () => {
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

    registerSearchRoutes(app, {
      dataSource: ensureCompleteDataSource({
        findTenantById: async () => ({ id: "tenant-alpha", name: "Tenant Alpha" }),
        findUserById: async () => actor,
        listDevUsers: async () => [actor],
        listProjects: async () => [project("project-first", "Первый проект")],
        listUsersByTenantId: async () => [actor],
        searchKnowledge: async () => ({
          documents: [knowledgeDocument("knowledge-doc-1", "Протокол архитектурного решения")],
          decisions: [],
          actionItems: []
        })
      }) satisfies ApiTenantDataSource,
      getActorProfile: async () => profile,
      getSessionActorFromHeaders: async () => actor
    });

    const response = await app.request("/api/workspace/search?q=протокол&types=document", {
      headers: { cookie: "kiss_pm_session=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [
        expect.objectContaining({
          id: "document:knowledge-doc-1",
          route: "/projects/project-first/knowledge?document=knowledge-doc-1",
          source: "knowledge"
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

function knowledgeDocument(id: string, title: string): KnowledgeDocument {
  const now = new Date("2026-05-24T00:00:00.000Z");
  return {
    id,
    tenantId: "tenant-alpha",
    projectId: "project-first",
    title,
    summary: "Короткое резюме",
    documentType: "meeting_minutes",
    status: "active",
    currentVersionId: "knowledge-version-1",
    sourceMeetingId: null,
    approvalStatus: "none",
    approvalRequestedByUserId: null,
    createdByUserId: "user-alpha",
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  };
}
