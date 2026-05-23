import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";
import { createCrmActivityRepository } from "./crmActivityRepository";
import { createProjectIntakeRepository } from "./projectIntakeRepository";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";

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
    { id: "position-engineer", tenantId: "tenant-alpha", name: "Инженер" },
    { id: "position-beta-engineer", tenantId: "tenant-beta", name: "Инженер" }
  ],
  clients: [
    { id: "client-alpha", tenantId: "tenant-alpha", name: "Клиент Альфа" },
    { id: "client-beta", tenantId: "tenant-beta", name: "Клиент Бета" }
  ],
  contacts: [
    {
      id: "contact-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      name: "Ирина Альфа"
    },
    {
      id: "contact-beta",
      tenantId: "tenant-beta",
      clientId: "client-beta",
      name: "Иван Бета"
    }
  ],
  products: [
    {
      id: "product-alpha",
      tenantId: "tenant-alpha",
      name: "Внедрение KISS PM",
      type: "service",
      unit: "час",
      price: 6000
    }
  ],
  projectTypes: [
    { id: "project-type-alpha", tenantId: "tenant-alpha", name: "Внедрение" },
    { id: "project-type-beta", tenantId: "tenant-beta", name: "Внедрение" }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin-alpha@kiss-pm.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-admin",
      positionId: "position-engineer",
      password: "local-admin-password"
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
      password: "local-admin-password"
    }
  ]
};

describe("CRM activity repository", () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
  });

  beforeEach(async () => {
    await truncateActivityTestTables(client);
    await seedTenantDataset(
      createDatabase(client),
      activitySeed,
      new Date("2026-05-20T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await truncateActivityTestTables(client);
    await client.end();
  });

  it("creates tenant-scoped comments, tasks and files for different CRM entity types", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const activityRepository = createCrmActivityRepository(db);
    await createOpportunity(intakeRepository, {
      id: "opportunity-alpha",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      projectTypeId: "project-type-alpha",
      positionId: "position-engineer"
    });

    const comment = await activityRepository.createCrmActivity({
      id: "activity-comment",
      tenantId: "tenant-alpha",
      entityType: "client",
      entityId: "client-alpha",
      type: "comment",
      title: null,
      body: "Клиент подтвердил рамки внедрения.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin",
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null
    });
    const task = await activityRepository.createCrmActivity({
      id: "activity-task",
      tenantId: "tenant-alpha",
      entityType: "contact",
      entityId: "contact-alpha",
      type: "task",
      title: "Подготовить коммерческое предложение",
      body: "Собрать КП по итогам первичной квалификации.",
      status: "todo",
      dueDate: new Date("2026-06-01T00:00:00.000Z"),
      assigneeUserId: "user-alpha-assignee",
      authorUserId: "user-alpha-admin",
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null
    });
    const file = await activityRepository.createCrmActivity({
      id: "activity-file",
      tenantId: "tenant-alpha",
      entityType: "product",
      entityId: "product-alpha",
      type: "file",
      title: "Бриф продукта",
      body: null,
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin",
      fileUrl: "https://example.test/brief.pdf",
      fileSizeBytes: 2048,
      mimeType: "application/pdf"
    });
    expect(comment).toBeDefined();
    expect(task).toBeDefined();
    expect(file).toBeDefined();
    await activityRepository.createCrmActivity({
      id: "activity-opportunity",
      tenantId: "tenant-alpha",
      entityType: "opportunity",
      entityId: "opportunity-alpha",
      type: "comment",
      title: null,
      body: "Комментарий сделки.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin",
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null
    });

    await expect(
      activityRepository.listCrmActivities("tenant-alpha", "client", "client-alpha")
    ).resolves.toMatchObject([{ id: comment!.id, entityType: "client" }]);
    await expect(
      activityRepository.listCrmActivities("tenant-alpha", "contact", "contact-alpha")
    ).resolves.toMatchObject([{ id: task!.id, entityType: "contact" }]);
    await expect(
      activityRepository.listCrmActivities("tenant-alpha", "product", "product-alpha")
    ).resolves.toMatchObject([
      {
        id: file!.id,
        entityType: "product",
        fileUrl: "https://example.test/brief.pdf",
        fileSizeBytes: 2048,
        mimeType: "application/pdf"
      }
    ]);
    await expect(
      activityRepository.listCrmActivities("tenant-alpha", "opportunity", "opportunity-alpha")
    ).resolves.toMatchObject([{ id: "activity-opportunity" }]);
  });

  it("keeps activity isolated by tenant and entity id", async () => {
    const activityRepository = createCrmActivityRepository(createDatabase(client));

    await activityRepository.createCrmActivity({
      id: "activity-alpha",
      tenantId: "tenant-alpha",
      entityType: "client",
      entityId: "client-alpha",
      type: "comment",
      title: null,
      body: "Комментарий основного клиента.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin",
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null
    });
    await activityRepository.createCrmActivity({
      id: "activity-neighbor",
      tenantId: "tenant-alpha",
      entityType: "contact",
      entityId: "contact-alpha",
      type: "comment",
      title: null,
      body: "Комментарий контакта.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-alpha-admin",
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null
    });
    await activityRepository.createCrmActivity({
      id: "activity-beta",
      tenantId: "tenant-beta",
      entityType: "client",
      entityId: "client-beta",
      type: "comment",
      title: null,
      body: "Комментарий другого tenant.",
      status: null,
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-beta-admin",
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null
    });

    await expect(
      activityRepository.listCrmActivities("tenant-alpha", "client", "client-alpha")
    ).resolves.toMatchObject([{ id: "activity-alpha" }]);
    await expect(
      activityRepository.listCrmActivities("tenant-alpha", "contact", "client-alpha")
    ).resolves.toEqual([]);
    await expect(
      activityRepository.listCrmActivities("tenant-alpha", "client", "client-beta")
    ).resolves.toEqual([]);
  });

  it("transitions only the matching tenant-scoped task", async () => {
    const activityRepository = createCrmActivityRepository(createDatabase(client));
    await activityRepository.createCrmActivity({
      id: "activity-task",
      tenantId: "tenant-alpha",
      entityType: "client",
      entityId: "client-alpha",
      type: "task",
      title: "Созвониться с клиентом",
      body: null,
      status: "todo",
      dueDate: null,
      assigneeUserId: "user-alpha-assignee",
      authorUserId: "user-alpha-admin",
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null
    });
    await activityRepository.createCrmActivity({
      id: "activity-task",
      tenantId: "tenant-beta",
      entityType: "client",
      entityId: "client-beta",
      type: "task",
      title: "Созвониться с другим tenant",
      body: null,
      status: "todo",
      dueDate: null,
      assigneeUserId: null,
      authorUserId: "user-beta-admin",
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null
    });

    const completed = await activityRepository.transitionCrmActivityStatus({
      tenantId: "tenant-alpha",
      entityType: "client",
      entityId: "client-alpha",
      activityId: "activity-task",
      status: "done"
    });
    const betaTask = await activityRepository.listCrmActivities(
      "tenant-beta",
      "client",
      "client-beta"
    );

    expect(completed).toMatchObject({
      found: true,
      changed: true,
      activity: {
        id: "activity-task",
        tenantId: "tenant-alpha",
        entityType: "client",
        entityId: "client-alpha",
        status: "done"
      }
    });
    expect(betaTask).toMatchObject([{ id: "activity-task", status: "todo" }]);
    await expect(
      activityRepository.transitionCrmActivityStatus({
        tenantId: "tenant-alpha",
        entityType: "client",
        entityId: "client-beta",
        activityId: "activity-task",
        status: "done"
      })
    ).resolves.toEqual({ found: false });
  });

  it("blocks opportunity activity writes and task transitions after finalization", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const activityRepository = createCrmActivityRepository(db);
    await createOpportunity(intakeRepository, {
      id: "opportunity-final",
      tenantId: "tenant-alpha",
      clientId: "client-alpha",
      projectTypeId: "project-type-alpha",
      positionId: "position-engineer"
    });
    await activityRepository.createCrmActivity({
      id: "activity-final-task",
      tenantId: "tenant-alpha",
      entityType: "opportunity",
      entityId: "opportunity-final",
      type: "task",
      title: "Закрыть вопрос",
      body: null,
      status: "todo",
      dueDate: null,
      assigneeUserId: "user-alpha-assignee",
      authorUserId: "user-alpha-admin",
      fileUrl: null,
      fileSizeBytes: null,
      mimeType: null
    });
    await intakeRepository.finalizeOpportunity({
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-final",
      status: "lost_rejected"
    });

    await expect(
      activityRepository.createCrmActivity({
        id: "activity-after-final",
        tenantId: "tenant-alpha",
        entityType: "opportunity",
        entityId: "opportunity-final",
        type: "comment",
        title: null,
        body: "Комментарий после закрытия не должен сохраниться.",
        status: null,
        dueDate: null,
        assigneeUserId: null,
        authorUserId: "user-alpha-admin",
        fileUrl: null,
        fileSizeBytes: null,
        mimeType: null
      })
    ).resolves.toBeUndefined();
    await expect(
      activityRepository.transitionCrmActivityStatus({
        tenantId: "tenant-alpha",
        entityType: "opportunity",
        entityId: "opportunity-final",
        activityId: "activity-final-task",
        status: "done"
      })
    ).resolves.toEqual({ locked: true });
    await expect(
      activityRepository.listCrmActivities(
        "tenant-alpha",
        "opportunity",
        "opportunity-final"
      )
    ).resolves.toMatchObject([{ id: "activity-final-task", status: "todo" }]);
  });

  it("rejects malformed shared activity rows", async () => {
    await expect(
      client`
        INSERT INTO crm_activities (
          id,
          tenant_id,
          entity_type,
          entity_id,
          type,
          title,
          body,
          status,
          author_user_id,
          created_at,
          updated_at
        )
        VALUES (
          'activity-invalid-entity',
          'tenant-alpha',
          'invoice',
          'client-alpha',
          'comment',
          null,
          'Недопустимая сущность',
          null,
          'user-alpha-admin',
          now(),
          now()
        )
      `
    ).rejects.toThrow();
    await expect(
      client`
        INSERT INTO crm_activities (
          id,
          tenant_id,
          entity_type,
          entity_id,
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
          'client',
          'client-alpha',
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
  });
});

async function truncateActivityTestTables(client: PostgresClient) {
  await client`TRUNCATE crm_activities, audit_events, task_participants, tasks, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, products, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
}

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
