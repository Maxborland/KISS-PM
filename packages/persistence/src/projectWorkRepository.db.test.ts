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
    await client`TRUNCATE audit_events, task_participants, tasks, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      projectWorkSeed,
      new Date("2026-05-19T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE audit_events, task_participants, tasks, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
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
      status: "todo",
      priority: "high",
      plannedStart: new Date("2026-06-02T00:00:00.000Z"),
      plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
      plannedWork: 24,
      actualWork: 0,
      progress: 0,
      source: "manual",
      participants: [
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
      participants: [{ userId: "user-alpha-executor", role: "executor" }]
    });
    expect(projectTasks).toEqual([task]);
    expect(myWork).toEqual([task]);
    await expect(
      workRepository.listMyWorkTasks("tenant-alpha", "user-alpha-admin")
    ).resolves.toEqual([]);
  });
});
