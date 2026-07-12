import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  createTenantAdminSeedProfile,
  seedTenantDataset,
  type PostgresClient,
  type PostgresTenantDataSource,
  type SeedTenantDataset
} from "@kiss-pm/persistence";
import { createHash } from "node:crypto";

import { createApp } from "./app";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("planningRoutes.db.test requires an explicit disposable DATABASE_URL");
}

const dataset: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа Проект" }],
  accessProfiles: [
    createTenantAdminSeedProfile({
      id: "access-profile-admin",
      tenantId: "tenant-alpha"
    }),
    {
      id: "access-profile-reader",
      tenantId: "tenant-alpha",
      name: "Наблюдатель планирования",
      permissions: ["tenant.projects.read", "tenant.project_plan.read", "tenant.project_resources.read"]
    },
    {
      id: "access-profile-plan-reader-no-resources",
      tenantId: "tenant-alpha",
      name: "Наблюдатель плана без ресурсов",
      permissions: ["tenant.projects.read", "tenant.project_plan.read", "tenant.planning_scenarios.preview"]
    },
    {
      id: "access-profile-plan-manager-no-read",
      tenantId: "tenant-alpha",
      name: "Менеджер плана без чтения",
      permissions: ["tenant.project_plan.manage"]
    },
    {
      id: "access-profile-scenario-operator-no-read",
      tenantId: "tenant-alpha",
      name: "Оператор сценариев без чтения",
      permissions: ["tenant.planning_scenarios.preview", "tenant.planning_scenarios.apply"]
    },
    {
      id: "access-profile-plan-manager-no-resource-manage",
      tenantId: "tenant-alpha",
      name: "Менеджер плана без управления ресурсами",
      permissions: [
        "tenant.projects.read",
        "tenant.project_plan.read",
        "tenant.project_resources.read",
        "tenant.project_plan.manage"
      ]
    },
    {
      id: "access-profile-resource-manager-no-plan-manage",
      tenantId: "tenant-alpha",
      name: "Ресурсный менеджер без управления планом",
      permissions: [
        "tenant.projects.read",
        "tenant.project_plan.read",
        "tenant.project_resources.read",
        "tenant.project_resources.manage"
      ]
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
      id: "user-alpha-plan-reader-no-resources",
      tenantId: "tenant-alpha",
      email: "plan-reader-no-resources@kiss-pm.local",
      name: "Никита Без Ресурсов",
      accessProfileId: "access-profile-plan-reader-no-resources",
      positionId: "position-engineer",
      password: "reader12345"
    },
    {
      id: "user-alpha-plan-manager-no-read",
      tenantId: "tenant-alpha",
      email: "plan-manager-no-read@kiss-pm.local",
      name: "Марина Без Чтения",
      accessProfileId: "access-profile-plan-manager-no-read",
      positionId: "position-manager",
      password: "manager12345"
    },
    {
      id: "user-alpha-scenario-no-read",
      tenantId: "tenant-alpha",
      email: "scenario-no-read@kiss-pm.local",
      name: "Семен Без Чтения",
      accessProfileId: "access-profile-scenario-operator-no-read",
      positionId: "position-manager",
      password: "scenario12345"
    },
    {
      id: "user-alpha-plan-manager-no-resource-manage",
      tenantId: "tenant-alpha",
      email: "plan-manager-no-resource-manage@kiss-pm.local",
      name: "Павел Без Ресурсов",
      accessProfileId: "access-profile-plan-manager-no-resource-manage",
      positionId: "position-manager",
      password: "planmanager12345"
    },
    {
      id: "user-alpha-resource-manager-no-plan",
      tenantId: "tenant-alpha",
      email: "resource-manager-no-plan@kiss-pm.local",
      name: "Роман Без Плана",
      accessProfileId: "access-profile-resource-manager-no-plan-manage",
      positionId: "position-manager",
      password: "resourcemanager12345"
    }
  ]
};

describe("planning API routes", () => {
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
      contractValue: 1_000_000,
      plannedHourlyRate: 5_000,
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

  async function createTask(cookie: string, input: {
    id: string;
    title: string;
    start: string;
    finish: string;
    plannedWork?: number;
  }) {
    const response = await app.request("/api/workspace/projects/project-alpha/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({
        id: input.id,
        title: input.title,
        plannedStart: input.start,
        plannedFinish: input.finish,
        plannedWork: input.plannedWork ?? 16,
        participants: [{ userId: "user-alpha-executor", role: "executor" }]
      })
    });
    expect(response.status).toBe(201);
  }

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, products, contacts, clients, project_types, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-21T00:00:00.000Z")
    );
    await createActiveProject();
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, crm_pipeline_stage_automation_definitions, crm_pipeline_transition_rules, crm_pipeline_stages, crm_pipelines, products, contacts, clients, project_types, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it.each(["draft", "paused", "closed", "cancelled"] as const)(
    "denies planning read, preview, apply, and batch endpoints for a %s project",
    async (projectStatus) => {
      const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
      await createTask(adminCookie, {
        id: "task-inactive-project",
        title: "Lifecycle guard",
        start: "2026-06-02",
        finish: "2026-06-03"
      });
      const activeRead = await app.request(
        "/api/workspace/projects/project-alpha/planning/read-model",
        { headers: { cookie: adminCookie } }
      );
      expect(activeRead.status).toBe(200);
      const planVersion = (await activeRead.json()).planVersion as number;
      const command = {
        type: "task.update_progress",
        payload: { taskId: "task-inactive-project", percentComplete: 42 }
      };
      const headers = {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      };
      const beforeState = await client`
        SELECT
          (SELECT version FROM plan_versions
            WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS plan_version,
          (SELECT progress FROM tasks
            WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha'
              AND id = 'task-inactive-project') AS task_progress,
          (SELECT count(*)::int FROM audit_events
            WHERE tenant_id = 'tenant-alpha' AND source_entity ->> 'id' = 'project-alpha') AS audit_count,
          (SELECT count(*)::int FROM planning_command_idempotency_keys
            WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS idempotency_count
      `;

      await client`
        UPDATE projects
        SET status = ${projectStatus}
        WHERE tenant_id = 'tenant-alpha' AND id = 'project-alpha'
      `;

      const requests = [
        app.request("/api/workspace/projects/project-alpha/planning/read-model", {
          headers: { cookie: adminCookie }
        }),
        app.request("/api/workspace/projects/project-alpha/planning/preview-command", {
          method: "POST",
          headers,
          body: JSON.stringify({ command, clientPlanVersion: planVersion })
        }),
        app.request("/api/workspace/projects/project-alpha/planning/preview-command-batch", {
          method: "POST",
          headers,
          body: JSON.stringify({ commands: [command], clientPlanVersion: planVersion })
        }),
        app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
          method: "POST",
          headers,
          body: JSON.stringify({
            command,
            clientPlanVersion: planVersion,
            idempotencyKey: `inactive-single-${projectStatus}`
          })
        }),
        app.request("/api/workspace/projects/project-alpha/planning/apply-command-batch", {
          method: "POST",
          headers,
          body: JSON.stringify({
            commands: [command],
            clientPlanVersion: planVersion,
            idempotencyKey: `inactive-batch-${projectStatus}`
          })
        })
      ];

      for (const response of await Promise.all(requests)) {
        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: "project_not_found" });
      }

      const afterState = await client`
        SELECT
          (SELECT version FROM plan_versions
            WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS plan_version,
          (SELECT progress FROM tasks
            WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha'
              AND id = 'task-inactive-project') AS task_progress,
          (SELECT count(*)::int FROM audit_events
            WHERE tenant_id = 'tenant-alpha' AND source_entity ->> 'id' = 'project-alpha') AS audit_count,
          (SELECT count(*)::int FROM planning_command_idempotency_keys
            WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS idempotency_count
      `;
      expect(afterState[0]).toEqual(beforeState[0]);
    }
  );

  it("rejects unsafe persisted IDs from direct planning apply before database writes", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const before = await client`
      SELECT
        (SELECT version FROM plan_versions
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS version,
        (SELECT count(*)::int FROM tasks
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS task_count,
        (SELECT count(*)::int FROM task_assignments
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS assignment_count,
        (SELECT count(*)::int FROM plan_accepted_overloads
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS accepted_overload_count,
        (SELECT count(*)::int FROM audit_events
          WHERE tenant_id = 'tenant-alpha' AND source_entity ->> 'id' = 'project-alpha') AS audit_count,
        (SELECT count(*)::int FROM planning_command_idempotency_keys
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS idempotency_count
    `;
    const clientPlanVersion = Number(before[0]?.version);
    const commands = [
      ...["\ud800", "\ufffd", " task-safe "].flatMap((unsafeId) => [
        {
          type: "task.create",
          payload: {
            id: unsafeId,
            projectId: "project-alpha",
            title: "Unsafe direct task",
            statusId: "task-status-new",
            plannedStart: "2026-06-01",
            plannedFinish: "2026-06-02",
            durationMinutes: 480,
            workMinutes: 480,
            assignments: []
          }
        },
        {
          type: "assignment.upsert",
          payload: {
            id: unsafeId,
            taskId: "task-alpha",
            resourceId: "user-alpha-executor",
            role: "executor",
            unitsPermille: 1000,
            workMinutes: null
          }
        }
      ]),
      {
        type: "risk.accept_overload",
        payload: {
          overloadId: "user-alpha-executor:2026-02-30",
          acceptedRiskReason: "impossible date"
        }
      }
    ];

    for (const [index, command] of commands.entries()) {
      const response = await app.request(
        "/api/workspace/projects/project-alpha/planning/apply-command",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-kiss-pm-action": "same-origin",
            cookie: adminCookie
          },
          body: JSON.stringify({
            command,
            clientPlanVersion,
            idempotencyKey: `unsafe-boundary-${index}`
          })
        }
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "planning_command_invalid"
      });
    }

    const after = await client`
      SELECT
        (SELECT version FROM plan_versions
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS version,
        (SELECT count(*)::int FROM tasks
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS task_count,
        (SELECT count(*)::int FROM task_assignments
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS assignment_count,
        (SELECT count(*)::int FROM plan_accepted_overloads
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS accepted_overload_count,
        (SELECT count(*)::int FROM audit_events
          WHERE tenant_id = 'tenant-alpha' AND source_entity ->> 'id' = 'project-alpha') AS audit_count,
        (SELECT count(*)::int FROM planning_command_idempotency_keys
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS idempotency_count
    `;
    expect(after[0]).toEqual(before[0]);
  });

  it.each(["single", "batch"] as const)(
    "rolls back task, version, audit, and idempotency when post-write readback is missing for %s apply",
    async (applyMode) => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-readback-rollback",
      title: "Readback rollback",
      start: "2026-06-02",
      finish: "2026-06-03"
    });
    const initialRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    expect(initialRead.status).toBe(200);
    const planVersion = (await initialRead.json()).planVersion as number;
    const beforeState = await client`
      SELECT
        (SELECT planned_start::text FROM tasks
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha'
            AND id = 'task-readback-rollback') AS planned_start,
        (SELECT planned_finish::text FROM tasks
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha'
            AND id = 'task-readback-rollback') AS planned_finish,
        (SELECT version FROM plan_versions
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS plan_version,
        (SELECT count(*)::int FROM audit_events
          WHERE tenant_id = 'tenant-alpha' AND source_entity ->> 'id' = 'project-alpha') AS audit_count,
        (SELECT count(*)::int FROM planning_command_idempotency_keys
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS idempotency_count
    `;

    const baseDataSource = createPostgresTenantDataSource(createDatabase(client));
    const faultInjectedDataSource: PostgresTenantDataSource = {
      ...baseDataSource,
      async withTransaction<T>(
        operation: (transactionDataSource: PostgresTenantDataSource) => Promise<T>
      ): Promise<T> {
        return baseDataSource.withTransaction(async (transactionDataSource) => {
          let snapshotReadCount = 0;
          return operation({
            ...transactionDataSource,
            async getPlanSnapshot(tenantId, projectId) {
              snapshotReadCount += 1;
              if (snapshotReadCount === 2) return undefined;
              return transactionDataSource.getPlanSnapshot(tenantId, projectId);
            }
          });
        });
      }
    };
    const faultInjectedApp = createApp({ dataSource: faultInjectedDataSource });
    const command = {
      type: "task.update_schedule",
      payload: {
        taskId: "task-readback-rollback",
        plannedStart: "2026-06-10",
        plannedFinish: "2026-06-12"
      }
    };
    const response = await faultInjectedApp.request(
      `/api/workspace/projects/project-alpha/planning/apply-command${applyMode === "batch" ? "-batch" : ""}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          ...(applyMode === "batch" ? { commands: [command] } : { command }),
          clientPlanVersion: planVersion,
          idempotencyKey: `post-write-readback-rollback-${applyMode}`
        })
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "project_not_found" });
    const afterState = await client`
      SELECT
        (SELECT planned_start::text FROM tasks
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha'
            AND id = 'task-readback-rollback') AS planned_start,
        (SELECT planned_finish::text FROM tasks
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha'
            AND id = 'task-readback-rollback') AS planned_finish,
        (SELECT version FROM plan_versions
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS plan_version,
        (SELECT count(*)::int FROM audit_events
          WHERE tenant_id = 'tenant-alpha' AND source_entity ->> 'id' = 'project-alpha') AS audit_count,
        (SELECT count(*)::int FROM planning_command_idempotency_keys
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS idempotency_count
    `;
    expect(afterState[0]).toEqual(beforeState[0]);
    }
  );

  it.each([
    ["single command", "/api/workspace/projects/project-alpha/planning/apply-command", false],
    ["command batch", "/api/workspace/projects/project-alpha/planning/apply-command-batch", true],
    [
      "scenario apply",
      "/api/workspace/projects/project-alpha/planning/scenario-proposals/planning-scenario-missing/apply",
      null
    ]
  ] as const)("fails %s closed when the planning lock is unavailable", async (_label, path, batch) => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-lock-required",
      title: "Planning lock required",
      start: "2026-06-01",
      finish: "2026-06-02"
    });
    const before = await client`
      SELECT
        (SELECT version FROM plan_versions
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS version,
        (SELECT progress FROM tasks
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha'
            AND id = 'task-lock-required') AS progress
    `;
    const planVersion = Number(before[0]?.version);
    const command = {
      type: "task.update_progress",
      payload: { taskId: "task-lock-required", percentComplete: 42 }
    };
    const baseDataSource = createPostgresTenantDataSource(createDatabase(client));
    const noLockDataSource: PostgresTenantDataSource = {
      ...baseDataSource,
      async withTransaction<T>(
        operation: (transactionDataSource: PostgresTenantDataSource) => Promise<T>
      ): Promise<T> {
        return baseDataSource.withTransaction(async (transactionDataSource) => {
          const transactionWithoutLock = { ...transactionDataSource };
          Reflect.deleteProperty(transactionWithoutLock, "lockTenantResourcePlanning");
          return operation(transactionWithoutLock as PostgresTenantDataSource);
        });
      }
    };
    const noLockApp = createApp({ dataSource: noLockDataSource });
    const response = await noLockApp.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        ...(batch === true ? { commands: [command] } : batch === false ? { command } : {}),
        clientPlanVersion: planVersion
      })
    });

    const responseBody = await response.json();
    expect({ status: response.status, body: responseBody }).toEqual({
      status: 501,
      body: { error: "persistence_not_configured" }
    });
    const after = await client`
      SELECT
        (SELECT version FROM plan_versions
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha') AS version,
        (SELECT progress FROM tasks
          WHERE tenant_id = 'tenant-alpha' AND project_id = 'project-alpha'
            AND id = 'task-lock-required') AS progress
    `;
    expect(after[0]).toEqual(before[0]);
  });

  it("exposes task CRUD records through planning read-model and applies dependency commands with versioned audit", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    const planOnlyReaderCookie = await loginAs("plan-reader-no-resources@kiss-pm.local", "reader12345");
    await createTask(adminCookie, {
      id: "task-plan-a",
      title: "Подготовить план",
      start: "2026-06-01",
      finish: "2026-06-03"
    });
    await createTask(adminCookie, {
      id: "task-plan-b",
      title: "Согласовать план",
      start: "2026-06-04",
      finish: "2026-06-05"
    });
    await createTask(adminCookie, {
      id: "task-plan-overload",
      title: "Перегруженная настройка",
      start: "2026-06-08",
      finish: "2026-06-08",
      plannedWork: 40
    });

    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const readerReadModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: readerCookie } }
    );
    const planOnlyReadModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: planOnlyReaderCookie } }
    );
    const initialBody = await readModel.json();

    expect(readModel.status).toBe(200);
    expect(readerReadModel.status).toBe(200);
    expect(planOnlyReadModel.status).toBe(200);
    const planOnlyBody = await planOnlyReadModel.json();
    expect(planOnlyBody.authored.tasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "task-plan-a" })])
    );
    expect(initialBody).toMatchObject({
      authored: {
        tasks: expect.arrayContaining([
          expect.objectContaining({ id: "task-plan-a", title: "Подготовить план" }),
          expect.objectContaining({ id: "task-plan-b", title: "Согласовать план" })
        ]),
        dependencies: []
      },
      planVersion: 4,
      engineVersion: "planning-core-v1"
    });
    expect(initialBody.resourceLoad.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: "user-alpha-executor",
          taskIds: expect.arrayContaining(["task-plan-a"])
        })
      ])
    );
    // read-model отдаёт производственный календарь(и) и исключения top-level (контракт = mock-бэкенду)
    expect(initialBody.calendars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workingWeekdays: expect.any(Array),
          workingMinutesPerDay: expect.any(Number)
        })
      ])
    );
    expect(initialBody.calendarExceptions).toEqual(expect.any(Array));

    const command = {
      type: "dependency.upsert",
      payload: {
        id: "dep-plan-a-b",
        predecessorTaskId: "task-plan-a",
        successorTaskId: "task-plan-b",
        dependencyType: "FS",
        lagMinutes: 0
      }
    };

    const preview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ command, clientPlanVersion: initialBody.planVersion })
      }
    );
    const afterPreviewRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const previewBody = await preview.json();
    const afterPreviewBody = await afterPreviewRead.json();

    expect(preview.status).toBe(200);
    expect(previewBody.after.authored.dependencies).toEqual([
      expect.objectContaining({ id: "dep-plan-a-b", type: "FS" })
    ]);
    expect(afterPreviewBody).toMatchObject({
      authored: { dependencies: [] },
      planVersion: initialBody.planVersion
    });

    const deniedApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: readerCookie
        },
        body: JSON.stringify({ command, clientPlanVersion: initialBody.planVersion })
      }
    );
    expect(deniedApply.status).toBe(403);
    await expect(deniedApply.json()).resolves.toEqual({ error: "permission_missing" });

    const applied = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command,
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "planning-test-1"
        })
      }
    );
    const appliedBody = await applied.json();

    expect(applied.status).toBe(200);
    expect(appliedBody).toMatchObject({
      newPlanVersion: 5,
      auditEventId: expect.stringMatching(/^audit-/),
      readModel: {
        authored: {
          dependencies: [
            expect.objectContaining({
              id: "dep-plan-a-b",
              predecessorTaskId: "task-plan-a",
              successorTaskId: "task-plan-b"
            })
          ]
        },
        planVersion: 5
      }
    });

    const retried = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command,
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "planning-test-1"
        })
      }
    );
    const retriedBody = await retried.json();

    expect(retried.status).toBe(200);
    expect(retriedBody).toEqual(appliedBody);

    const idempotencyConflict = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            ...command,
            payload: { ...command.payload, id: "dep-plan-a-b-conflicting-retry" }
          },
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "planning-test-1"
        })
      }
    );

    expect(idempotencyConflict.status).toBe(409);
    await expect(idempotencyConflict.json()).resolves.toEqual({
      error: "idempotency_key_conflict"
    });

    const stale = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            ...command,
            payload: { ...command.payload, id: "dep-plan-a-b-stale" }
          },
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      error: "plan_version_conflict",
      currentPlanVersion: 5
    });

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    expect(audit.status).toBe(200);
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "planning.command_denied",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: "project-alpha" }
        }),
        expect.objectContaining({
          actionType: "planning.dependency.upserted",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: "project-alpha" },
          afterState: expect.objectContaining({ planVersion: 5 })
        }),
        expect.objectContaining({
          actionType: "planning.command_conflict",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: "project-alpha" }
        })
      ])
    });

    const assignmentApplied = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "assignment.upsert",
            payload: {
              id: "assignment-plan-overload",
              taskId: "task-plan-overload",
              resourceId: "user-alpha-executor",
              role: "executor",
              unitsPermille: 1000,
              workMinutes: 4_800
            }
          },
          clientPlanVersion: appliedBody.newPlanVersion
        })
      }
    );
    expect(assignmentApplied.status).toBe(200);
    const assignmentAppliedBody = await assignmentApplied.json();
    expect(assignmentAppliedBody.newPlanVersion).toBe(6);

    const overload = assignmentAppliedBody.readModel.resourceLoad.overloads.find(
      (candidate: { resourceId: string; date: string; taskIds: string[] }) =>
        candidate.resourceId === "user-alpha-executor" &&
        candidate.taskIds.includes("task-plan-overload")
    );
    expect(overload).toBeTruthy();
    expect(overload).toMatchObject({
      taskIds: expect.arrayContaining(["task-plan-overload"]),
      assignmentIds: expect.arrayContaining(["assignment-plan-overload"]),
      reasons: expect.arrayContaining([
        { type: "task", id: "task-plan-overload" },
        { type: "assignment", id: "assignment-plan-overload" }
      ])
    });

    const scenarioPreviewRequest = {
      clientPlanVersion: assignmentAppliedBody.newPlanVersion,
      target: {
        type: "resource_overload",
        resourceId: overload.resourceId,
        date: overload.date,
        overloadMinutes: overload.overloadMinutes,
        taskIds: overload.taskIds
      }
    };
    const scenarioPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const scenarioPreviewBody = await scenarioPreview.json();
    expect(scenarioPreview.status).toBe(200);
    expect(scenarioPreviewBody).toMatchObject({
      planVersion: assignmentAppliedBody.newPlanVersion,
      proposals: expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^planning-scenario-/),
          planDelta: expect.objectContaining({
            commands: expect.any(Array)
          })
        })
      ])
    });

    const deniedScenarioApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${scenarioPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: readerCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(deniedScenarioApply.status).toBe(403);
    await expect(deniedScenarioApply.json()).resolves.toEqual({ error: "permission_missing" });

    const missingRiskReasonApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${scenarioPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(missingRiskReasonApply.status).toBe(400);
    await expect(missingRiskReasonApply.json()).resolves.toEqual({
      error: "accepted_risk_reason_required"
    });

    const missingScenarioApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals/planning-scenario-missing/apply",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(missingScenarioApply.status).toBe(404);
    await expect(missingScenarioApply.json()).resolves.toEqual({
      error: "scenario_not_found"
    });

    const expiredPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const expiredPreviewBody = await expiredPreview.json();
    await client`
      UPDATE planning_scenario_runs
      SET expires_at = '2026-05-21T00:00:00.000Z'
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${expiredPreviewBody.proposals[0].id}
    `;
    const expiredApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${expiredPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(expiredApply.status).toBe(409);
    await expect(expiredApply.json()).resolves.toEqual({
      error: "scenario_expired"
    });

    const engineMismatchPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const engineMismatchPreviewBody = await engineMismatchPreview.json();
    expect(engineMismatchPreview.status).toBe(200);
    await client`
      UPDATE planning_scenario_runs
      SET engine_version = 'planning-core-v0'
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${engineMismatchPreviewBody.proposals[0].id}
    `;
    const engineMismatchApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${engineMismatchPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(engineMismatchApply.status).toBe(409);
    await expect(engineMismatchApply.json()).resolves.toMatchObject({
      error: "planning_scenario_engine_mismatch"
    });

    const targetMismatchPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const targetMismatchPreviewBody = await targetMismatchPreview.json();
    expect(targetMismatchPreview.status).toBe(200);
    const corruptedTarget = {
      type: "resource_overload",
      resourceId: overload.resourceId,
      date: overload.date,
      overloadMinutes: overload.overloadMinutes + 1,
      taskIds: overload.taskIds
    };
    await client`
      UPDATE planning_scenario_runs
      SET target_conflict = ${JSON.stringify(corruptedTarget)}::jsonb
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${targetMismatchPreviewBody.proposals[0].id}
    `;
    const targetMismatchApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${targetMismatchPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    expect(targetMismatchApply.status).toBe(409);
    await expect(targetMismatchApply.json()).resolves.toMatchObject({
      error: "planning_scenario_target_mismatch"
    });

    const invalidCommandPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify(scenarioPreviewRequest)
      }
    );
    const invalidCommandPreviewBody = await invalidCommandPreview.json();
    expect(invalidCommandPreview.status).toBe(200);
    const invalidCommandProposal = {
      ...invalidCommandPreviewBody.proposals[0],
      planDelta: {
        ...invalidCommandPreviewBody.proposals[0].planDelta,
        commands: [
          {
            type: "dependency.upsert",
            payload: {
              id: "dep-scenario-self",
              predecessorTaskId: "task-plan-overload",
              successorTaskId: "task-plan-overload",
              dependencyType: "FS",
              lagMinutes: 0
            }
          }
        ],
        changedTaskIds: [],
        changedAssignmentIds: [],
        changedDependencyIds: ["dep-scenario-self"],
        acceptedRiskIds: []
      }
    };
    await client`
      UPDATE planning_scenario_runs
      SET proposal_payload = ${JSON.stringify(invalidCommandProposal)}::jsonb,
          proposal_payload_hash = ${hashJson(invalidCommandProposal)}
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${invalidCommandProposal.id}
    `;
    const invalidCommandApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${invalidCommandProposal.id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ clientPlanVersion: assignmentAppliedBody.newPlanVersion })
      }
    );
    const invalidCommandApplyBody = await invalidCommandApply.json();
    expect(invalidCommandApply.status).toBe(409);
    expect(invalidCommandApplyBody).toMatchObject({
      error: "planning_precondition_failed",
      validationIssues: [
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
      ]
    });
    const invalidScenarioRows = await client`
      SELECT applied_at
      FROM planning_scenario_runs
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${invalidCommandProposal.id}
    `;
    expect(invalidScenarioRows[0]?.applied_at).toBeNull();
    const afterInvalidScenarioRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    await expect(afterInvalidScenarioRead.json()).resolves.toMatchObject({
      planVersion: assignmentAppliedBody.newPlanVersion,
      authored: {
        dependencies: [
          expect.objectContaining({
            id: "dep-plan-a-b"
          })
        ]
      }
    });

    const scenarioApply = await app.request(
      `/api/workspace/projects/project-alpha/planning/scenario-proposals/${scenarioPreviewBody.proposals[0].id}/apply`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          clientPlanVersion: assignmentAppliedBody.newPlanVersion,
          acceptedRiskReason: "Перегруз принят руководителем проекта до ресурсного комитета"
        })
      }
    );
    expect(scenarioApply.status).toBe(200);
    await expect(scenarioApply.json()).resolves.toMatchObject({
      scenarioRunId: scenarioPreviewBody.proposals[0].id,
      newPlanVersion: 7,
      auditEventId: expect.stringMatching(/^audit-/),
      readModel: { planVersion: 7 }
    });

    const scenarioAudit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    await expect(scenarioAudit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "planning.scenario.previewed",
          sourceWorkflow: "planning"
        }),
        expect.objectContaining({
          actionType: "planning.scenario_denied",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: "project-alpha" }
        }),
        expect.objectContaining({
          actionType: "planning.scenario.applied",
          sourceWorkflow: "planning",
          input: expect.objectContaining({
            acceptedRiskReason: "Перегруз принят руководителем проекта до ресурсного комитета"
          }),
          afterState: expect.objectContaining({ planVersion: 7 })
        })
      ])
    });
  });

  it("requires resource management permission when task creation includes assignments", async () => {
    const limitedManagerCookie = await loginAs(
      "plan-manager-no-resource-manage@kiss-pm.local",
      "planmanager12345"
    );
    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: limitedManagerCookie } }
    );
    const readModelBody = await readModel.json();
    expect(readModel.status).toBe(200);

    const command = {
      type: "task.create",
      payload: {
        id: "task-create-with-assignment",
        projectId: "project-alpha",
        title: "Создать задачу с назначением",
        statusId: "task-status-new",
        plannedStart: "2026-06-10",
        plannedFinish: "2026-06-11",
        durationMinutes: 960,
        workMinutes: 960,
        assignments: [
          {
            id: "assignment-created-with-task",
            resourceId: "user-alpha-executor",
            role: "executor",
            unitsPermille: 1000,
            workMinutes: 960
          }
        ]
      }
    };

    const deniedPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: limitedManagerCookie
        },
        body: JSON.stringify({ command, clientPlanVersion: readModelBody.planVersion })
      }
    );
    expect(deniedPreview.status).toBe(403);
    await expect(deniedPreview.json()).resolves.toMatchObject({ error: "permission_missing" });

    const deniedApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: limitedManagerCookie
        },
        body: JSON.stringify({ command, clientPlanVersion: readModelBody.planVersion })
      }
    );
    expect(deniedApply.status).toBe(403);
    await expect(deniedApply.json()).resolves.toEqual({ error: "permission_missing" });
  });

  // Регресс BUG-PROJ-01: task.create с неизвестным statusId ("todo") не падает 409 —
  // сервер подставляет начальный статус тенанта (категория "new").
  it("normalizes an unknown task.create statusId to the tenant initial status", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const readModelBody = await readModel.json();

    const command = {
      type: "task.create",
      payload: {
        id: "task-status-normalized",
        projectId: "project-alpha",
        parentTaskId: null,
        title: "Задача без валидного статуса",
        statusId: "todo", // не существует в тенанте (реальные — task-status-*)
        plannedStart: null,
        plannedFinish: null,
        durationMinutes: 480,
        workMinutes: 480,
        assignments: []
      }
    };

    const applied = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ command, clientPlanVersion: readModelBody.planVersion })
      }
    );
    expect(applied.status).toBe(200);

    // созданная задача получила начальный статус (task-status-new), а не "todo"
    const after = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const afterBody = await after.json();
    const created = (afterBody.authored.tasks as Array<{ id: string; statusId: string }>).find(
      (t) => t.id === "task-status-normalized"
    );
    expect(created).toBeDefined();
    expect(created?.statusId).toBe("task-status-new");
  });

  // Регресс BUG-PROJ-03: task.update_progress СОХРАНЯЕТ percentComplete (раньше
  // персистенция не имела case для команды → значение молча терялось при 200).
  it("persists task.update_progress percentComplete", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = { "content-type": "application/json", "x-kiss-pm-action": "same-origin", cookie: adminCookie };
    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const v0 = (await readModel.json()).planVersion;

    // создаём задачу с трудоёмкостью
    const created = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers,
      body: JSON.stringify({
        command: {
          type: "task.create",
          payload: {
            id: "task-progress-persist",
            projectId: "project-alpha",
            parentTaskId: null,
            title: "Задача для проверки прогресса",
            statusId: "task-status-new",
            plannedStart: "2026-06-10",
            plannedFinish: "2026-06-11",
            durationMinutes: 480,
            workMinutes: 480,
            assignments: []
          }
        },
        clientPlanVersion: v0
      })
    });
    expect(created.status).toBe(200);
    const v1 = (await created.json()).newPlanVersion;

    // обновляем прогресс
    const applied = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers,
      body: JSON.stringify({
        command: { type: "task.update_progress", payload: { taskId: "task-progress-persist", percentComplete: 42 } },
        clientPlanVersion: v1
      })
    });
    expect(applied.status).toBe(200);

    // percentComplete сохранился в read-model
    const after = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const afterBody = await after.json();
    const updated = (afterBody.authored.tasks as Array<{ id: string; percentComplete: number }>).find(
      (t) => t.id === "task-progress-persist"
    );
    expect(updated?.percentComplete).toBe(42);
  });

  // Регресс BUG-PROJ-24: revert-last откатывает последний обратимый коммит
  // компенсирующими командами (значение восстанавливается).
  it("reverts the last planning commit via compensating commands", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = { "content-type": "application/json", "x-kiss-pm-action": "same-origin", cookie: adminCookie };
    const rm0 = await app.request("/api/workspace/projects/project-alpha/planning/read-model", { headers: { cookie: adminCookie } });
    const v0 = (await rm0.json()).planVersion;

    const created = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers,
      body: JSON.stringify({
        command: {
          type: "task.create",
          payload: { id: "task-revert", projectId: "project-alpha", parentTaskId: null, title: "Откат", statusId: "task-status-new", plannedStart: "2026-06-10", plannedFinish: "2026-06-11", durationMinutes: 480, workMinutes: 480, assignments: [] }
        },
        clientPlanVersion: v0
      })
    });
    const v1 = (await created.json()).newPlanVersion;

    // меняем прогресс 0 → 55
    const upd = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers,
      body: JSON.stringify({
        command: { type: "task.update_progress", payload: { taskId: "task-revert", percentComplete: 55 } },
        clientPlanVersion: v1
      })
    });
    expect(upd.status).toBe(200);
    const updBody = await upd.json();

    // откат выбранного коммита → прогресс возвращается к 0
    const revert = await app.request("/api/workspace/projects/project-alpha/planning/revert-last", {
      method: "POST",
      headers,
      body: JSON.stringify({
        targetCommitId: updBody.auditEventId,
        clientPlanVersion: updBody.newPlanVersion,
        idempotencyKey: "planning-revert-regression"
      })
    });
    expect(revert.status).toBe(200);

    const after = await app.request("/api/workspace/projects/project-alpha/planning/read-model", { headers: { cookie: adminCookie } });
    const afterBody = await after.json();
    const task = (afterBody.authored.tasks as Array<{ id: string; percentComplete: number }>).find((t) => t.id === "task-revert");
    expect(task?.percentComplete).toBe(0);
  });

  // GET /planning/commits не раздувается: полные compensatingCommands несёт только
  // последнее succeeded planning-событие (единственное обратимое через revert-last);
  // у прежних событий остаётся флаг hasCompensatingCommands при пустом массиве.
  it("returns full compensating commands only for the latest succeeded planning commit", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const headers = { "content-type": "application/json", "x-kiss-pm-action": "same-origin", cookie: adminCookie };
    const rm0 = await app.request("/api/workspace/projects/project-alpha/planning/read-model", { headers: { cookie: adminCookie } });
    const v0 = (await rm0.json()).planVersion;

    const created = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers,
      body: JSON.stringify({
        command: {
          type: "task.create",
          payload: { id: "task-commits-cap", projectId: "project-alpha", parentTaskId: null, title: "Кап истории", statusId: "task-status-new", plannedStart: "2026-06-10", plannedFinish: "2026-06-11", durationMinutes: 480, workMinutes: 480, assignments: [] }
        },
        clientPlanVersion: v0
      })
    });
    expect(created.status).toBe(200);
    const v1 = (await created.json()).newPlanVersion;

    const firstUpdate = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers,
      body: JSON.stringify({
        command: { type: "task.update_progress", payload: { taskId: "task-commits-cap", percentComplete: 25 } },
        clientPlanVersion: v1
      })
    });
    expect(firstUpdate.status).toBe(200);
    const firstUpdateBody = await firstUpdate.json();

    const secondUpdate = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers,
      body: JSON.stringify({
        command: { type: "task.update_progress", payload: { taskId: "task-commits-cap", percentComplete: 75 } },
        clientPlanVersion: firstUpdateBody.newPlanVersion
      })
    });
    expect(secondUpdate.status).toBe(200);
    const secondUpdateBody = await secondUpdate.json();

    const commits = await app.request("/api/workspace/projects/project-alpha/planning/commits", {
      headers: { cookie: adminCookie }
    });
    expect(commits.status).toBe(200);
    const commitsBody = (await commits.json()) as {
      auditEvents: Array<{
        id: string;
        afterState: { hasCompensatingCommands: boolean; compensatingCommands: unknown[] };
      }>;
    };

    const latest = commitsBody.auditEvents.find((event) => event.id === secondUpdateBody.auditEventId);
    expect(latest?.afterState.hasCompensatingCommands).toBe(true);
    expect(latest?.afterState.compensatingCommands).toEqual([
      { type: "task.update_progress", payload: { taskId: "task-commits-cap", percentComplete: 25 } }
    ]);

    const previous = commitsBody.auditEvents.find((event) => event.id === firstUpdateBody.auditEventId);
    expect(previous?.afterState.hasCompensatingCommands).toBe(true);
    expect(previous?.afterState.compensatingCommands).toEqual([]);
  });

  it("requires resource management permission to create and read auto-solver runs", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const limitedManagerCookie = await loginAs(
      "plan-manager-no-resource-manage@kiss-pm.local",
      "planmanager12345"
    );

    const deniedCreate = await app.request(
      "/api/workspace/projects/project-alpha/planning/auto-solver-runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: limitedManagerCookie
        },
        body: JSON.stringify({ mode: "repair", clientPlanVersion: 1 })
      }
    );
    expect(deniedCreate.status).toBe(403);
    await expect(deniedCreate.json()).resolves.toEqual({ error: "permission_missing" });

    const created = await app.request(
      "/api/workspace/projects/project-alpha/planning/auto-solver-runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ mode: "repair", clientPlanVersion: 1 })
      }
    );
    expect(created.status).toBe(200);
    const createdBody = await created.json();

    const deniedRead = await app.request(
      `/api/workspace/projects/project-alpha/planning/auto-solver-runs/${createdBody.runId}`,
      { headers: { cookie: limitedManagerCookie } }
    );
    expect(deniedRead.status).toBe(403);
    await expect(deniedRead.json()).resolves.toEqual({ error: "permission_missing" });
  });

  it("requires plan management permission when assigned task creation also allocates resources", async () => {
    const resourceManagerCookie = await loginAs(
      "resource-manager-no-plan@kiss-pm.local",
      "resourcemanager12345"
    );
    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: resourceManagerCookie } }
    );
    const readModelBody = await readModel.json();
    expect(readModel.status).toBe(200);

    const command = {
      type: "task.create",
      payload: {
        id: "task-create-resource-manager-only",
        projectId: "project-alpha",
        title: "Нельзя создать задачу без права управления планом",
        statusId: "task-status-new",
        plannedStart: "2026-06-12",
        plannedFinish: "2026-06-13",
        durationMinutes: 960,
        workMinutes: 960,
        assignments: [
          {
            id: "assignment-created-resource-manager-only",
            resourceId: "user-alpha-executor",
            role: "executor",
            unitsPermille: 1000,
            workMinutes: 960
          }
        ]
      }
    };

    const deniedPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: resourceManagerCookie
        },
        body: JSON.stringify({ command, clientPlanVersion: readModelBody.planVersion })
      }
    );
    expect(deniedPreview.status).toBe(403);
    await expect(deniedPreview.json()).resolves.toMatchObject({ error: "permission_missing" });

    const deniedApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: resourceManagerCookie
        },
        body: JSON.stringify({ command, clientPlanVersion: readModelBody.planVersion })
      }
    );
    expect(deniedApply.status).toBe(403);
    await expect(deniedApply.json()).resolves.toEqual({ error: "permission_missing" });
  });

  it("returns baseline comparison in the planning read-model", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-baseline-a",
      title: "Сравнить baseline",
      start: "2026-06-02",
      finish: "2026-06-02",
      plannedWork: 8
    });

    const initialReadModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await initialReadModel.json();
    expect(initialReadModel.status).toBe(200);
    expect(initialBody.baselineComparison).toEqual({
      baselineId: null,
      label: null,
      capturedAt: null,
      tasks: []
    });

    const baselineCapture = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "baseline.capture",
            payload: {
              baselineId: "baseline-api-a",
              label: "Стартовый baseline"
            }
          },
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const baselineCaptureBody = await baselineCapture.json();
    expect(baselineCapture.status).toBe(200);

    const workUpdate = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.update_work_model",
            payload: {
              taskId: "task-baseline-a",
              taskType: "fixed_work",
              effortDriven: false,
              durationMinutes: 960,
              workMinutes: 960
            }
          },
          clientPlanVersion: baselineCaptureBody.newPlanVersion
        })
      }
    );
    const workUpdateBody = await workUpdate.json();
    expect(workUpdate.status).toBe(200);

    const finalReadModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const finalBody = await finalReadModel.json();

    expect(finalReadModel.status).toBe(200);
    expect(finalBody.planVersion).toBe(workUpdateBody.newPlanVersion);
    expect(finalBody.baselineComparison).toMatchObject({
      baselineId: "baseline-api-a",
      label: "Стартовый baseline",
      tasks: [
        expect.objectContaining({
          taskId: "task-baseline-a",
          baselineStart: "2026-06-02",
          baselineFinish: "2026-06-02",
          baselineWorkMinutes: 480,
          currentStart: "2026-06-02",
          currentFinish: "2026-06-03",
          currentWorkMinutes: 960,
          startDeltaDays: 0,
          finishDeltaDays: 1,
          workDeltaMinutes: 480
        })
      ]
    });
  });

  // Регресс BUG-PROJ-22: свежезафиксированный baseline даёт Δ=0 (морозим calculated-даты,
  // а не authored — иначе появлялась мнимая дельта сразу после захвата).
  it("shows zero deltas immediately after capturing a baseline", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-fresh-baseline",
      title: "Свежий baseline",
      start: "2026-06-02",
      finish: "2026-06-05",
      plannedWork: 24
    });
    const rm = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const rmBody = await rm.json();

    const capture = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", cookie: adminCookie },
      body: JSON.stringify({
        command: { type: "baseline.capture", payload: { baselineId: "baseline-fresh", label: "Свежий" } },
        clientPlanVersion: rmBody.planVersion
      })
    });
    expect(capture.status).toBe(200);

    const after = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const afterBody = await after.json();
    const comparison = afterBody.baselineComparison as {
      baselineId: string;
      tasks: Array<{ startDeltaDays: number | null; finishDeltaDays: number | null; workDeltaMinutes: number | null }>;
    };
    const freshBaseline = (afterBody.authored.baselines as Array<{ id: string; label: string }>).find((baseline) => baseline.id === "baseline-fresh");
    expect(freshBaseline?.label).toBe("Свежий");
    expect(comparison.baselineId).toBe("baseline-fresh");
    expect(comparison.tasks.length).toBeGreaterThan(0);
    for (const t of comparison.tasks) {
      expect(t.startDeltaDays).toBe(0);
      expect(t.finishDeltaDays).toBe(0);
      expect(t.workDeltaMinutes).toBe(0);
    }
  });

  it("emits distinct audit actions for archived and hard-deleted planning tasks", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-archive-a",
      title: "Архивируемая задача",
      start: "2026-06-02",
      finish: "2026-06-02",
      plannedWork: 8
    });
    await createTask(adminCookie, {
      id: "task-delete-a",
      title: "Удаляемая задача",
      start: "2026-06-03",
      finish: "2026-06-03",
      plannedWork: 8
    });

    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await readModel.json();
    expect(readModel.status).toBe(200);

    const archiveApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.delete_or_archive",
            payload: { taskId: "task-archive-a", mode: "archive" }
          },
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const archiveBody = await archiveApply.json();
    expect(archiveApply.status).toBe(200);

    const deleteApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.delete_or_archive",
            payload: { taskId: "task-delete-a", mode: "delete" }
          },
          clientPlanVersion: archiveBody.newPlanVersion
        })
      }
    );
    expect(deleteApply.status).toBe(200);

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    expect(audit.status).toBe(200);
    await expect(audit.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "planning.task.archived",
          input: expect.objectContaining({
            command: expect.objectContaining({
              payload: expect.objectContaining({ taskId: "task-archive-a", mode: "archive" })
            })
          })
        }),
        expect.objectContaining({
          actionType: "planning.task.deleted",
          input: expect.objectContaining({
            command: expect.objectContaining({
              payload: expect.objectContaining({ taskId: "task-delete-a", mode: "delete" })
            })
          })
        })
      ])
    });
  });

  it("requires plan read permission before returning command preview read models", async () => {
    const managerWithoutReadCookie = await loginAs(
      "plan-manager-no-read@kiss-pm.local",
      "manager12345"
    );

    const preview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: managerWithoutReadCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.update_identity",
            payload: {
              taskId: "task-plan-a",
              title: "Не должно раскрыть модель"
            }
          },
          clientPlanVersion: 1
        })
      }
    );
    const body = await preview.json();

    expect(preview.status).toBe(403);
    expect(body).toMatchObject({
      error: "permission_missing",
      permissionPreview: {
        allowed: false,
        reason: "permission_missing"
      }
    });
    expect(body.before).toBeUndefined();
    expect(body.after).toBeUndefined();
  });

  it("requires plan read permission before returning apply and scenario planning details", async () => {
    const managerWithoutReadCookie = await loginAs(
      "plan-manager-no-read@kiss-pm.local",
      "manager12345"
    );
    const scenarioOperatorWithoutReadCookie = await loginAs(
      "scenario-no-read@kiss-pm.local",
      "scenario12345"
    );

    const applyCommand = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: managerWithoutReadCookie
        },
        body: JSON.stringify({
          command: {
            type: "task.update_identity",
            payload: {
              taskId: "task-plan-a",
              title: "Не должно примениться без чтения"
            }
          },
          clientPlanVersion: 1
        })
      }
    );
    const applyCommandBody = await applyCommand.json();
    expect(applyCommand.status).toBe(403);
    expect(applyCommandBody).toEqual({ error: "permission_missing" });
    expect(applyCommandBody.readModel).toBeUndefined();

    const scenarioPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: scenarioOperatorWithoutReadCookie
        },
        body: JSON.stringify({
          clientPlanVersion: 1,
          target: {
            type: "resource_overload",
            resourceId: "user-alpha-executor",
            date: "2026-06-01",
            overloadMinutes: 60,
            taskIds: ["task-plan-a"]
          }
        })
      }
    );
    const scenarioPreviewBody = await scenarioPreview.json();
    expect(scenarioPreview.status).toBe(403);
    expect(scenarioPreviewBody).toMatchObject({
      error: "permission_missing",
      permissionPreview: {
        allowed: false,
        reason: "permission_missing"
      }
    });
    expect(scenarioPreviewBody.proposals).toBeUndefined();

    const scenarioApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals/planning-scenario-missing/apply",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: scenarioOperatorWithoutReadCookie
        },
        body: JSON.stringify({ clientPlanVersion: 1 })
      }
    );
    const scenarioApplyBody = await scenarioApply.json();
    expect(scenarioApply.status).toBe(403);
    expect(scenarioApplyBody).toEqual({ error: "permission_missing" });
    expect(scenarioApplyBody.readModel).toBeUndefined();
  });

  it("returns planning validation errors for invalid commands without mutating plan state", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-plan-a",
      title: "Подготовить план",
      start: "2026-06-01",
      finish: "2026-06-03"
    });
    await createTask(adminCookie, {
      id: "task-plan-b",
      title: "Согласовать план",
      start: "2026-06-04",
      finish: "2026-06-05"
    });

    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const initialBody = await readModel.json();
    expect(readModel.status).toBe(200);
    expect(initialBody).toMatchObject({
      authored: { dependencies: [] },
      planVersion: 3
    });

    const invalidCommand = {
      type: "dependency.upsert",
      payload: {
        id: "dep-self",
        predecessorTaskId: "task-plan-a",
        successorTaskId: "task-plan-a",
        dependencyType: "FS",
        lagMinutes: 0
      }
    };

    const preview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: invalidCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const previewBody = await preview.json();

    expect(preview.status).toBe(200);
    expect(previewBody).toMatchObject({
      after: {
        authored: { dependencies: [] },
        planVersion: initialBody.planVersion
      },
      auditPreview: {
        planVersionBefore: initialBody.planVersion,
        planVersionAfter: initialBody.planVersion
      },
      validationIssues: [
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
      ]
    });

    const apply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: invalidCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const applyBody = await apply.json();

    expect(apply.status).toBe(409);
    expect(applyBody).toMatchObject({
      error: "planning_precondition_failed",
      validationIssues: [
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
      ]
    });

    const afterApplyRead = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: adminCookie } }
    );
    const afterApplyBody = await afterApplyRead.json();
    expect(afterApplyBody).toMatchObject({
      authored: { dependencies: [] },
      planVersion: initialBody.planVersion
    });

    const invalidStatusCommand = {
      type: "task.update_status",
      payload: {
        taskId: "task-plan-a",
        statusId: "task-status-missing"
      }
    };
    const invalidStatusPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: invalidStatusCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const invalidStatusPreviewBody = await invalidStatusPreview.json();
    expect(invalidStatusPreview.status).toBe(200);
    expect(invalidStatusPreviewBody.validationIssues).toEqual([
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error"
      })
    ]);

    const invalidStatusApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: invalidStatusCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const invalidStatusApplyBody = await invalidStatusApply.json();
    expect(invalidStatusApply.status).toBe(409);
    expect(invalidStatusApplyBody).toMatchObject({
      error: "planning_precondition_failed",
      validationIssues: [
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
      ]
    });

    await client`
      UPDATE tenant_users
      SET status = 'inactive'
      WHERE tenant_id = 'tenant-alpha'
        AND id = 'user-alpha-executor'
    `;
    const inactiveResourceCommand = {
      type: "assignment.upsert",
      payload: {
        id: "assignment-inactive-resource",
        taskId: "task-plan-a",
        resourceId: "user-alpha-executor",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480
      }
    };
    const inactiveResourcePreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/preview-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: inactiveResourceCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const inactiveResourcePreviewBody = await inactiveResourcePreview.json();
    expect(inactiveResourcePreview.status).toBe(200);
    expect(inactiveResourcePreviewBody.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error"
      })
    ]));

    const inactiveResourceApply = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: inactiveResourceCommand,
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const inactiveResourceApplyBody = await inactiveResourceApply.json();
    expect(inactiveResourceApply.status).toBe(409);
    expect(inactiveResourceApplyBody).toMatchObject({
      error: "planning_precondition_failed"
    });
    expect(inactiveResourceApplyBody.validationIssues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
    ]));

    const audit = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    const auditBody = await audit.json();
    expect(audit.status).toBe(200);
    expect(
      auditBody.auditEvents.some(
        (event: { actionType: string; sourceWorkflow: string }) =>
          event.actionType === "planning.dependency.upserted" &&
          event.sourceWorkflow === "planning"
      )
    ).toBe(false);
  });

  it("applies command batch atomically with idempotency and version conflict", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-plan-a",
      title: "Подготовить план",
      start: "2026-06-01",
      finish: "2026-06-03"
    });
    await createTask(adminCookie, {
      id: "task-plan-b",
      title: "Согласовать план",
      start: "2026-06-04",
      finish: "2026-06-05"
    });
    const initial = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const initialBody = await initial.json();
    expect(initial.status).toBe(200);

    const commands = [
      {
        type: "task.update_identity",
        payload: { taskId: "task-plan-a", title: "Batch rename A" }
      },
      {
        type: "task.update_identity",
        payload: { taskId: "task-plan-b", title: "Batch rename B" }
      }
    ];

    const applied = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command-batch",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          commands,
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "planning-batch-test-1"
        })
      }
    );
    const appliedBody = await applied.json();
    expect(applied.status).toBe(200);
    expect(appliedBody.newPlanVersion).toBe(initialBody.planVersion + 1);
    expect(appliedBody.readModel.authored.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "task-plan-a", title: "Batch rename A" }),
        expect.objectContaining({ id: "task-plan-b", title: "Batch rename B" })
      ])
    );
    const auditResponse = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie: adminCookie }
    });
    expect(auditResponse.status).toBe(200);
    const auditBody = await auditResponse.json();
    const batchAudit = auditBody.auditEvents.find(
      (event: { id: string }) => event.id === appliedBody.auditEventId
    );
    expect(batchAudit?.afterState?.compensatingCommands).toEqual([
      {
        type: "task.update_identity",
        payload: { taskId: "task-plan-b", title: "Согласовать план" }
      },
      {
        type: "task.update_identity",
        payload: { taskId: "task-plan-a", title: "Подготовить план" }
      }
    ]);

    const retried = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command-batch",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          commands,
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "planning-batch-test-1"
        })
      }
    );
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual(appliedBody);

    const stale = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command-batch",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          commands: [
            {
              type: "task.update_identity",
              payload: { taskId: "task-plan-a", title: "Stale batch" }
            }
          ],
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      error: "plan_version_conflict",
      currentPlanVersion: appliedBody.newPlanVersion
    });
  });

  it("deduplicates concurrent apply-command-batch requests with the same idempotency key", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-batch-race-a",
      title: "Batch race A",
      start: "2026-06-01",
      finish: "2026-06-03"
    });
    await createTask(adminCookie, {
      id: "task-batch-race-b",
      title: "Batch race B",
      start: "2026-06-04",
      finish: "2026-06-05"
    });
    const initial = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const initialBody = await initial.json();
    expect(initial.status).toBe(200);

    const commands = [
      {
        type: "task.update_identity",
        payload: { taskId: "task-batch-race-a", title: "Concurrent batch rename A" }
      },
      {
        type: "task.update_identity",
        payload: { taskId: "task-batch-race-b", title: "Concurrent batch rename B" }
      }
    ];
    const request = () =>
      app.request("/api/workspace/projects/project-alpha/planning/apply-command-batch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          commands,
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "planning-batch-race-key"
        })
      });

    const [first, second] = await Promise.all([request(), request()]);
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondBody).toEqual(firstBody);
    expect(firstBody.newPlanVersion).toBe(initialBody.planVersion + 1);
    expect(firstBody.readModel.authored.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "task-batch-race-a", title: "Concurrent batch rename A" }),
        expect.objectContaining({ id: "task-batch-race-b", title: "Concurrent batch rename B" })
      ])
    );

    const after = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const afterBody = await after.json();
    expect(after.status).toBe(200);
    expect(afterBody.planVersion).toBe(initialBody.planVersion + 1);
    expect(afterBody.authored.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "task-batch-race-a", title: "Concurrent batch rename A" }),
        expect.objectContaining({ id: "task-batch-race-b", title: "Concurrent batch rename B" })
      ])
    );
  });

  it("deduplicates concurrent baseline.capture apply requests with the same idempotency key", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-baseline-race",
      title: "Baseline race",
      start: "2026-06-02",
      finish: "2026-06-03"
    });
    const initial = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const initialBody = await initial.json();
    const command = {
      type: "baseline.capture",
      payload: {
        baselineId: "baseline-race",
        label: "Race baseline"
      }
    };
    const request = () =>
      app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command,
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "baseline-capture-race-key"
        })
      });

    const [first, second] = await Promise.all([request(), request()]);
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondBody).toEqual(firstBody);
    expect(firstBody.newPlanVersion).toBe(initialBody.planVersion + 1);

    const after = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const afterBody = await after.json();
    const capturedBaselines = (afterBody.authored.baselines as Array<{ id: string; label: string }>).filter(
      (baseline) => baseline.id === "baseline-race"
    );
    expect(afterBody.planVersion).toBe(initialBody.planVersion + 1);
    expect(capturedBaselines).toHaveLength(1);
    expect(capturedBaselines[0]).toMatchObject({ id: "baseline-race", label: "Race baseline" });

    const conflicting = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        command: {
          ...command,
          payload: { ...command.payload, label: "Conflicting race baseline" }
        },
        clientPlanVersion: initialBody.planVersion,
        idempotencyKey: "baseline-capture-race-key"
      })
    });

    expect(conflicting.status).toBe(409);
    await expect(conflicting.json()).resolves.toEqual({ error: "idempotency_key_conflict" });
  });

  it("deduplicates concurrent task.update_schedule apply requests with the same idempotency key", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-schedule-race",
      title: "Schedule race",
      start: "2026-06-02",
      finish: "2026-06-03"
    });
    const initial = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const initialBody = await initial.json();
    const command = {
      type: "task.update_schedule",
      payload: {
        taskId: "task-schedule-race",
        plannedStart: "2026-06-05",
        plannedFinish: "2026-06-08"
      }
    };
    const request = () =>
      app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command,
          clientPlanVersion: initialBody.planVersion,
          idempotencyKey: "task-update-schedule-race-key"
        })
      });

    const [first, second] = await Promise.all([request(), request()]);
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondBody).toEqual(firstBody);
    expect(firstBody.newPlanVersion).toBe(initialBody.planVersion + 1);

    const after = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const afterBody = await after.json();
    const updatedTask = (afterBody.authored.tasks as Array<{
      id: string;
      plannedStart: string | null;
      plannedFinish: string | null;
    }>).find((task) => task.id === "task-schedule-race");
    expect(afterBody.planVersion).toBe(initialBody.planVersion + 1);
    expect(updatedTask).toMatchObject({
      plannedStart: "2026-06-05",
      plannedFinish: "2026-06-08"
    });

    const conflicting = await app.request("/api/workspace/projects/project-alpha/planning/apply-command", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        command: {
          ...command,
          payload: {
            ...command.payload,
            plannedFinish: "2026-06-09"
          }
        },
        clientPlanVersion: initialBody.planVersion,
        idempotencyKey: "task-update-schedule-race-key"
      })
    });

    expect(conflicting.status).toBe(409);
    await expect(conflicting.json()).resolves.toEqual({ error: "idempotency_key_conflict" });
  });

  it("keeps scenario apply single-use under concurrent duplicate requests", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-scenario-race",
      title: "Scenario race overload",
      start: "2026-06-08",
      finish: "2026-06-08",
      plannedWork: 40
    });

    const initial = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const initialBody = await initial.json();
    expect(initial.status).toBe(200);

    const assignmentApplied = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          command: {
            type: "assignment.upsert",
            payload: {
              id: "assignment-scenario-race",
              taskId: "task-scenario-race",
              resourceId: "user-alpha-executor",
              role: "executor",
              unitsPermille: 1000,
              workMinutes: 4_800
            }
          },
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    const assignmentAppliedBody = await assignmentApplied.json();
    expect(assignmentApplied.status).toBe(200);

    const overload = assignmentAppliedBody.readModel.resourceLoad.overloads.find(
      (candidate: { resourceId: string; taskIds: string[] }) =>
        candidate.resourceId === "user-alpha-executor" &&
        candidate.taskIds.includes("task-scenario-race")
    );
    expect(overload).toBeTruthy();

    const scenarioPreview = await app.request(
      "/api/workspace/projects/project-alpha/planning/scenario-proposals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          clientPlanVersion: assignmentAppliedBody.newPlanVersion,
          target: {
            type: "resource_overload",
            resourceId: overload.resourceId,
            date: overload.date,
            overloadMinutes: overload.overloadMinutes,
            taskIds: overload.taskIds
          }
        })
      }
    );
    const scenarioPreviewBody = await scenarioPreview.json();
    expect(scenarioPreview.status).toBe(200);
    const scenarioId = scenarioPreviewBody.proposals[0].id;
    expect(scenarioId).toMatch(/^planning-scenario-/);

    const applyScenario = () =>
      app.request(
        `/api/workspace/projects/project-alpha/planning/scenario-proposals/${scenarioId}/apply`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-kiss-pm-action": "same-origin",
            cookie: adminCookie
          },
          body: JSON.stringify({
            clientPlanVersion: assignmentAppliedBody.newPlanVersion,
            acceptedRiskReason: "Concurrent duplicate scenario apply test"
          })
        }
      );

    const [first, second] = await Promise.all([applyScenario(), applyScenario()]);
    const results = await Promise.all([
      first.json().then((body) => ({ status: first.status, body })),
      second.json().then((body) => ({ status: second.status, body }))
    ]);
    const successes = results.filter((result) => result.status === 200);
    const conflicts = results.filter((result) => result.status === 409);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(successes[0]?.body).toMatchObject({
      scenarioRunId: scenarioId,
      newPlanVersion: assignmentAppliedBody.newPlanVersion + 1,
      readModel: { planVersion: assignmentAppliedBody.newPlanVersion + 1 }
    });
    expect(conflicts[0]?.body).toMatchObject({
      error: expect.stringMatching(/^(plan_version_conflict|planning_scenario_already_applied)$/)
    });

    const after = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const afterBody = await after.json();
    expect(after.status).toBe(200);
    expect(afterBody.planVersion).toBe(assignmentAppliedBody.newPlanVersion + 1);

    const scenarioRows = await client`
      SELECT applied_at
      FROM planning_scenario_runs
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${scenarioId}
    `;
    expect(scenarioRows).toHaveLength(1);
    expect(scenarioRows[0]?.applied_at).toBeTruthy();
  });
  it("rejects batch when a middle command has blocking validation", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-plan-a",
      title: "Подготовить план",
      start: "2026-06-01",
      finish: "2026-06-03"
    });
    const initial = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const initialBody = await initial.json();

    const response = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command-batch",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          commands: [
            {
              type: "task.update_identity",
              payload: { taskId: "task-plan-a", title: "Still valid" }
            },
            {
              type: "dependency.upsert",
              payload: {
                id: "dep-invalid-self",
                predecessorTaskId: "task-plan-a",
                successorTaskId: "task-plan-a",
                dependencyType: "FS",
                lagMinutes: 0
              }
            }
          ],
          clientPlanVersion: initialBody.planVersion
        })
      }
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("planning_precondition_failed");
    expect(body.validationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "error" })
      ])
    );

    const after = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const afterBody = await after.json();
    expect(afterBody.planVersion).toBe(initialBody.planVersion);
    expect(
      afterBody.authored.tasks.find((task: { id: string }) => task.id === "task-plan-a")?.title
    ).not.toBe("Still valid");
  });

  it("lists planning baselines for a project", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const response = await app.request("/api/workspace/projects/project-alpha/planning/baselines", {
      headers: { cookie: adminCookie }
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.baselines).toEqual(expect.any(Array));
  });

  it("opens planning events SSE stream for authorized reader", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const response = await app.request("/api/workspace/projects/project-alpha/planning/events", {
      headers: { cookie: adminCookie, Accept: "text/event-stream" }
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
  });

  it("creates, renames, replays, reads back, and deletes a saved view", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const readerCookie = await loginAs("executor@kiss-pm.local", "executor12345");
    const otherManagerCookie = await loginAs(
      "plan-manager-no-read@kiss-pm.local",
      "manager12345"
    );
    const listEmpty = await app.request(
      "/api/workspace/projects/project-alpha/planning/saved-views",
      { headers: { cookie: adminCookie } }
    );
    expect(listEmpty.status).toBe(200);
    await expect(listEmpty.json()).resolves.toEqual({ savedViews: [] });

    const create = await app.request(
      "/api/workspace/projects/project-alpha/planning/saved-views",
      {
        method: "POST",
        headers: {
          cookie: adminCookie,
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        },
        body: JSON.stringify({
          clientRequestId: "planning-saved-view-create-db-test",
          name: "Мой вид",
          scope: "user",
          payload: { visibleColumnIds: ["title", "start"] }
        })
      }
    );
    expect(create.status).toBe(201);
    const createdBody = await create.json();
    expect(createdBody.savedView).toMatchObject({
      name: "Мой вид",
      scope: "user",
      payload: { visibleColumnIds: ["title", "start"] }
    });

    const viewId = createdBody.savedView.id as string;
    const renamePath =
      `/api/workspace/projects/project-alpha/planning/saved-views/${viewId}`;
    const renameBody = {
      clientRequestId: "planning-saved-view-rename-db-test",
      name: "Мой рабочий вид"
    };

    const readerRename = await app.request(renamePath, {
      method: "PATCH",
      headers: {
        cookie: readerCookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify(renameBody)
    });
    expect(readerRename.status).toBe(403);

    const inaccessibleRename = await app.request(renamePath, {
      method: "PATCH",
      headers: {
        cookie: otherManagerCookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify(renameBody)
    });
    expect(inaccessibleRename.status).toBe(404);

    const rename = await app.request(renamePath, {
      method: "PATCH",
      headers: {
        cookie: adminCookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify(renameBody)
    });
    expect(rename.status).toBe(200);
    const renamedBody = await rename.json();
    expect(renamedBody.savedView).toMatchObject({
      id: viewId,
      name: "Мой рабочий вид",
      scope: "user",
      payload: { visibleColumnIds: ["title", "start"] }
    });

    const replay = await app.request(renamePath, {
      method: "PATCH",
      headers: {
        cookie: adminCookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify(renameBody)
    });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toEqual(renamedBody);

    const conflict = await app.request(renamePath, {
      method: "PATCH",
      headers: {
        cookie: adminCookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: JSON.stringify({ ...renameBody, name: "Другое имя" })
    });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      error: "idempotency_key_conflict"
    });

    const listAfter = await app.request(
      "/api/workspace/projects/project-alpha/planning/saved-views",
      { headers: { cookie: adminCookie } }
    );
    const listBody = await listAfter.json();
    expect(listAfter.status).toBe(200);
    expect(listBody.savedViews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: viewId, name: "Мой рабочий вид" })
      ])
    );

    const deleteBody = JSON.stringify({ clientRequestId: "planning-saved-view-delete-db-test" });
    const deleteInit = {
      method: "DELETE",
      headers: {
        cookie: adminCookie,
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin"
      },
      body: deleteBody
    };
    const [removeLeft, removeRight] = await Promise.all([
      app.request(renamePath, deleteInit),
      app.request(renamePath, deleteInit)
    ]);
    expect([removeLeft.status, removeRight.status]).toEqual([200, 200]);
    const removeReplay = await app.request(renamePath, deleteInit);
    expect(removeReplay.status).toBe(200);

    const listDeleted = await app.request(
      "/api/workspace/projects/project-alpha/planning/saved-views",
      { headers: { cookie: adminCookie } }
    );
    expect(listDeleted.status).toBe(200);
    await expect(listDeleted.json()).resolves.toEqual({ savedViews: [] });
  });

  it("deduplicates concurrent saved-view create, rename, and delete writes", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const endpoint = "/api/workspace/projects/project-alpha/planning/saved-views";
    const headers = {
      cookie: adminCookie,
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin"
    };
    const request = (path: string, method: "POST" | "PATCH" | "DELETE", body: unknown) =>
      app.request(path, { method, headers, body: JSON.stringify(body) });
    const payload = { version: 1, zoom: "day", columnWidths: Array(11).fill(80), collapsedTaskIds: [] };

    const createRaceBody = {
      clientRequestId: "saved-view-db-create-race-same",
      name: "Create race same key",
      scope: "project",
      payload
    };
    const [createLeft, createRight] = await Promise.all([
      request(endpoint, "POST", createRaceBody),
      request(endpoint, "POST", createRaceBody)
    ]);
    expect([createLeft.status, createRight.status]).toEqual([201, 201]);
    const createLeftBody = await createLeft.json();
    const createRightBody = await createRight.json();
    expect(createRightBody).toEqual(createLeftBody);

    const createNameRace = await Promise.all([
      request(endpoint, "POST", {
        clientRequestId: "saved-view-db-create-name-left",
        name: "Create name collision",
        scope: "project",
        payload
      }),
      request(endpoint, "POST", {
        clientRequestId: "saved-view-db-create-name-right",
        name: "CREATE NAME COLLISION",
        scope: "project",
        payload
      })
    ]);
    expect(createNameRace.map((response) => response.status).sort()).toEqual([201, 409]);
    const createNameConflict = createNameRace.find((response) => response.status === 409)!;
    await expect(createNameConflict.json()).resolves.toEqual({ error: "saved_view_name_conflict" });

    const makeView = async (name: string, key: string) => {
      const response = await request(endpoint, "POST", {
        clientRequestId: key,
        name,
        scope: "project",
        payload
      });
      expect(response.status).toBe(201);
      return (await response.json()).savedView as { id: string; name: string };
    };
    const renameA = await makeView("Rename A", "saved-view-db-rename-a-create");
    const renameB = await makeView("Rename B", "saved-view-db-rename-b-create");
    const renamePathA = endpoint + "/" + renameA.id;
    const renamePathB = endpoint + "/" + renameB.id;
    const renameRaceBody = {
      clientRequestId: "saved-view-db-rename-race-same",
      name: "Rename A replayed"
    };
    const [renameLeft, renameRight] = await Promise.all([
      request(renamePathA, "PATCH", renameRaceBody),
      request(renamePathA, "PATCH", renameRaceBody)
    ]);
    expect([renameLeft.status, renameRight.status]).toEqual([200, 200]);
    expect(await renameRight.json()).toEqual(await renameLeft.json());

    const renameNameRace = await Promise.all([
      request(renamePathA, "PATCH", {
        clientRequestId: "saved-view-db-rename-name-left",
        name: "Rename collision"
      }),
      request(renamePathB, "PATCH", {
        clientRequestId: "saved-view-db-rename-name-right",
        name: "RENAME COLLISION"
      })
    ]);
    expect(renameNameRace.map((response) => response.status).sort()).toEqual([200, 409]);
    const renameNameConflict = renameNameRace.find((response) => response.status === 409)!;
    await expect(renameNameConflict.json()).resolves.toEqual({ error: "saved_view_name_conflict" });

    const deleteTarget = await makeView("Delete race target", "saved-view-db-delete-target-create");
    const deleteOther = await makeView("Delete race other", "saved-view-db-delete-other-create");
    const deletePath = endpoint + "/" + deleteTarget.id;
    const deleteBody = { clientRequestId: "saved-view-db-delete-race-same" };
    const [deleteLeft, deleteRight] = await Promise.all([
      request(deletePath, "DELETE", deleteBody),
      request(deletePath, "DELETE", deleteBody)
    ]);
    expect([deleteLeft.status, deleteRight.status]).toEqual([200, 200]);
    await expect(deleteLeft.json()).resolves.toEqual({ ok: true });
    await expect(deleteRight.json()).resolves.toEqual({ ok: true });
    const deleteReplay = await request(deletePath, "DELETE", deleteBody);
    expect(deleteReplay.status).toBe(200);
    await expect(deleteReplay.json()).resolves.toEqual({ ok: true });

    const divergentDelete = await request(endpoint + "/" + deleteOther.id, "DELETE", deleteBody);
    expect(divergentDelete.status).toBe(409);
    await expect(divergentDelete.json()).resolves.toEqual({ error: "idempotency_key_conflict" });
    const finalList = await app.request(endpoint, { headers: { cookie: adminCookie } });
    expect(finalList.status).toBe(200);
    const finalViews = (await finalList.json()).savedViews as Array<{ id: string }>;
    expect(finalViews.some((view) => view.id === deleteTarget.id)).toBe(false);
    expect(finalViews.some((view) => view.id === deleteOther.id)).toBe(true);
  });
  it("allows plan-only reader to load read-model and SSE without resource read", async () => {
    const planOnlyCookie = await loginAs("plan-reader-no-resources@kiss-pm.local", "reader12345");
    const readModel = await app.request(
      "/api/workspace/projects/project-alpha/planning/read-model",
      { headers: { cookie: planOnlyCookie } }
    );
    expect(readModel.status).toBe(200);

    const events = await app.request("/api/workspace/projects/project-alpha/planning/events", {
      headers: { cookie: planOnlyCookie, Accept: "text/event-stream" }
    });
    expect(events.status).toBe(200);

    const commits = await app.request(
      "/api/workspace/projects/project-alpha/planning/commits",
      { headers: { cookie: planOnlyCookie } }
    );
    expect(commits.status).toBe(200);
    const commitsBody = await commits.json() as {
      auditEvents: Array<{ sourceWorkflow: string | null }>;
    };
    expect(commitsBody.auditEvents.every((event) => event.sourceWorkflow === "planning")).toBe(true);
  });

  it("applies project.settings.update with audit and plan recalc", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const response = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        },
        body: JSON.stringify({
          command: {
            type: "project.settings.update",
            payload: { calendarId: "tenant-default" }
          },
          clientPlanVersion: 1
        })
      }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      readModel: { project: { calendarId?: string | null } };
      auditEventId: string;
    };
    expect(body.readModel.project.calendarId).toBe("tenant-default");
    expect(body.auditEventId).toMatch(/^audit-/);
  });
});

function hashJson(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
