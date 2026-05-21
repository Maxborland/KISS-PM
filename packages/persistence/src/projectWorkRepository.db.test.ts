import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";
import { createProjectIntakeRepository } from "./projectIntakeRepository";
import { createProjectWorkRepository } from "./projectWorkRepository";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

const projectWorkSeed: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа Проект" }],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: ["tenant.projects.read", "tenant.projects.manage"]
    }
  ],
  positions: [
    {
      id: "position-engineer",
      tenantId: "tenant-alpha",
      name: "Инженер"
    }
  ],
  clients: [
    {
      id: "client-romashka",
      tenantId: "tenant-alpha",
      name: "ООО Ромашка"
    }
  ],
  projectTypes: [
    {
      id: "project-type-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение"
    }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-engineer",
      password: "local-admin-password"
    },
    {
      id: "user-alpha-executor",
      tenantId: "tenant-alpha",
      email: "executor@kiss-pm.local",
      name: "Егор Исполнитель",
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-engineer",
      password: "local-executor-password"
    }
  ]
};

describe("project work repository", () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
  });

  beforeEach(async () => {
    await client`TRUNCATE audit_events, task_activities, task_participants, tasks, task_statuses, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      projectWorkSeed,
      new Date("2026-05-19T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, task_activities, task_participants, tasks, task_statuses, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("creates a tenant-scoped project task and returns it in project and My Work views", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const opportunity = await intakeRepository.createOpportunity({
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
    const draft = await intakeRepository.createProjectDraftFromOpportunity({
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
    const activeProject = await intakeRepository.activateProjectDraft({
      tenantId: "tenant-alpha",
      projectId: draft.id
    });

    const task = await workRepository.createTask({
      id: "task-alpha",
      tenantId: "tenant-alpha",
      projectId: activeProject.id,
      stageId: null,
      title: "Подготовить план внедрения",
      description: "Собрать стартовый план работ",
      status: "new",
      statusId: "task-status-new",
      statusName: "Новая",
      statusCategory: "new",
      priority: "high",
      requesterUserId: "user-alpha-admin",
      ownerUserId: "user-alpha-executor",
      plannedStart: new Date("2026-06-02T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
      durationWorkingDays: 4,
      plannedWork: 24,
      actualWork: 0,
      progress: 0,
      requiresAcceptance: false,
      source: "manual",
      participants: [
        {
          userId: "user-alpha-admin",
          role: "requester"
        },
        {
          userId: "user-alpha-executor",
          role: "executor"
        }
      ]
    });
    const projectTasks = await workRepository.listProjectTasks(
      "tenant-alpha",
      "project-alpha"
    );
    const myWork = await workRepository.listMyWorkTasks(
      "tenant-alpha",
      "user-alpha-executor"
    );

    expect(task).toMatchObject({
      id: "task-alpha",
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      title: "Подготовить план внедрения",
      participants: [
        { userId: "user-alpha-admin", role: "requester" },
        { userId: "user-alpha-executor", role: "executor" }
      ]
    });
    expect(projectTasks).toEqual([
      expect.objectContaining({ id: task.id, statusId: "task-status-new" })
    ]);
    expect(myWork).toEqual([
      expect.objectContaining({ id: task.id, statusId: "task-status-new" })
    ]);
    await expect(
      workRepository.listMyWorkTasks("tenant-alpha", "user-alpha-admin")
    ).resolves.toEqual([
      expect.objectContaining({ id: task.id, statusId: "task-status-new" })
    ]);
  });

  it("updates task status and keeps tenant/project boundaries", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const opportunity = await intakeRepository.createOpportunity({
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
    const draft = await intakeRepository.createProjectDraftFromOpportunity({
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
    await intakeRepository.activateProjectDraft({
      tenantId: "tenant-alpha",
      projectId: draft.id
    });
    await workRepository.createTask({
      id: "task-alpha",
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      stageId: null,
      title: "Подготовить план внедрения",
      description: null,
      status: "new",
      statusId: "task-status-new",
      statusName: "Новая",
      statusCategory: "new",
      priority: "normal",
      requesterUserId: "user-alpha-admin",
      ownerUserId: "user-alpha-executor",
      plannedStart: new Date("2026-06-02T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
      durationWorkingDays: 4,
      plannedWork: 24,
      actualWork: 0,
      progress: 0,
      requiresAcceptance: false,
      source: "manual",
      participants: [
        { userId: "user-alpha-admin", role: "requester" },
        { userId: "user-alpha-executor", role: "executor" }
      ]
    });

    const updated = await workRepository.updateTaskStatus({
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      taskId: "task-alpha",
      expectedStatus: "new",
      status: "done",
      statusId: "task-status-done",
      progress: 100
    });
    const wrongProject = await workRepository.updateTaskStatus({
      tenantId: "tenant-alpha",
      projectId: "project-missing",
      taskId: "task-alpha",
      expectedStatus: "new",
      status: "waiting",
      statusId: "task-status-waiting",
      progress: 0
    });

    expect(updated).toMatchObject({
      id: "task-alpha",
      status: "done",
      progress: 100,
      participants: expect.arrayContaining([
        { userId: "user-alpha-admin", role: "requester" },
        { userId: "user-alpha-executor", role: "executor" }
      ])
    });
    expect(wrongProject).toBeUndefined();
    await expect(
      workRepository.listProjectTasks("tenant-alpha", "project-alpha")
    ).resolves.toEqual([expect.objectContaining({ id: "task-alpha", status: "done" })]);
    await expect(
      workRepository.updateTaskStatus({
        tenantId: "tenant-alpha",
        projectId: "project-alpha",
        taskId: "task-alpha",
        expectedStatus: "new",
        status: "waiting",
        statusId: "task-status-waiting",
        progress: 100
      })
    ).resolves.toBeUndefined();
  });
});
