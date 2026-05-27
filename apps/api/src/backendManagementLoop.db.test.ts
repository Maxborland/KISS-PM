import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  createTenantAdminSeedProfile,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

import { createApp } from "./app";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

const dataset: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа Проект" }],
  accessProfiles: [
    createTenantAdminSeedProfile({
      id: "access-profile-admin",
      tenantId: "tenant-alpha"
    })
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
    }
  ]
};

describe("backend management loop DB smoke", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
  });

  beforeEach(async () => {
    await truncateDatabase();
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-21T00:00:00.000Z")
    );
    await createActiveProject();
  });

  afterAll(async () => {
    await truncateDatabase();
    await client.end();
  });

  async function truncateDatabase() {
    await client`
      TRUNCATE
        audit_events,
        call_recordings,
        call_events,
        call_participant_states,
        call_sessions,
        call_rooms,
        meeting_action_items,
        meeting_notes,
        meeting_external_links,
        meeting_participants,
        meetings,
        notification_preferences,
        user_notifications,
        background_job_events,
        background_job_runs,
        background_job_schedules,
        conversation_read_states,
        message_mentions,
        discussion_messages,
        conversations,
        crm_activities,
        task_activities,
        entity_attachments,
        external_references,
        file_assets,
        task_participants,
        control_surface_versions,
        control_surface_definitions,
        template_improvement_actions,
        retrospective_lessons,
        project_closure_snapshots,
        action_executions,
        corrective_actions,
        control_signals,
        kpi_evaluations,
        kpi_definitions,
        planning_command_idempotency_keys,
        planning_solver_runs,
        planning_scenario_runs,
        resource_reservations,
        project_baseline_assignments,
        project_baseline_tasks,
        project_baselines,
        task_dependencies,
        task_assignment_allocations,
        task_assignments,
        resource_absences,
        tenant_user_org_placements,
        tenant_org_nodes,
        planning_saved_views,
        tenant_production_calendar_exceptions,
        tenant_production_calendars,
        calendar_exceptions,
        resource_calendars,
        project_calendars,
        plan_versions,
        tasks,
        task_statuses,
        user_sessions,
        user_credentials,
        tenant_users,
        project_position_demands,
        projects,
        opportunity_demands,
        opportunities,
        deal_stages,
        project_types,
        products,
        contacts,
        clients,
        project_templates,
        custom_field_definitions,
        positions,
        access_profiles,
        tenants
      RESTART IDENTITY CASCADE
    `;
  }

  async function loginAsAdmin() {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@kiss-pm.local", password: "local-admin-password" })
    });

    expect(response.status).toBe(200);
    return response.headers.get("set-cookie") ?? "";
  }

  async function createActiveProject() {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const opportunity = await dataSource.createOpportunity({
      id: "opportunity-loop",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      primaryContactId: null,
      projectTypeId: "project-type-implementation",
      stageId: null,
      clientName: "ООО Ромашка",
      contactName: "Ирина Клиент",
      title: "Сквозной backend loop",
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
      id: "project-loop",
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

  async function createPlanningTasksBatch(cookie: string, count: number) {
    const commands = Array.from({ length: count }, (_, index) => ({
      type: "task.create",
      payload: {
        id: `task-load-${index}`,
        projectId: "project-loop",
        title: `Нагрузочная задача ${index}`,
        statusId: "task-status-new",
        plannedStart: "2026-06-02",
        plannedFinish: "2026-06-02",
        workMinutes: 120,
        assignments: [
          {
            id: `assignment-load-${index}`,
            resourceId: "user-alpha-admin",
            role: "executor",
            unitsPermille: 1000,
            workMinutes: 120
          }
        ]
      }
    }));
    const response = await app.request(
      "/api/workspace/projects/project-loop/planning/apply-command-batch",
      {
        method: "POST",
        headers: mutationHeaders(cookie),
        body: JSON.stringify({
          clientPlanVersion: 1,
          commands,
          idempotencyKey: "backend-loop-load-tasks"
        })
      }
    );
    expect(response.status).toBe(200);
  }

  async function measureP95(
    iterations: number,
    request: () => Response | Promise<Response>
  ): Promise<number> {
    const durations: number[] = [];
    for (let index = 0; index < iterations; index += 1) {
      const startedAt = performance.now();
      const response = await request();
      durations.push(performance.now() - startedAt);
      expect(response.status).toBe(200);
      await response.arrayBuffer();
    }
    return durations.sort((left, right) => left - right)[Math.ceil(durations.length * 0.95) - 1] ?? 0;
  }

  it("runs auth to planning to control to closure to audit", async () => {
    const cookie = await loginAsAdmin();

    const planningResponse = await app.request(
      "/api/workspace/projects/project-loop/planning/apply-command",
      {
        method: "POST",
        headers: mutationHeaders(cookie),
        body: JSON.stringify({
          clientPlanVersion: 1,
          idempotencyKey: "backend-loop-create-task",
          command: {
            type: "task.create",
            payload: {
              id: "task-loop-1",
              projectId: "project-loop",
              title: "Сквозная задача",
              statusId: "task-status-new",
              plannedStart: "2026-06-02",
              plannedFinish: "2026-06-02",
              workMinutes: 240,
              assignments: [
                {
                  id: "assignment-loop-1",
                  resourceId: "user-alpha-admin",
                  role: "executor",
                  unitsPermille: 1000,
                  workMinutes: 240
                }
              ]
            }
          }
        })
      }
    );
    expect(planningResponse.status).toBe(200);
    const planningBody = await planningResponse.json();
    expect(planningBody).toMatchObject({
      newPlanVersion: 2,
      auditEventId: expect.stringMatching(/^audit-/),
      readModel: {
        authored: {
          tasks: expect.arrayContaining([
            expect.objectContaining({ id: "task-loop-1", title: "Сквозная задача" })
          ])
        },
        planVersion: 2
      }
    });

    const controlResponse = await app.request(
      "/api/workspace/projects/project-loop/control/evaluate",
      {
        method: "POST",
        headers: mutationHeaders(cookie),
        body: JSON.stringify({})
      }
    );
    expect(controlResponse.status).toBe(200);
    const controlBody = await controlResponse.json();
    expect(controlBody).toMatchObject({
      auditEventId: expect.stringMatching(/^audit-/),
      evaluations: expect.any(Array),
      signals: expect.any(Array)
    });

    const previewResponse = await app.request(
      "/api/workspace/projects/project-loop/closure/preview",
      {
        method: "POST",
        headers: mutationHeaders(cookie),
        body: JSON.stringify({})
      }
    );
    expect(previewResponse.status).toBe(200);
    await expect(previewResponse.json()).resolves.toMatchObject({
      canClose: true,
      projectStatus: "active",
      planFactSummary: { planVersion: 2 }
    });

    const closeResponse = await app.request(
      "/api/workspace/projects/project-loop/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(cookie),
        body: JSON.stringify({
          closeReason: "Сквозной backend smoke завершен",
          lessons: [
            {
              category: "process",
              title: "Сохранять сквозной smoke",
              body: "Критические backend контуры должны проверяться единым сценарием.",
              impact: "positive"
            }
          ]
        })
      }
    );
    expect(closeResponse.status).toBe(200);
    const closeBody = await closeResponse.json();
    expect(closeBody).toMatchObject({
      projectId: "project-loop",
      auditEventId: expect.stringMatching(/^audit-/),
      snapshot: {
        projectId: "project-loop",
        projectStatusBefore: "active",
        planVersion: 2,
        closeReason: "Сквозной backend smoke завершен"
      },
      lessons: [expect.objectContaining({ title: "Сохранять сквозной smoke" })]
    });

    const closureReadResponse = await app.request(
      "/api/workspace/projects/project-loop/closure",
      { headers: { cookie } }
    );
    expect(closureReadResponse.status).toBe(200);
    await expect(closureReadResponse.json()).resolves.toMatchObject({
      project: { id: "project-loop", status: "closed" },
      snapshot: { projectId: "project-loop", planVersion: 2 }
    });

    const auditResponse = await app.request("/api/tenant/current/audit-events", {
      headers: { cookie }
    });
    expect(auditResponse.status).toBe(200);
    await expect(auditResponse.json()).resolves.toMatchObject({
      auditEvents: expect.arrayContaining([
        expect.objectContaining({
          actionType: "planning.task.created",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: "project-loop" }
        }),
        expect.objectContaining({
          actionType: "kpi.evaluated",
          sourceWorkflow: "control",
          sourceEntity: { type: "Project", id: "project-loop" }
        }),
        expect.objectContaining({
          actionType: "project.closed",
          sourceWorkflow: "closure",
          sourceEntity: { type: "Project", id: "project-loop" }
        })
      ])
    });
  });

  it("keeps key backend read models inside production-readiness smoke thresholds", async () => {
    const cookie = await loginAsAdmin();
    await createPlanningTasksBatch(cookie, 25);

    const planningP95 = await measureP95(5, () =>
      app.request("/api/workspace/projects/project-loop/planning/read-model", {
        headers: { cookie }
      })
    );
    const capacityP95 = await measureP95(3, () =>
      app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
        headers: { cookie }
      })
    );
    const searchP95 = await measureP95(5, () =>
      app.request("/api/workspace/search?q=%D0%B7%D0%B0%D0%B4%D0%B0%D1%87%D0%B0&limit=20", {
        headers: { cookie }
      })
    );
    const auditP95 = await measureP95(3, () =>
      app.request("/api/tenant/current/audit-events?limit=100", {
        headers: { cookie }
      })
    );

    expect(planningP95).toBeLessThan(3_000);
    expect(capacityP95).toBeLessThan(5_000);
    expect(searchP95).toBeLessThan(3_000);
    expect(auditP95).toBeLessThan(3_000);
  });
});

function mutationHeaders(cookie: string) {
  return {
    "content-type": "application/json",
    "x-kiss-pm-action": "same-origin",
    cookie
  };
}
