import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";
import { createOpportunityActivityRepository } from "./opportunityActivityRepository";
import { createProjectIntakeRepository } from "./projectIntakeRepository";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const activitySeed: SeedTenantDataset = {
  tenants: [
    { id: "tenant-alpha", name: "Альфа Проект" },
    { id: "tenant-beta", name: "Бета Проект" }
  ],
  accessProfiles: [
    {
      id: "access-profile-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: ["tenant.opportunities.read", "tenant.opportunities.manage"]
    },
    {
      id: "access-profile-beta-admin",
      tenantId: "tenant-beta",
      name: "Администратор",
      permissions: ["tenant.opportunities.read", "tenant.opportunities.manage"]
    }
  ],
  positions: [
    {
      id: "position-engineer",
      tenantId: "tenant-alpha",
      name: "Инженер"
    },
    {
      id: "position-beta-engineer",
      tenantId: "tenant-beta",
      name: "Инженер"
    }
  ],
  clients: [
    {
      id: "client-alpha",
      tenantId: "tenant-alpha",
      name: "Клиент Альфа"
    },
    {
      id: "client-beta",
      tenantId: "tenant-beta",
      name: "Клиент Бета"
    }
  ],
  projectTypes: [
    {
      id: "project-type-alpha",
      tenantId: "tenant-alpha",
      name: "Внедрение"
    },
    {
      id: "project-type-beta",
      tenantId: "tenant-beta",
      name: "Внедрение"
    }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin-alpha@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-admin",
      positionId: "position-engineer",
      password: "admin12345"
    },
    {
      id: "user-alpha-assignee",
      tenantId: "tenant-alpha",
      email: "assignee-alpha@kiss-pm.local",
      name: "Алексей Исполнитель",
      accessProfileId: "access-profile-admin",
      positionId: "position-engineer",
      password: "assignee12345"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "admin-beta@kiss-pm.local",
      name: "Борис Администратор",
      accessProfileId: "access-profile-beta-admin",
      positionId: "position-beta-engineer",
      password: "admin12345"
    }
  ]
};

describe("opportunity activity repository", () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
  });

  beforeEach(async () => {
    await client`TRUNCATE opportunity_activities, audit_events, task_participants, tasks, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      activitySeed,
      new Date("2026-05-20T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE opportunity_activities, audit_events, task_participants, tasks, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("creates tenant-scoped comments and tasks and lists them newest first", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const activityRepository = createOpportunityActivityRepository(db);
    await createOpportunity(intakeRepository, {
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      projectTypeId: "project-type-alpha",
      positionId: "position-engineer"
    });

    const comment = await activityRepository.createOpportunityActivity({
      id: "activity-comment",
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-alpha",
      type: "comment",
      title: null,
      body: "Клиент подтвердил рамки внедрения.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin"
    });
    const task = await activityRepository.createOpportunityActivity({
      id: "activity-task",
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-alpha",
      type: "task",
      title: "Подготовить коммерческое предложение",
      body: "Собрать КП по итогам первичной квалификации.",
      status: "todo",
      dueDate: new Date("2026-06-01T00:00:00.000Z"),
      assigneeUserId: "user-alpha-assignee",
      authorUserId: "user-alpha-admin"
    });
    const activities = await activityRepository.listOpportunityActivities(
      "tenant-alpha",
      "opportunity-alpha"
    );

    expect(comment).toMatchObject({
      id: "activity-comment",
      type: "comment",
      body: "Клиент подтвердил рамки внедрения.",
      status: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin"
    });
    expect(task).toMatchObject({
      id: "activity-task",
      type: "task",
      title: "Подготовить коммерческое предложение",
      status: "todo",
      dueDate: new Date("2026-06-01T00:00:00.000Z"),
      assigneeUserId: "user-alpha-assignee"
    });
    expect(activities.map((activity) => activity.id)).toEqual([
      "activity-task",
      "activity-comment"
    ]);
  });

  it("keeps activity isolated by tenant and opportunity", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const activityRepository = createOpportunityActivityRepository(db);
    await createOpportunity(intakeRepository, {
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      projectTypeId: "project-type-alpha",
      positionId: "position-engineer"
    });
    await createOpportunity(intakeRepository, {
      id: "opportunity-neighbor",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      projectTypeId: "project-type-alpha",
      positionId: "position-engineer"
    });
    await createOpportunity(intakeRepository, {
      id: "opportunity-beta",
      tenantId: "tenant-beta",
      clientId: "client-beta",
      projectTypeId: "project-type-beta",
      positionId: "position-beta-engineer"
    });

    await activityRepository.createOpportunityActivity({
      id: "activity-alpha",
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-alpha",
      type: "comment",
      title: null,
      body: "Комментарий основной сделки.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin"
    });
    await activityRepository.createOpportunityActivity({
      id: "activity-neighbor",
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-neighbor",
      type: "comment",
      title: null,
      body: "Комментарий соседней сделки.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin"
    });
    await activityRepository.createOpportunityActivity({
      id: "activity-beta",
      tenantId: "tenant-beta",
      opportunityId: "opportunity-beta",
      type: "comment",
      title: null,
      body: "Комментарий другого tenant.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-beta-admin"
    });

    await expect(
      activityRepository.listOpportunityActivities("tenant-alpha", "opportunity-alpha")
    ).resolves.toMatchObject([{ id: "activity-alpha" }]);
    await expect(
      activityRepository.listOpportunityActivities("tenant-alpha", "opportunity-beta")
    ).resolves.toEqual([]);
    await expect(
      activityRepository.createOpportunityActivity({
        id: "activity-cross-tenant",
        tenantId: "tenant-alpha",
        opportunityId: "opportunity-beta",
        type: "comment",
        title: null,
        body: "Попытка привязки к чужой сделке.",
        status: null,
        dueDate: null,
        assigneeUserId: null,
        authorUserId: "user-alpha-admin"
      })
    ).rejects.toThrow();
  });

  it("updates only the tenant-scoped task activity", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const activityRepository = createOpportunityActivityRepository(db);
    await createOpportunity(intakeRepository, {
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      projectTypeId: "project-type-alpha",
      positionId: "position-engineer"
    });
    await createOpportunity(intakeRepository, {
      id: "opportunity-beta",
      tenantId: "tenant-beta",
      clientId: "client-beta",
      projectTypeId: "project-type-beta",
      positionId: "position-beta-engineer"
    });
    await activityRepository.createOpportunityActivity({
      id: "activity-task",
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-alpha",
      type: "task",
      title: "Созвониться с клиентом",
      body: null,
      status: "todo",
      dueDate: null,
      assigneeUserId: "user-alpha-assignee",
      authorUserId: "user-alpha-admin"
    });
    await activityRepository.createOpportunityActivity({
      id: "activity-task",
      tenantId: "tenant-beta",
      opportunityId: "opportunity-beta",
      type: "task",
      title: "Созвониться с другим tenant",
      body: null,
      status: "todo",
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-beta-admin"
    });

    const completed = await activityRepository.updateOpportunityActivity({
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-alpha",
      activityId: "activity-task",
      status: "done"
    });
    const betaTask = await activityRepository.listOpportunityActivities(
      "tenant-beta",
      "opportunity-beta"
    );

    expect(completed).toMatchObject({
      id: "activity-task",
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-alpha",
      status: "done"
    });
    expect(betaTask).toMatchObject([{ id: "activity-task", status: "todo" }]);
    await expect(
      activityRepository.updateOpportunityActivity({
        tenantId: "tenant-alpha",
        opportunityId: "opportunity-beta",
        activityId: "activity-task",
        status: "done"
      })
    ).resolves.toBeUndefined();
  });

  it("rejects malformed activity rows and preserves activity on accidental opportunity delete", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const activityRepository = createOpportunityActivityRepository(db);
    await createOpportunity(intakeRepository, {
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      projectTypeId: "project-type-alpha",
      positionId: "position-engineer"
    });
    await activityRepository.createOpportunityActivity({
      id: "activity-comment",
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-alpha",
      type: "comment",
      title: null,
      body: "История сделки не должна исчезнуть каскадом.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin"
    });

    await expect(
      client`
        INSERT INTO opportunity_activities (
          id,
          tenant_id,
          opportunity_id,
          type,
          title,
          body,
          status,
          author_user_id,
          created_at,
          updated_at
        )
        VALUES (
          'activity-invalid-type',
          'tenant-alpha',
          'opportunity-alpha',
          'system',
          null,
          'Недопустимый тип',
          null,
          'user-alpha-admin',
          now(),
          now()
        )
      `
    ).rejects.toThrow();
    await expect(
      client`
        INSERT INTO opportunity_activities (
          id,
          tenant_id,
          opportunity_id,
          type,
          title,
          body,
          status,
          author_user_id,
          created_at,
          updated_at
        )
        VALUES (
          'activity-invalid-comment-status',
          'tenant-alpha',
          'opportunity-alpha',
          'comment',
          null,
          'Комментарий не может иметь статус задачи',
          'done',
          'user-alpha-admin',
          now(),
          now()
        )
      `
    ).rejects.toThrow();
    await expect(
      client`
        DELETE FROM opportunities
        WHERE tenant_id = 'tenant-alpha' AND id = 'opportunity-alpha'
      `
    ).rejects.toThrow();
    await expect(
      activityRepository.listOpportunityActivities("tenant-alpha", "opportunity-alpha")
    ).resolves.toHaveLength(1);
  });
});

async function createOpportunity(
  repository: ReturnType<typeof createProjectIntakeRepository>,
  input: {
    id: string;
    tenantId: string;
    clientId: string;
    projectTypeId: string;
    positionId: string;
  }
) {
  return repository.createOpportunity({
    id: input.id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    primaryContactId: null,
    projectTypeId: input.projectTypeId,
    stageId: null,
    clientName: input.clientId,
    contactName: "Контакт не выбран",
    title: `Сделка ${input.id}`,
    projectType: input.projectTypeId,
    description: null,
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 600000,
    plannedHourlyRate: 6000,
    plannedHours: 100,
    probability: 60,
    status: "new",
    templateId: null,
    demand: [{ positionId: input.positionId, requiredHours: 100 }]
  });
}
