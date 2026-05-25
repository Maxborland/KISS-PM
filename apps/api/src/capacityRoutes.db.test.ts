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
      id: "access-profile-resource-reader",
      tenantId: "tenant-alpha",
      name: "Ресурсный читатель",
      permissions: ["tenant.project_resources.read"]
    },
    {
      id: "access-profile-plan-reader-no-resources",
      tenantId: "tenant-alpha",
      name: "Наблюдатель плана без ресурсов",
      permissions: ["tenant.projects.read", "tenant.project_plan.read"]
    }
  ],
  positions: [{ id: "position-engineer", tenantId: "tenant-alpha", name: "Инженер" }],
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
      positionId: "position-engineer",
      password: "admin12345"
    },
    {
      id: "user-alpha-resource-reader",
      tenantId: "tenant-alpha",
      email: "resource-reader@kiss-pm.local",
      name: "Роман Ресурсный",
      accessProfileId: "access-profile-resource-reader",
      positionId: "position-engineer",
      password: "resource12345"
    },
    {
      id: "user-alpha-plan-reader-no-resources",
      tenantId: "tenant-alpha",
      email: "plan-reader-no-resources@kiss-pm.local",
      name: "Никита Без Ресурсов",
      accessProfileId: "access-profile-plan-reader-no-resources",
      positionId: "position-engineer",
      password: "reader12345"
    }
  ]
};

describe("capacity API routes", () => {
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

  async function createProject(input: {
    projectId: string;
    opportunityId: string;
    title: string;
    status: "draft" | "active";
  }) {
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    const opportunity = await dataSource.createOpportunity({
      id: input.opportunityId,
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      primaryContactId: null,
      projectTypeId: "project-type-implementation",
      stageId: null,
      clientName: "ООО Ромашка",
      contactName: "Ирина Клиент",
      title: input.title,
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
      id: input.projectId,
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
    if (input.status === "active") {
      await dataSource.activateProjectDraft({
        tenantId: "tenant-alpha",
        projectId: draft.id
      });
    }
  }

  async function createPlanningTask(
    cookie: string,
    input: {
      projectId: string;
      taskId: string;
      assignmentId: string;
      title: string;
      workMinutes: number;
      clientPlanVersion?: number;
    }
  ) {
    const response = await app.request(
      `/api/workspace/projects/${input.projectId}/planning/apply-command`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          clientPlanVersion: input.clientPlanVersion ?? 1,
          command: {
            type: "task.create",
            payload: {
              id: input.taskId,
              projectId: input.projectId,
              title: input.title,
              statusId: "task-status-new",
              plannedStart: "2026-06-02",
              plannedFinish: "2026-06-02",
              workMinutes: input.workMinutes,
              assignments: [
                {
                  id: input.assignmentId,
                  resourceId: "user-alpha-resource-reader",
                  role: "executor",
                  unitsPermille: 1000,
                  workMinutes: input.workMinutes
                }
              ]
            }
          }
        })
      }
    );
    expect(response.status).toBe(200);
  }

  async function createPlanningReservation(
    cookie: string,
    input: {
      projectId: string;
      reservationId: string;
      workMinutes: number;
      clientPlanVersion?: number;
    }
  ) {
    const response = await app.request(
      `/api/workspace/projects/${input.projectId}/planning/apply-command`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie
        },
        body: JSON.stringify({
          clientPlanVersion: input.clientPlanVersion ?? 1,
          command: {
            type: "resource.reserve",
            payload: {
              id: input.reservationId,
              resourceId: "user-alpha-resource-reader",
              start: "2026-06-02",
              finish: "2026-06-02",
              workMinutes: input.workMinutes,
              reason: "Буфер поддержки"
            }
          }
        })
      }
    );
    expect(response.status).toBe(200);
  }

  function collectEmployeeRows(tree: {
    orgGroups: Array<{
      units: Array<{
        positions: Array<{
          rows: Array<{
            user: { id: string };
            days: Array<{
              date: string;
              workMinutes: number;
              capacityMinutes: number;
              freeMinutes: number;
              overloadMinutes: number;
              hasAbsence: boolean;
              isFreeDay: boolean;
            }>;
            projectsMixByDate?: Record<string, Array<{ projectId: string; workMinutes: number }>>;
          }>;
        }>;
      }>;
    }>;
  }) {
    return tree.orgGroups.flatMap((direction) =>
      direction.units.flatMap((unit) => unit.positions.flatMap((position) => position.rows))
    );
  }

  function findResourceDay(
    tree: Awaited<ReturnType<Response["json"]>>,
    resourceId: string,
    date: string
  ) {
    const row = collectEmployeeRows(tree).find((candidate) => candidate.user.id === resourceId);
    return row?.days.find((day) => day.date === date);
  }

  function findOrgResourceRow(
    tree: Awaited<ReturnType<Response["json"]>>,
    input: { directionId: string; unitId: string; positionId: string; resourceId: string }
  ) {
    const direction = tree.orgGroups.find(
      (candidate: { direction: { id: string } }) => candidate.direction.id === input.directionId
    );
    const unit = direction?.units.find(
      (candidate: { unit: { id: string } }) => candidate.unit.id === input.unitId
    );
    const position = unit?.positions.find(
      (candidate: { position: { id: string } }) => candidate.position.id === input.positionId
    );
    return position?.rows.find(
      (candidate: { user: { id: string } }) => candidate.user.id === input.resourceId
    );
  }

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({
      dataSource: createPostgresTenantDataSource(createDatabase(client))
    });
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, planning_command_idempotency_keys, planning_solver_runs, planning_scenario_runs, task_assignment_allocations, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, task_statuses, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      dataset,
      new Date("2026-05-21T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it("returns 403 for tree without project_resources.read", async () => {
    const cookie = await loginAs("plan-reader-no-resources@kiss-pm.local", "reader12345");
    const response = await app.request("/api/workspace/capacity/tree?monthIso=2026-05", {
      headers: { cookie }
    });
    expect(response.status).toBe(403);
  });

  it("returns capacity_invalid_query for invalid month/date/resource input", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const tree = await app.request("/api/workspace/capacity/tree?monthIso=2026-13", {
      headers: { cookie }
    });
    expect(tree.status).toBe(400);
    expect(await tree.json()).toEqual({ error: "capacity_invalid_query" });

    const drilldown = await app.request(
      "/api/workspace/capacity/drilldown?monthIso=2026-06&resourceId=&date=2026-06-02",
      { headers: { cookie } }
    );
    expect(drilldown.status).toBe(400);
    expect(await drilldown.json()).toEqual({ error: "capacity_invalid_query" });
  });

  it("rejects invalid and unreadable project filters instead of returning tenant-wide data", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const limitedCookie = await loginAs("resource-reader@kiss-pm.local", "resource12345");
    await createProject({
      projectId: "project-readable",
      opportunityId: "opportunity-readable",
      title: "Читаемый проект",
      status: "active"
    });

    const invalid = await app.request(
      "/api/workspace/capacity/tree?monthIso=2026-06&projectId=missing-project",
      { headers: { cookie: adminCookie } }
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "capacity_invalid_query" });

    const unreadable = await app.request(
      "/api/workspace/capacity/tree?monthIso=2026-06&projectId=project-readable",
      { headers: { cookie: limitedCookie } }
    );
    expect(unreadable.status).toBe(403);
    expect(await unreadable.json()).toEqual({ error: "permission_missing" });
  });

  it("aggregates active and draft capacity containers across tenant resources", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createProject({
      projectId: "project-active",
      opportunityId: "opportunity-active",
      title: "Активный проект",
      status: "active"
    });
    await createProject({
      projectId: "project-draft",
      opportunityId: "opportunity-draft",
      title: "Черновой проект",
      status: "draft"
    });
    await createProject({
      projectId: "project-draft-empty",
      opportunityId: "opportunity-draft-empty",
      title: "Пустой черновик",
      status: "draft"
    });
    await createPlanningTask(adminCookie, {
      projectId: "project-active",
      taskId: "task-active",
      assignmentId: "assignment-active",
      title: "Активная работа",
      workMinutes: 300
    });
    await createPlanningTask(adminCookie, {
      projectId: "project-draft",
      taskId: "task-draft",
      assignmentId: "assignment-draft",
      title: "Черновая работа",
      workMinutes: 240
    });

    const response = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    const row = collectEmployeeRows(body).find(
      (candidate) => candidate.user.id === "user-alpha-resource-reader"
    );
    const cell = row?.days.find((day) => day.date === "2026-06-02");
    expect(cell?.workMinutes).toBe(540);
    expect(cell?.overloadMinutes).toBe(60);
    expect(row?.projectsMixByDate?.["2026-06-02"]).toEqual(
      expect.arrayContaining([
        { projectId: "project-active", workMinutes: 300 },
        { projectId: "project-draft", workMinutes: 240 }
      ])
    );
    expect(JSON.stringify(row?.projectsMixByDate ?? {})).not.toContain("project-draft-empty");

    const projectFiltered = await app.request(
      "/api/workspace/capacity/tree?monthIso=2026-06&projectId=project-active",
      { headers: { cookie: adminCookie } }
    );
    expect(projectFiltered.status).toBe(200);
    const projectFilteredBody = await projectFiltered.json();
    expect(findResourceDay(projectFilteredBody, "user-alpha-resource-reader", "2026-06-02")).toEqual(
      expect.objectContaining({ workMinutes: 300, overloadMinutes: 60 })
    );
  });

  it("counts planning reservations in tenant load and drilldown", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const org = await app.request("/api/tenant/current/org-structure", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        functional: {
          nodes: [
            {
              id: "direction-delivery",
              nodeType: "direction",
              name: "Delivery",
              parentId: null,
              sortOrder: 0
            },
            {
              id: "unit-platform",
              nodeType: "department",
              name: "Platform",
              parentId: "direction-delivery",
              sortOrder: 0
            }
          ],
          placements: [
            {
              userId: "user-alpha-resource-reader",
              directionId: "direction-delivery",
              departmentId: "unit-platform",
              positionId: "position-engineer"
            }
          ]
        },
        project: { nodes: [], placements: [] }
      })
    });
    expect(org.status).toBe(200);
    await createProject({
      projectId: "project-reservation",
      opportunityId: "opportunity-reservation",
      title: "Проект с резервом",
      status: "active"
    });
    await createPlanningReservation(adminCookie, {
      projectId: "project-reservation",
      reservationId: "reservation-capacity",
      workMinutes: 120
    });

    const tree = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(tree.status).toBe(200);
    const treeBody = await tree.json();
    expect(findResourceDay(treeBody, "user-alpha-resource-reader", "2026-06-02")).toEqual(
      expect.objectContaining({ workMinutes: 120, freeMinutes: 360 })
    );
    expect(
      findOrgResourceRow(treeBody, {
        directionId: "direction-delivery",
        unitId: "unit-platform",
        positionId: "position-engineer",
        resourceId: "user-alpha-resource-reader"
      })
    ).toEqual(expect.objectContaining({ user: expect.objectContaining({ id: "user-alpha-resource-reader" }) }));

    const drilldown = await app.request(
      "/api/workspace/capacity/drilldown?monthIso=2026-06&resourceId=user-alpha-resource-reader&date=2026-06-02",
      { headers: { cookie: adminCookie } }
    );
    expect(drilldown.status).toBe(200);
    const body = await drilldown.json();
    expect(body.contributions).toEqual([
      expect.objectContaining({
        projectId: "project-reservation",
        projectTitle: "Проект с резервом",
        taskId: null,
        assignmentId: null,
        reservationId: "reservation-capacity",
        workMinutes: 120
      })
    ]);
  });

  it("does not leak admin-warmed project metadata to resource-only users", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const limitedCookie = await loginAs("resource-reader@kiss-pm.local", "resource12345");
    await createProject({
      projectId: "project-hidden",
      opportunityId: "opportunity-hidden",
      title: "Секретный проект",
      status: "active"
    });
    await createPlanningTask(adminCookie, {
      projectId: "project-hidden",
      taskId: "task-hidden",
      assignmentId: "assignment-hidden",
      title: "Секретная задача",
      workMinutes: 120
    });

    const adminWarm = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(adminWarm.status).toBe(200);

    const limited = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: limitedCookie }
    });
    expect(limited.status).toBe(200);
    const body = await limited.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("project-hidden");
    expect(serialized).not.toContain("Секретный проект");
    expect(serialized).toContain("__hidden__");
  });

  it("returns readable and masked drilldown contributions for employee-day", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const limitedCookie = await loginAs("resource-reader@kiss-pm.local", "resource12345");
    await createProject({
      projectId: "project-alpha",
      opportunityId: "opportunity-alpha",
      title: "Открытый проект",
      status: "active"
    });
    await createPlanningTask(adminCookie, {
      projectId: "project-alpha",
      taskId: "task-alpha",
      assignmentId: "assignment-alpha",
      title: "Открытая задача",
      workMinutes: 180
    });

    const admin = await app.request(
      "/api/workspace/capacity/drilldown?monthIso=2026-06&resourceId=user-alpha-resource-reader&date=2026-06-02",
      { headers: { cookie: adminCookie } }
    );
    expect(admin.status).toBe(200);
    const adminBody = await admin.json();
    expect(adminBody.totals).toEqual(
      expect.objectContaining({ workMinutes: 180, freeMinutes: 300, overloadMinutes: 0 })
    );
    expect(adminBody.contributions).toEqual([
      expect.objectContaining({
        projectId: "project-alpha",
        projectTitle: "Открытый проект",
        taskId: "task-alpha",
        taskTitle: "Открытая задача",
        assignmentId: "assignment-alpha",
        workMinutes: 180
      })
    ]);

    const limited = await app.request(
      "/api/workspace/capacity/drilldown?monthIso=2026-06&resourceId=user-alpha-resource-reader&date=2026-06-02",
      { headers: { cookie: limitedCookie } }
    );
    expect(limited.status).toBe(200);
    const limitedBody = await limited.json();
    expect(limitedBody.contributions).toEqual([
      {
        projectId: "__hidden__",
        projectTitle: "Недоступный проект",
        taskId: null,
        taskTitle: null,
        assignmentId: null,
        reservationId: null,
        workMinutes: 180
      }
    ]);
  });

  it("invalidates capacity cache after absence changes", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createProject({
      projectId: "project-absence",
      opportunityId: "opportunity-absence",
      title: "Проект с отсутствием",
      status: "active"
    });
    await createPlanningTask(adminCookie, {
      projectId: "project-absence",
      taskId: "task-absence",
      assignmentId: "assignment-absence",
      title: "Работа в день отпуска",
      workMinutes: 180
    });

    const before = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(before.status).toBe(200);
    expect(findResourceDay(await before.json(), "user-alpha-resource-reader", "2026-06-02")).toEqual(
      expect.objectContaining({ capacityMinutes: 480, overloadMinutes: 0 })
    );

    const absence = await app.request("/api/tenant/current/absences", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        userId: "user-alpha-resource-reader",
        type: "vacation",
        dateFrom: "2026-06-02",
        dateTo: "2026-06-02",
        reason: "Плановый отпуск"
      })
    });
    expect(absence.status).toBe(201);

    const after = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(after.status).toBe(200);
    expect(findResourceDay(await after.json(), "user-alpha-resource-reader", "2026-06-02")).toEqual(
      expect.objectContaining({ capacityMinutes: 0, overloadMinutes: 180, hasAbsence: true })
    );
  });

  it("subtracts absence capacity even when the employee has no project load", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const absence = await app.request("/api/tenant/current/absences", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kiss-pm-action": "same-origin",
        cookie: adminCookie
      },
      body: JSON.stringify({
        userId: "user-alpha-resource-reader",
        type: "vacation",
        dateFrom: "2026-06-02",
        dateTo: "2026-06-02",
        reason: "Плановый отпуск"
      })
    });
    expect(absence.status).toBe(201);

    const response = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(response.status).toBe(200);
    expect(findResourceDay(await response.json(), "user-alpha-resource-reader", "2026-06-02")).toEqual(
      expect.objectContaining({
        workMinutes: 0,
        capacityMinutes: 0,
        freeMinutes: 0,
        hasAbsence: true,
        isFreeDay: false
      })
    );
  });

  it("invalidates capacity cache after task facade creates capacity load", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createProject({
      projectId: "project-task-facade",
      opportunityId: "opportunity-task-facade",
      title: "Проект через задачи",
      status: "active"
    });

    const before = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(before.status).toBe(200);
    expect(findResourceDay(await before.json(), "user-alpha-resource-reader", "2026-06-02")).toEqual(
      expect.objectContaining({ workMinutes: 0 })
    );

    const createTask = await app.request(
      "/api/workspace/projects/project-task-facade/tasks",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({
          id: "task-facade-capacity",
          title: "Работа через фасад задач",
          plannedStart: "2026-06-02",
          plannedFinish: "2026-06-02",
          durationWorkingDays: 1,
          plannedWork: 3,
          participants: [
            { userId: "user-alpha-resource-reader", role: "executor" }
          ]
        })
      }
    );
    expect(createTask.status).toBe(201);

    const after = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(after.status).toBe(200);
    expect(findResourceDay(await after.json(), "user-alpha-resource-reader", "2026-06-02")).toEqual(
      expect.objectContaining({ workMinutes: 180 })
    );
  });

  it("invalidates capacity cache after project closure removes committed load", async () => {
    const adminCookie = await loginAs("admin@kiss-pm.local", "admin12345");
    await createProject({
      projectId: "project-closure-capacity",
      opportunityId: "opportunity-closure-capacity",
      title: "Закрываемый проект",
      status: "active"
    });
    await createPlanningTask(adminCookie, {
      projectId: "project-closure-capacity",
      taskId: "task-closure-capacity",
      assignmentId: "assignment-closure-capacity",
      title: "Работа перед закрытием",
      workMinutes: 180
    });

    const before = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(before.status).toBe(200);
    expect(findResourceDay(await before.json(), "user-alpha-resource-reader", "2026-06-02")).toEqual(
      expect.objectContaining({ workMinutes: 180 })
    );

    const close = await app.request(
      "/api/workspace/projects/project-closure-capacity/closure/close",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin",
          cookie: adminCookie
        },
        body: JSON.stringify({ closeReason: "Работы завершены" })
      }
    );
    expect(close.status).toBe(200);

    const after = await app.request("/api/workspace/capacity/tree?monthIso=2026-06", {
      headers: { cookie: adminCookie }
    });
    expect(after.status).toBe(200);
    expect(findResourceDay(await after.json(), "user-alpha-resource-reader", "2026-06-02")).toEqual(
      expect.objectContaining({ workMinutes: 0, overloadMinutes: 0 })
    );
  });

  it("returns capacity summary for admin", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");
    const response = await app.request("/api/workspace/capacity/summary?monthIso=2026-05", {
      headers: { cookie }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      monthIso: string;
      buckets: { low: number; mid: number; high: number };
      overloadProjectIds: string[];
    };
    expect(body.monthIso).toBe("2026-05");
    expect(body.buckets).toEqual(
      expect.objectContaining({ low: expect.any(Number), mid: expect.any(Number), high: expect.any(Number) })
    );
    expect(Array.isArray(body.overloadProjectIds)).toBe(true);
  });
});
