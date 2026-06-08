import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  createTenantAdminSeedProfile,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";
import { createHash } from "node:crypto";

import { createApp } from "./app";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

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
      permissions: ["tenant.projects.read", "tenant.project_plan.read"]
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

  async function pauseProject(cookie: string) {
    const response = await app.request("/api/workspace/projects/project-alpha/status", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie
      },
      body: JSON.stringify({ status: "paused" })
    });
    expect(response.status).toBe(200);
  }

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-21T00:00:00.000Z")
    );
    await createActiveProject();
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, planning_command_idempotency_keys, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
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

  it("keeps paused project planning reads available while blocking command mutations", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-paused-a",
      title: "Paused task A",
      start: "2026-06-01",
      finish: "2026-06-03"
    });
    await createTask(adminCookie, {
      id: "task-paused-b",
      title: "Paused task B",
      start: "2026-06-04",
      finish: "2026-06-05"
    });

    const initial = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const initialBody = await initial.json();
    expect(initial.status).toBe(200);

    await pauseProject(adminCookie);

    const pausedRead = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const pausedReadBody = await pausedRead.json();
    expect(pausedRead.status).toBe(200);
    expect(pausedReadBody.planVersion).toBe(initialBody.planVersion);

    const command = {
      type: "task.update_identity",
      payload: { taskId: "task-paused-a", title: "Should not mutate while paused" }
    };
    const applyCommand = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command",
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
    expect(applyCommand.status).toBe(404);
    await expect(applyCommand.json()).resolves.toEqual({ error: "project_not_found" });

    const batch = await app.request(
      "/api/workspace/projects/project-alpha/planning/apply-command-batch",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ commands: [command], clientPlanVersion: initialBody.planVersion })
      }
    );
    expect(batch.status).toBe(404);
    await expect(batch.json()).resolves.toEqual({ error: "project_not_found" });

    const after = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const afterBody = await after.json();
    expect(after.status).toBe(200);
    expect(afterBody).toMatchObject({
      planVersion: initialBody.planVersion,
      authored: {
        tasks: expect.arrayContaining([
          expect.objectContaining({ id: "task-paused-a", title: "Paused task A" })
        ])
      }
    });
  });

  it("blocks applying stored scenario proposals while a project is paused", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createTask(adminCookie, {
      id: "task-paused-overload",
      title: "Paused overload task",
      start: "2026-06-08",
      finish: "2026-06-08",
      plannedWork: 40
    });

    const initial = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const initialBody = await initial.json();
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
              id: "assignment-paused-overload",
              taskId: "task-paused-overload",
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
    expect(assignmentApplied.status).toBe(200);
    const assignmentAppliedBody = await assignmentApplied.json();
    const overload = assignmentAppliedBody.readModel.resourceLoad.overloads.find(
      (candidate: { resourceId: string; taskIds: string[] }) =>
        candidate.resourceId === "user-alpha-executor" &&
        candidate.taskIds.includes("task-paused-overload")
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
    expect(scenarioPreview.status).toBe(200);
    const scenarioPreviewBody = await scenarioPreview.json();

    await pauseProject(adminCookie);

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
          acceptedRiskReason: "Paused projects cannot apply stored scenario proposals"
        })
      }
    );
    expect(scenarioApply.status).toBe(404);
    await expect(scenarioApply.json()).resolves.toEqual({ error: "project_not_found" });

    const scenarioRows = await client`
      SELECT applied_at
      FROM planning_scenario_runs
      WHERE tenant_id = 'tenant-alpha'
        AND project_id = 'project-alpha'
        AND id = ${scenarioPreviewBody.proposals[0].id}
    `;
    expect(scenarioRows[0]?.applied_at).toBeNull();

    const after = await app.request("/api/workspace/projects/project-alpha/planning/read-model", {
      headers: { cookie: adminCookie }
    });
    const afterBody = await after.json();
    expect(after.status).toBe(200);
    expect(afterBody.planVersion).toBe(assignmentAppliedBody.newPlanVersion);
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

  it("lists and creates saved views with stable API keys", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
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

    const listAfter = await app.request(
      "/api/workspace/projects/project-alpha/planning/saved-views",
      { headers: { cookie: adminCookie } }
    );
    const listBody = await listAfter.json();
    expect(listAfter.status).toBe(200);
    expect(listBody.savedViews).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Мой вид" })])
    );
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
