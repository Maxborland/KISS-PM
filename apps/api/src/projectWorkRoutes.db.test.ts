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
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

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
        "tenant.tasks.create",
        "tenant.tasks.edit",
        "tenant.tasks.delete",
        "tenant.task_statuses.manage",
        "tenant.project_plan.read",
        "tenant.project_resources.read",
        "tenant.project_resources.manage",
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
    },
    {
      id: "access-profile-manager-only",
      tenantId: "tenant-alpha",
      name: "Менеджер без чтения",
      permissions: ["tenant.projects.manage"]
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
      password: "admin12345"
    },
    {
      id: "user-alpha-executor",
      tenantId: "tenant-alpha",
      email: "executor@kiss-pm.local",
      name: "Егор Исполнитель",
      accessProfileId: "access-profile-reader",
      positionId: "position-engineer",
      password: "executor12345"
    },
    {
      id: "user-alpha-denied",
      tenantId: "tenant-alpha",
      email: "denied@kiss-pm.local",
      name: "Дина Без Прав",
      accessProfileId: "access-profile-denied",
      password: "denied12345"
    },
    {
      id: "user-alpha-manager-only",
      tenantId: "tenant-alpha",
      email: "manager-only@kiss-pm.local",
      name: "Марк Менеджер",
      accessProfileId: "access-profile-manager-only",
      positionId: "position-manager",
      password: "manager12345"
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

  function buildTaskPatchBody(input: {
    clientUpdatedAt: string;
    title?: string;
    description?: string | null;
    priority?: string;
    statusId?: string;
    plannedStart?: string;
    plannedFinish?: string;
    durationWorkingDays?: number;
    plannedWork?: number;
    requiresAcceptance?: boolean;
    participants?: Array<{ userId: string; role: string }>;
  }) {
    return {
      title: input.title ?? "Обновить задачу",
      description: input.description ?? null,
      priority: input.priority ?? "normal",
      statusId: input.statusId ?? "task-status-new",
      plannedStart: input.plannedStart ?? "2026-06-02",
      plannedFinish: input.plannedFinish ?? "2026-06-05",
      durationWorkingDays: input.durationWorkingDays ?? 4,
      plannedWork: input.plannedWork ?? 8,
      requiresAcceptance: input.requiresAcceptance ?? false,
      clientUpdatedAt: input.clientUpdatedAt,
      participants: input.participants ?? [{ userId: "user-alpha-executor", role: "executor" }]
    };
  }

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      projectWorkApiSeed,
      new Date("2026-05-19T00:00:00.000Z")
    );
    await createActiveProject();
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("rejects malformed project work route identifiers before persistence lookup", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");

    const badProjectDetail = await app.request("/api/workspace/projects/bad..project", {
      headers: { cookie: adminCookie }
    });
    const badTaskDetail = await app.request("/api/workspace/tasks/bad..task", {
      headers: { cookie: adminCookie }
    });
    const badStatusPatch = await app.request("/api/workspace/task-statuses/bad..status", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        name: "Новый статус",
        category: "waiting",
        sortOrder: 30
      })
    });
    const badTransitionTask = await app.request(
      "/api/workspace/projects/project-alpha/tasks/bad..task/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ statusId: "task-status-in-progress" })
      }
    );

    expect(badProjectDetail.status).toBe(400);
    await expect(badProjectDetail.json()).resolves.toEqual({
      error: "invalid_project_id"
    });
    expect(badTaskDetail.status).toBe(400);
    await expect(badTaskDetail.json()).resolves.toEqual({
      error: "invalid_task_id"
    });
    expect(badStatusPatch.status).toBe(400);
    await expect(badStatusPatch.json()).resolves.toEqual({
      error: "invalid_task_status_id"
    });
    expect(badTransitionTask.status).toBe(400);
    await expect(badTransitionTask.json()).resolves.toEqual({
      error: "invalid_task_id"
    });
  });

  it("creates a project task, returns it in project detail and My Work, and writes audit", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");
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
        durationWorkingDays: 4,
        plannedWork: 8,
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
    const detail = await app.request("/api/workspace/tasks/task-alpha", {
      headers: { cookie: adminCookie }
    });
    const planningReadModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );

    expect(createdTask.status).toBe(201);
    await expect(createdTask.json()).resolves.toMatchObject({
      task: {
        id: "task-alpha",
        projectId: "project-alpha",
        title: "Подготовить план внедрения",
        durationWorkingDays: 4,
        plannedWork: 8,
        participants: expect.arrayContaining([
          { userId: "user-alpha-executor", role: "executor" },
          { userId: "user-alpha-admin", role: "requester" }
        ])
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
          sourceEntity: { type: "Task", id: "task-alpha" },
          input: expect.objectContaining({
            planningCommands: [
              expect.objectContaining({
                type: "task.create",
                payload: expect.objectContaining({ id: "task-alpha" })
              })
            ]
          })
        })
      ])
    });
    expect(planningReadModel.status).toBe(200);
    await expect(planningReadModel.json()).resolves.toMatchObject({
      planVersion: 2,
      authored: {
        tasks: expect.arrayContaining([
          expect.objectContaining({
            id: "task-alpha",
            title: "Подготовить план внедрения",
            durationMinutes: 1920,
            workMinutes: 480
          })
        ]),
        assignments: expect.arrayContaining([
          expect.objectContaining({
            id: "task-alpha-user-alpha-executor-executor",
            taskId: "task-alpha",
            resourceId: "user-alpha-executor",
            role: "executor"
          })
        ])
      },
      calculatedPlan: {
        tasks: expect.arrayContaining([
          expect.objectContaining({
            id: "task-alpha",
            durationMinutes: 1920,
            calculatedStart: "2026-06-02",
            calculatedFinish: "2026-06-05"
          })
        ])
      }
    });
    await expect(detail.json()).resolves.toMatchObject({
      activities: [
        expect.objectContaining({
          taskId: "task-alpha",
          type: "system",
          title: "Задача создана"
        })
      ]
    });
  });

  it("creates projectless task CRUD records inside the workspace inbox planning project", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");

    const createdTask = await app.request("/api/workspace/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-inbox-alpha",
        title: "Быстрая задача без проекта",
        plannedStart: "2026-07-02",
        plannedFinish: "2026-07-03",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    const createdBody = await createdTask.json();

    expect(createdTask.status).toBe(201);
    expect(createdBody).toMatchObject({
      task: {
        id: "task-inbox-alpha",
        projectId: "workspace-inbox-tenant-alpha",
        title: "Быстрая задача без проекта"
      },
      project: {
        id: "workspace-inbox-tenant-alpha",
        title: "Project Alpha",
        sourceType: "workspace_inbox",
        sourceOpportunityId: null,
        status: "active"
      },
      planVersion: 2
    });

    const secondTask = await app.request("/api/workspace/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-inbox-beta",
        title: "Следующая задача без проекта",
        plannedStart: "2026-08-10",
        plannedFinish: "2026-08-11",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    expect(secondTask.status).toBe(201);

    const inboxRows = await client`
      SELECT id, source_type, source_opportunity_id, planned_start, planned_finish
      FROM projects
      WHERE tenant_id = 'tenant-alpha'
        AND source_type = 'workspace_inbox'
    `;
    expect(inboxRows).toHaveLength(1);
    expect(inboxRows[0]).toMatchObject({
      id: "workspace-inbox-tenant-alpha",
      source_type: "workspace_inbox",
      source_opportunity_id: null
    });
    expect(String(inboxRows[0]?.planned_finish)).toContain("2026-08-11");

    const planningReadModel = await app.request(
      "/api/workspace/projects/workspace-inbox-tenant-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    expect(planningReadModel.status).toBe(200);
    await expect(planningReadModel.json()).resolves.toMatchObject({
      project: {
        sourceType: "workspace_inbox",
        sourceOpportunityId: null
      },
      authored: {
        tasks: expect.arrayContaining([
          expect.objectContaining({ id: "task-inbox-alpha" }),
          expect.objectContaining({ id: "task-inbox-beta" })
        ])
      },
      planVersion: 3
    });

    const myWork = await app.request("/api/workspace/my-work", {
      headers: { cookie: executorCookie }
    });
    expect(myWork.status).toBe(200);
    await expect(myWork.json()).resolves.toMatchObject({
      tasks: expect.arrayContaining([
        expect.objectContaining({
          id: "task-inbox-alpha",
          projectId: "workspace-inbox-tenant-alpha"
        })
      ])
    });
  });

  it("lets an assigned executor transition their task status and writes audit", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");
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
        body: JSON.stringify({ statusId: "task-status-in-progress" })
      }
    );
    const myWork = await app.request("/api/workspace/my-work", {
      headers: { cookie: executorCookie }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    const detail = await app.request("/api/workspace/tasks/task-transition", {
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
    await expect(detail.json()).resolves.toMatchObject({
      activities: expect.arrayContaining([
        expect.objectContaining({
          type: "system",
          title: "Статус задачи изменен",
          body: "Новая -> В работе"
        })
      ])
    });
  });

  it("keeps acceptance-required tasks on review until requester accepts the result", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-acceptance",
        title: "Проверить результат внедрения",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 16,
        requiresAcceptance: true,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    await app.request("/api/workspace/projects/project-alpha/tasks/task-acceptance/status", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: executorCookie
      },
      body: JSON.stringify({ statusId: "task-status-in-progress" })
    });

    const directDone = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-acceptance/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: executorCookie
        },
        body: JSON.stringify({ statusId: "task-status-done" })
      }
    );
    const review = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-acceptance/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: executorCookie
        },
        body: JSON.stringify({ statusId: "task-status-review" })
      }
    );
    const accepted = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-acceptance/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ statusId: "task-status-done" })
      }
    );

    expect(directDone.status).toBe(409);
    await expect(directDone.json()).resolves.toEqual({
      error: "task_acceptance_required"
    });
    expect(review.status).toBe(200);
    await expect(review.json()).resolves.toMatchObject({
      task: { id: "task-acceptance", status: "review" }
    });
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toMatchObject({
      task: { id: "task-acceptance", status: "done", progress: 100 }
    });
  });

  it("manages tenant task statuses and keeps system statuses required", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("executor@kiss-pm.local", "executor12345");

    const initial = await app.request("/api/workspace/task-statuses", {
      headers: { cookie: adminCookie }
    });
    const deniedCreate = await app.request("/api/workspace/task-statuses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: readerCookie
      },
      body: JSON.stringify({
        id: "task-status-client-wait",
        name: "Ждем клиента",
        category: "waiting",
        sortOrder: 35
      })
    });
    const created = await app.request("/api/workspace/task-statuses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-status-client-wait",
        name: "Ждем клиента",
        category: "waiting",
        sortOrder: 35
      })
    });
    const updated = await app.request(
      "/api/workspace/task-statuses/task-status-client-wait",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          name: "Ожидает клиента",
          category: "waiting",
          sortOrder: 36,
          status: "active"
        })
      }
    );
    const archived = await app.request(
      "/api/workspace/task-statuses/task-status-client-wait",
      {
        method: "DELETE",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        }
      }
    );
    const systemArchive = await app.request("/api/workspace/task-statuses/task-status-new", {
      method: "DELETE",
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      }
    });
    const systemPatchArchive = await app.request(
      "/api/workspace/task-statuses/task-status-new",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          name: "Новая",
          category: "new",
          sortOrder: 10,
          status: "archived"
        })
      }
    );

    expect(initial.status).toBe(200);
    await expect(initial.json()).resolves.toMatchObject({
      taskStatuses: expect.arrayContaining([
        expect.objectContaining({ id: "task-status-new", category: "new" }),
        expect.objectContaining({ id: "task-status-done", category: "done" })
      ])
    });
    expect(deniedCreate.status).toBe(403);
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      taskStatus: { id: "task-status-client-wait", category: "waiting", status: "active" }
    });
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({
      taskStatus: { id: "task-status-client-wait", name: "Ожидает клиента" }
    });
    expect(archived.status).toBe(200);
    await expect(archived.json()).resolves.toMatchObject({
      taskStatus: { id: "task-status-client-wait", status: "archived" }
    });
    expect(systemArchive.status).toBe(409);
    await expect(systemArchive.json()).resolves.toEqual({
      error: "system_task_status_required"
    });
    expect(systemPatchArchive.status).toBe(409);
    await expect(systemPatchArchive.json()).resolves.toEqual({
      error: "system_task_status_required"
    });
  });

  it("lets requester accept review tasks without manage permission", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const requesterCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-requester-acceptance",
        title: "Принять результат без manage",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 16,
        requiresAcceptance: true,
        participants: [
          { userId: "user-alpha-executor", role: "requester" },
          { userId: "user-alpha-admin", role: "executor" }
        ]
      })
    });
    await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-requester-acceptance/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ statusId: "task-status-in-progress" })
      }
    );
    await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-requester-acceptance/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ statusId: "task-status-review" })
      }
    );

    const accepted = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-requester-acceptance/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: requesterCookie
        },
        body: JSON.stringify({ statusId: "task-status-done" })
      }
    );
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });

    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toMatchObject({
      task: { id: "task-requester-acceptance", status: "done", progress: 100 }
    });
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "task.status_changed",
          sourceEntity: { type: "Task", id: "task-requester-acceptance" },
          permissionResult: expect.objectContaining({
            authorizationBasis: "task_participant_role",
            participantRole: "requester",
            permission: null
          })
        })
      ])
    });
  });

  it("persists task comments for task participants and blocks unrelated readers", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-commented",
        title: "Обсудить задачу",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-admin", role: "executor" }]
      })
    });

    const deniedComment = await app.request("/api/workspace/tasks/task-commented/comments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: executorCookie
      },
      body: JSON.stringify({ body: "Я не участник этой задачи" })
    });
    const comment = await app.request("/api/workspace/tasks/task-commented/comments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({ body: "Проверил контекст, можно брать в работу." })
    });
    const detail = await app.request("/api/workspace/tasks/task-commented", {
      headers: { cookie: adminCookie }
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });

    expect(deniedComment.status).toBe(403);
    await expect(deniedComment.json()).resolves.toEqual({
      error: "task_participant_required"
    });
    expect(comment.status).toBe(201);
    await expect(comment.json()).resolves.toMatchObject({
      activity: {
        taskId: "task-commented",
        type: "comment",
        body: "Проверил контекст, можно брать в работу."
      }
    });
    await expect(detail.json()).resolves.toMatchObject({
      task: { id: "task-commented" },
      activities: expect.arrayContaining([
        expect.objectContaining({
          type: "comment",
          body: "Проверил контекст, можно брать в работу."
        })
      ])
    });
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "task.comment_created",
          sourceEntity: { type: "Task", id: "task-commented" }
        })
      ])
    });
  });

  it("blocks task field edits and archive for executors without edit/delete permission", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const executorCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-field-guard",
        title: "Проверить права редактирования",
        description: "Исполнитель видит задачу, но не редактирует поля.",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });

    const deniedEdit = await app.request("/api/workspace/tasks/task-field-guard", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: executorCookie
      },
      body: JSON.stringify({
        title: "Исполнитель не должен изменить поля",
        description: "Попытка изменения без tenant.tasks.edit.",
        priority: "high",
        statusId: "task-status-new",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        durationWorkingDays: 4,
        plannedWork: 12,
        requiresAcceptance: false,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    const deniedArchive = await app.request("/api/workspace/tasks/task-field-guard", {
      method: "DELETE",
      headers: {
        "x-kiss-pm-action": "same-origin",
        cookie: executorCookie
      }
    });
    const editVersionResponse = await app.request("/api/workspace/tasks/task-field-guard", {
      headers: { cookie: adminCookie }
    });
    const editVersionBody = await editVersionResponse.json();
    const allowedEdit = await app.request("/api/workspace/tasks/task-field-guard", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify(buildTaskPatchBody({
        title: "Права редактирования проверены",
        description: "Постановщик и администратор могут изменить задачу.",
        priority: "high",
        plannedWork: 12,
        clientUpdatedAt: editVersionBody.task.updatedAt,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      }))
    });
    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });

    expect(deniedEdit.status).toBe(403);
    await expect(deniedEdit.json()).resolves.toEqual({ error: "permission_missing" });
    expect(deniedArchive.status).toBe(403);
    await expect(deniedArchive.json()).resolves.toEqual({ error: "permission_missing" });
    expect(allowedEdit.status).toBe(200);
    await expect(allowedEdit.json()).resolves.toMatchObject({
      task: {
        id: "task-field-guard",
        title: "Права редактирования проверены",
        plannedWork: 12
      }
    });
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "task.updated",
          sourceEntity: { type: "Task", id: "task-field-guard" }
        })
      ])
    });
  });

  it("requires resource manage permission for task PATCH participant assignment changes", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const requesterCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-resource-permission-guard",
        title: "Проверить права ресурсов",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 8,
        participants: [
          { userId: "user-alpha-executor", role: "requester" },
          { userId: "user-alpha-admin", role: "executor" }
        ]
      })
    });
    const detail = await app.request("/api/workspace/tasks/task-resource-permission-guard", {
      headers: { cookie: adminCookie }
    });
    const detailBody = await detail.json();

    const denied = await app.request("/api/workspace/tasks/task-resource-permission-guard", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: requesterCookie
      },
      body: JSON.stringify(buildTaskPatchBody({
        title: "Постановщик пытается сменить ресурсы",
        clientUpdatedAt: detailBody.task.updatedAt,
        participants: [
          { userId: "user-alpha-executor", role: "requester" },
          { userId: "user-alpha-admin", role: "executor" },
          { userId: "user-alpha-manager-only", role: "observer" }
        ]
      }))
    });

    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({ error: "permission_missing" });
  });

  it("rejects stale task PATCH versions before applying planning compatibility commands", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-stale-version",
        title: "Проверить версию задачи",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    const firstDetail = await app.request("/api/workspace/tasks/task-stale-version", {
      headers: { cookie: adminCookie }
    });
    const firstDetailBody = await firstDetail.json();
    const firstUpdate = await app.request("/api/workspace/tasks/task-stale-version", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify(buildTaskPatchBody({
        title: "Версия задачи обновлена",
        plannedWork: 12,
        clientUpdatedAt: firstDetailBody.task.updatedAt
      }))
    });
    const staleUpdate = await app.request("/api/workspace/tasks/task-stale-version", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify(buildTaskPatchBody({
        title: "Старое сохранение",
        clientUpdatedAt: firstDetailBody.task.updatedAt
      }))
    });

    expect(firstUpdate.status).toBe(200);
    expect(staleUpdate.status).toBe(409);
    await expect(staleUpdate.json()).resolves.toEqual({ error: "task_version_conflict" });
  });

  it("rejects stale task PATCH after planning assignment changes", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-stale-assignment",
        title: "Проверить stale assignments",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    await client`
      UPDATE tasks
      SET updated_at = ${"2026-01-01T00:00:00.000Z"}::timestamptz
      WHERE tenant_id = 'tenant-alpha' AND id = 'task-stale-assignment'
    `;
    const staleDetail = await app.request("/api/workspace/tasks/task-stale-assignment", {
      headers: { cookie: adminCookie }
    });
    const staleDetailBody = await staleDetail.json();
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    await dataSource.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      actorUserId: "user-alpha-admin",
      command: {
        type: "assignment.upsert",
        payload: {
          id: "assignment-stale-observer",
          taskId: "task-stale-assignment",
          resourceId: "user-alpha-manager-only",
          role: "observer",
          unitsPermille: 1000,
          workMinutes: 60
        }
      }
    });

    const staleUpdate = await app.request("/api/workspace/tasks/task-stale-assignment", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify(buildTaskPatchBody({
        title: "Старое сохранение участников",
        clientUpdatedAt: staleDetailBody.task.updatedAt
      }))
    });
    const currentDetail = await app.request("/api/workspace/tasks/task-stale-assignment", {
      headers: { cookie: adminCookie }
    });

    expect(staleUpdate.status).toBe(409);
    await expect(staleUpdate.json()).resolves.toEqual({ error: "task_version_conflict" });
    await expect(currentDetail.json()).resolves.toMatchObject({
      task: {
        participants: expect.arrayContaining([
          expect.objectContaining({ userId: "user-alpha-manager-only", role: "observer" })
        ])
      }
    });
  });

  it("requires explicit delete permission to archive requester-owned tasks", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const requesterCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-requester-delete-guard",
        title: "Проверить удаление постановщиком",
        description: "Постановщик может редактировать, но не архивировать без delete.",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 8,
        participants: [
          { userId: "user-alpha-executor", role: "requester" },
          { userId: "user-alpha-admin", role: "executor" }
        ]
      })
    });
    const requesterEditVersionResponse = await app.request(
      "/api/workspace/tasks/task-requester-delete-guard",
      { headers: { cookie: adminCookie } }
    );
    const requesterEditVersionBody = await requesterEditVersionResponse.json();

    const allowedRequesterEdit = await app.request(
      "/api/workspace/tasks/task-requester-delete-guard",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: requesterCookie
        },
        body: JSON.stringify(buildTaskPatchBody({
          title: "Постановщик изменил задачу",
          description: "Редактирование по роли постановщика разрешено.",
          durationWorkingDays: 1,
          clientUpdatedAt: requesterEditVersionBody.task.updatedAt,
          participants: [
            { userId: "user-alpha-executor", role: "requester" },
            { userId: "user-alpha-admin", role: "executor" }
          ]
        }))
      }
    );
    const deniedArchive = await app.request(
      "/api/workspace/tasks/task-requester-delete-guard",
      {
        method: "DELETE",
        headers: {
          "x-kiss-pm-action": "same-origin",
          cookie: requesterCookie
        }
      }
    );

    expect(allowedRequesterEdit.status).toBe(200);
    expect(deniedArchive.status).toBe(403);
    await expect(deniedArchive.json()).resolves.toEqual({ error: "permission_missing" });
  });

  it("lets manage-only actors transition task status without project read permission", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const managerCookie = await loginAs("manager-only@kiss-pm.local", "manager12345");
    await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        id: "task-manager-only-transition",
        title: "Проверить manage-only переход",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-05",
        plannedWork: 8,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });

    const transitioned = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-manager-only-transition/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: managerCookie
        },
        body: JSON.stringify({ statusId: "task-status-in-progress" })
      }
    );

    expect(transitioned.status).toBe(200);
    await expect(transitioned.json()).resolves.toMatchObject({
      task: { id: "task-manager-only-transition", status: "in_progress" }
    });
  });

  it("denies task status transition for non-participant readers", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("executor@kiss-pm.local", "executor12345");
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
        body: JSON.stringify({ statusId: "task-status-done" })
      }
    );

    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({
      error: "task_participant_role_required"
    });
  });

  it("denies task status transition for observer participants", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const observerCookie = await loginAs("executor@kiss-pm.local", "executor12345");
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
        body: JSON.stringify({ statusId: "task-status-in-progress" })
      }
    );

    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({
      error: "task_participant_role_required"
    });
  });

  it("rejects unsupported task statuses", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
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
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
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
        body: JSON.stringify({ statusId: "task-status-in-progress" })
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
        body: JSON.stringify({ statusId: "task-status-done" })
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
        body: JSON.stringify({ statusId: "task-status-in-progress" })
      }
    );

    expect(rollback.status).toBe(409);
    await expect(rollback.json()).resolves.toEqual({
      error: "task_status_transition_not_allowed"
    });
  });

  it("requires same-origin action header for task status transitions", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");

    const denied = await app.request(
      "/api/workspace/projects/project-alpha/tasks/task-any/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: adminCookie
        },
        body: JSON.stringify({ statusId: "task-status-in-progress" })
      }
    );

    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({
      error: "same_origin_action_required"
    });
  });

  it("enforces project read and manage permissions", async () => {
    const readerCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    const deniedCookie = await loginAs("denied@kiss-pm.local", "denied12345");
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
