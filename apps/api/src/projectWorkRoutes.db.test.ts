import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

import { createApp } from "./app";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

const projectWorkApiSeed: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа Проект" }],
  accessProfiles: [
    {
      id: "access-profile-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: [
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.opportunities.read",
        "tenant.opportunities.manage",
        "tenant.project_activation.manage",
        "tenant.resource_feasibility.read",
        "tenant.audit_events.read"
      ]
    },
    {
      id: "access-profile-reader",
      tenantId: "tenant-alpha",
      name: "Исполнитель",
      permissions: ["tenant.projects.read"]
    },
    {
      id: "access-profile-denied",
      tenantId: "tenant-alpha",
      name: "Без проектов",
      permissions: []
    }
  ],
  positions: [
    { id: "position-manager", tenantId: "tenant-alpha", name: "Руководитель проекта" },
    { id: "position-engineer", tenantId: "tenant-alpha", name: "Инженер" }
  ],
  clients: [{ id: "client-romashka", tenantId: "tenant-alpha", name: "ООО Ромашка" }],
  projectTypes: [
    { id: "project-type-implementation", tenantId: "tenant-alpha", name: "Внедрение" }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-admin",
      positionId: "position-manager",
      password: "local-admin-password"
    },
    {
      id: "user-alpha-executor",
      tenantId: "tenant-alpha",
      email: "executor@kiss-pm.local",
      name: "Егор Исполнитель",
      accessProfileId: "access-profile-reader",
      positionId: "position-engineer",
      password: "local-executor-password"
    },
    {
      id: "user-alpha-denied",
      tenantId: "tenant-alpha",
      email: "denied@kiss-pm.local",
      name: "Дина Без Прав",
      accessProfileId: "access-profile-denied",
      password: "local-denied-password"
    }
  ]
};

describe("project work API routes", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  async function loginAs(email: string, password: string) {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    expect(response.status).toBe(200);
    return response.headers.get("set-cookie") ?? "";
  }

  async function createActiveProject() {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const opportunity = await dataSource.createOpportunity({
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      primaryContactId: null,
      projectTypeId: "project-type-implementation",
      stageId: null,
      clientName: "ООО Ромашка",
      contactName: "Ирина Клиент",
      title: "Внедрение KISS PM",
      projectType: "Внедрение",
      description: null,
      plannedStart: new Date("2026-06-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
      contractValue: 1000000,
      plannedHourlyRate: 5000,
      plannedHours: 200,
      probability: 80,
      status: "ready_to_activate",
      templateId: null,
      demand: [{ positionId: "position-engineer", requiredHours: 80 }]
    });
    const draft = await dataSource.createProjectDraftFromOpportunity({
      id: "project-alpha",
      tenantId: "tenant-alpha",
      sourceOpportunityId: opportunity.id,
      clientId: opportunity.clientId,
      projectTypeId: opportunity.projectTypeId,
      title: opportunity.title,
      clientName: opportunity.clientName,
      status: "draft",
      plannedStart: opportunity.plannedStart,
      plannedFinish: opportunity.plannedFinish,
      contractValue: opportunity.contractValue,
      plannedHours: opportunity.plannedHours,
      templateId: null,
      demand: opportunity.demand
    });
    await dataSource.activateProjectDraft({
      tenantId: "tenant-alpha",
      projectId: draft.id
    });
  }

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, task_participants, tasks, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      projectWorkApiSeed,
      new Date("2026-05-19T00:00:00.000Z")
    );
    await createActiveProject();
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, task_participants, tasks, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("creates a project task, returns it in project detail and My Work, and writes audit", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const executorCookie = await loginAs("executor@kiss-pm.local", "local-executor-password");
    const createdTask = await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-alpha",
        title: "Подготовить план внедрения",
        description: "Собрать стартовый план работ",
        priority: "high",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 24,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    const projectDetail = await app.request("/api/workspace/projects/project-alpha", {
      headers: { cookie: adminCookie }
    });
    const myWork = await app.request("/api/workspace/my-work", {
      headers: { cookie: executorCookie }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });

    expect(createdTask.status).toBe(201);
    await expect(createdTask.json()).resolves.toMatchObject({
      task: {
        id: "task-alpha",
        projectId: "project-alpha",
        title: "Подготовить план внедрения",
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      }
    });
    expect(projectDetail.status).toBe(200);
    await expect(projectDetail.json()).resolves.toMatchObject({
      project: { id: "project-alpha", status: "active" },
      tasks: [expect.objectContaining({ id: "task-alpha" })]
    });
    expect(myWork.status).toBe(200);
    await expect(myWork.json()).resolves.toMatchObject({
      tasks: [expect.objectContaining({ id: "task-alpha" })]
    });
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "task.created",
          sourceEntity: { type: "Task", id: "task-alpha" }
        })
      ])
    });
  });

  it("lets an assigned executor transition their task status and writes audit", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const executorCookie = await loginAs("executor@kiss-pm.local", "local-executor-password");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-transition",
        title: "Собрать контекст проекта",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 16,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });

    const transitioned = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-transition/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: executorCookie
        },
        body: JSON.stringify({ status: "in_progress" })
      }
    );
    const myWork = await app.request("/api/workspace/my-work", {
      headers: { cookie: executorCookie }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });

    expect(transitioned.status).toBe(200);
    await expect(transitioned.json()).resolves.toMatchObject({
      task: {
        id: "task-transition",
        status: "in_progress",
        progress: 10
      }
    });
    await expect(myWork.json()).resolves.toMatchObject({
      tasks: [expect.objectContaining({ id: "task-transition", status: "in_progress" })]
    });
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "task.status_changed",
          sourceEntity: { type: "Task", id: "task-transition" },
          permissionResult: expect.objectContaining({
            authorizationBasis: "task_participant_role",
            participantRole: "executor",
            permission: null
          })
        })
      ])
    });
  });

  it("denies task status transition for non-participant readers", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const readerCookie = await loginAs("executor@kiss-pm.local", "local-executor-password");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-admin-only",
        title: "Проверить контур проекта",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 16,
        participants: [{ userId: "user-alpha-admin", role: "executor" }]
      })
    });

    const denied = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-admin-only/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: readerCookie
        },
        body: JSON.stringify({ status: "done" })
      }
    );

    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({
      error: "task_participant_role_required"
    });
  });

  it("denies task status transition for observer participants", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    const observerCookie = await loginAs("executor@kiss-pm.local", "local-executor-password");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-observer-only",
        title: "Наблюдать за контуром",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 16,
        participants: [
          { userId: "user-alpha-admin", role: "executor" },
          { userId: "user-alpha-executor", role: "observer" }
        ]
      })
    });

    const denied = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-observer-only/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: observerCookie
        },
        body: JSON.stringify({ status: "in_progress" })
      }
    );

    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({
      error: "task_participant_role_required"
    });
  });

  it("rejects unsupported task statuses", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-invalid-status",
        title: "Проверить статус",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 16,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });

    const invalid = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-invalid-status/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ status: "cancelled" })
      }
    );

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      error: "invalid_task_status"
    });
  });

  it("rejects status rollbacks after task completion", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-terminal-status",
        title: "Финальная задача",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 16,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-terminal-status/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ status: "in_progress" })
      }
    );
    await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-terminal-status/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ status: "done" })
      }
    );

    const rollback = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-terminal-status/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ status: "in_progress" })
      }
    );

    expect(rollback.status).toBe(409);
    await expect(rollback.json()).resolves.toEqual({
      error: "task_status_transition_not_allowed"
    });
  });

  it("requires same-origin action header for task status transitions", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "local-admin-password");

    const denied = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-any/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: adminCookie
        },
        body: JSON.stringify({ status: "in_progress" })
      }
    );

    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({
      error: "same_origin_action_required"
    });
  });

  it("enforces project read and manage permissions", async () => {
    const readerCookie = await loginAs("executor@kiss-pm.local", "local-executor-password");
    const deniedCookie = await loginAs("denied@kiss-pm.local", "local-denied-password");
    const readerCreate = await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: readerCookie
      },
      body: JSON.stringify({
        title: "Не должно создаться",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    const deniedProject = await app.request("/api/workspace/projects/project-alpha", {
      headers: { cookie: deniedCookie }
    });
    const deniedMyWork = await app.request("/api/workspace/my-work", {
      headers: { cookie: deniedCookie }
    });

    expect(readerCreate.status).toBe(403);
    await expect(readerCreate.json()).resolves.toEqual({ error: "permission_missing" });
    expect(deniedProject.status).toBe(403);
    await expect(deniedProject.json()).resolves.toEqual({ error: "permission_missing" });
    expect(deniedMyWork.status).toBe(403);
    await expect(deniedMyWork.json()).resolves.toEqual({ error: "permission_missing" });
  });
});
