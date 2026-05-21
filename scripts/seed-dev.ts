import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import {
  createDatabase,
  createPostgresClient,
  createTenantAdminSeedProfile,
  seedTenantDataset,
  opportunityDemands,
  opportunities,
  projectPositionDemands,
  projects,
  taskActivities,
  taskParticipants,
  tasks,
  type KissPmDatabase,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:change_me_local_dev_only@127.0.0.1:55432/kiss_pm";
const demo = createDemoTenantDataset();
const dataset: SeedTenantDataset = {
  tenants: demo.tenants,
  accessProfiles: demo.tenants.map((tenant) =>
    createTenantAdminSeedProfile({
      id:
        tenant.id === "tenant-alpha"
          ? "access-profile-alpha-admin"
          : "access-profile-beta-admin",
      tenantId: tenant.id
    })
  ),
  positions: [
    {
      id: "position-project-manager",
      tenantId: "tenant-alpha",
      name: "Руководитель проекта",
      description: "Отвечает за план, ресурсы и управленческий контур проекта"
    },
    {
      id: "position-engineer",
      tenantId: "tenant-alpha",
      name: "Инженер",
      description: "Участвует в проектных работах и ресурсном планировании"
    }
  ],
  clients: [
    {
      id: "client-romashka",
      tenantId: "tenant-alpha",
      name: "ООО Ромашка",
      description: "Демо-клиент для CRM intake"
    }
  ],
  contacts: [
    {
      id: "contact-irina",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      name: "Ирина Клиент",
      email: "irina@romashka.example",
      phone: "+7 913 000-00-00",
      telegram: "@irina_client",
      role: "Заказчик"
    }
  ],
  products: [
    {
      id: "product-kiss-pm-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение KISS PM",
      sku: "KISS-IMPL",
      type: "service",
      unit: "час",
      price: 6000,
      description: "Проектная услуга внедрения и настройки управленческого контура"
    },
    {
      id: "product-project-audit",
      tenantId: "tenant-alpha",
      name: "Аудит проектного контура",
      sku: "KISS-AUDIT",
      type: "service",
      unit: "пакет",
      price: 180000,
      description: "Разовый аудит проектов, ресурсов и управленческих сигналов"
    }
  ],
  projectTypes: [
    {
      id: "project-type-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение",
      description: "Проект внедрения продукта или системы"
    }
  ],
  dealStages: [
    {
      id: "deal-stage-new",
      tenantId: "tenant-alpha",
      name: "Новая",
      sortOrder: 10
    },
    {
      id: "deal-stage-qualified",
      tenantId: "tenant-alpha",
      name: "Квалификация",
      sortOrder: 20
    },
    {
      id: "deal-stage-ready",
      tenantId: "tenant-alpha",
      name: "Готова к оценке",
      sortOrder: 30
    }
  ],
  users: demo.users.map((user) => ({
    ...user,
    email:
      user.id === "user-alpha-admin"
        ? "admin@kiss-pm.local"
        : "beta@kiss-pm.local",
    positionId:
      user.id === "user-alpha-admin" ? "position-project-manager" : null,
    password: user.id === "user-alpha-admin" ? "local-admin-password" : "local-beta-password"
  })).concat([
    {
      id: "user-alpha-engineer",
      tenantId: "tenant-alpha",
      name: "Игорь Инженер",
      accessProfileId: "access-profile-alpha-admin",
      email: "engineer@kiss-pm.local",
      positionId: "position-engineer",
      password: "engineer12345"
    }
  ])
};
const client = createPostgresClient(databaseUrl);

try {
  const db = createDatabase(client);
  await seedTenantDataset(
    db,
    dataset,
    new Date("2026-05-18T00:00:00.000Z")
  );
  await seedDemoProjectWork(db, new Date("2026-05-20T09:00:00.000Z"));
  console.log("Seeded dev tenants, users and task workspace data");
} finally {
  await client.end();
}

async function seedDemoProjectWork(db: KissPmDatabase, createdAt: Date): Promise<void> {
  await db.transaction(async (transaction) => {
    await transaction
      .insert(opportunities)
      .values({
        id: "opportunity-demo-crm-intake",
        tenantId: "tenant-alpha",
        clientId: "client-romashka",
        primaryContactId: "contact-irina",
        ownerUserId: "user-alpha-admin",
        projectTypeId: "project-type-implementation",
        stageId: "deal-stage-ready",
        clientName: "ООО Ромашка",
        contactName: "Ирина Клиент",
        title: "CRM intake",
        projectType: "Внедрение",
        description: "Демо-сделка для проверки задач, канбана и карточки задачи",
        plannedStart: new Date("2026-05-20T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-12T00:00:00.000Z"),
        contractValue: 960000,
        plannedHourlyRate: 6000,
        plannedHours: 160,
        probability: 70,
        status: "project_created",
        templateId: null,
        feasibilityStatus: "sufficient",
        feasibilityResult: null,
        feasibilityCheckedAt: createdAt,
        customFieldValues: {},
        createdAt,
        updatedAt: createdAt
      })
      .onConflictDoNothing();

    await transaction
      .insert(opportunityDemands)
      .values({
        tenantId: "tenant-alpha",
        opportunityId: "opportunity-demo-crm-intake",
        positionId: "position-engineer",
        requiredHours: 80
      })
      .onConflictDoNothing();

    await transaction
      .insert(projects)
      .values({
        id: "project-demo-crm-intake",
        tenantId: "tenant-alpha",
        sourceOpportunityId: "opportunity-demo-crm-intake",
        clientId: "client-romashka",
        projectTypeId: "project-type-implementation",
        title: "CRM intake",
        clientName: "ООО Ромашка",
        status: "active",
        plannedStart: new Date("2026-05-20T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-12T00:00:00.000Z"),
        contractValue: 960000,
        plannedHours: 160,
        templateId: null,
        createdAt,
        activatedAt: createdAt
      })
      .onConflictDoNothing();

    await transaction
      .insert(projectPositionDemands)
      .values({
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        positionId: "position-engineer",
        requiredHours: 80
      })
      .onConflictDoNothing();

    const demoTasks = [
      {
        id: "task-demo-resource-estimate",
        title: "Подготовить ресурсную оценку по сделке",
        description: "Проверить доступность роли Инженер: 100 ч и зафиксировать предупреждения.",
        status: "in_progress",
        statusId: "task-status-in-progress",
        priority: "high",
        plannedStart: new Date("2026-05-20T00:00:00.000Z"),
        plannedFinish: new Date("2026-05-22T00:00:00.000Z"),
        durationWorkingDays: 3,
        plannedWork: 12,
        requiresAcceptance: true,
        coExecutors: ["user-alpha-engineer"]
      },
      {
        id: "task-demo-team-setup",
        title: "Согласовать состав команды для Ромашка",
        description: "Подтвердить ответственного и соисполнителей перед запуском проектного контура.",
        status: "new",
        statusId: "task-status-new",
        priority: "normal",
        plannedStart: new Date("2026-05-21T00:00:00.000Z"),
        plannedFinish: new Date("2026-05-21T00:00:00.000Z"),
        durationWorkingDays: 1,
        plannedWork: 4,
        requiresAcceptance: false,
        coExecutors: []
      },
      {
        id: "task-demo-description",
        title: "Обновить описание задачи в проектном контуре",
        description: "Собрать контекст по сделке и перенести его в карточку проекта.",
        status: "waiting",
        statusId: "task-status-waiting",
        priority: "normal",
        plannedStart: new Date("2026-05-23T00:00:00.000Z"),
        plannedFinish: new Date("2026-05-23T00:00:00.000Z"),
        durationWorkingDays: 2,
        plannedWork: 6,
        requiresAcceptance: false,
        coExecutors: []
      },
      {
        id: "task-demo-gantt-review",
        title: "Проверить результат импорта Gantt",
        description: "Сверить связи и сроки до передачи результата постановщику.",
        status: "review",
        statusId: "task-status-review",
        priority: "critical",
        plannedStart: new Date("2026-05-18T00:00:00.000Z"),
        plannedFinish: new Date("2026-05-19T00:00:00.000Z"),
        durationWorkingDays: 2,
        plannedWork: 2,
        requiresAcceptance: true,
        coExecutors: ["user-alpha-engineer"]
      },
      {
        id: "task-demo-smoke",
        title: "Закрыть smoke замечание по канбану",
        description: "Проверить создание задачи из колонки и открытие карточки.",
        status: "done",
        statusId: "task-status-done",
        priority: "normal",
        plannedStart: new Date("2026-05-18T00:00:00.000Z"),
        plannedFinish: new Date("2026-05-20T00:00:00.000Z"),
        durationWorkingDays: 1,
        plannedWork: 1,
        requiresAcceptance: false,
        coExecutors: []
      }
    ] as const;

    for (const task of demoTasks) {
      await transaction
        .insert(tasks)
        .values({
          id: task.id,
          tenantId: "tenant-alpha",
          projectId: "project-demo-crm-intake",
          stageId: null,
          title: task.title,
          description: task.description,
          status: task.status,
          statusId: task.statusId,
          priority: task.priority,
          requesterUserId: "user-alpha-admin",
          ownerUserId: "user-alpha-admin",
          plannedStart: task.plannedStart,
          plannedFinish: task.plannedFinish,
          durationWorkingDays: task.durationWorkingDays,
          plannedWork: task.plannedWork,
          actualWork: task.status === "done" ? task.plannedWork : 0,
          progress: task.status === "done" ? 100 : task.status === "review" ? 80 : 0,
          requiresAcceptance: task.requiresAcceptance,
          source: "manual",
          createdAt,
          updatedAt: createdAt,
          archivedAt: null
        })
        .onConflictDoNothing();

      await transaction
        .insert(taskParticipants)
        .values([
          {
            tenantId: "tenant-alpha",
            taskId: task.id,
            userId: "user-alpha-admin",
            role: "requester"
          },
          {
            tenantId: "tenant-alpha",
            taskId: task.id,
            userId: "user-alpha-admin",
            role: "executor"
          },
          ...task.coExecutors.map((userId) => ({
            tenantId: "tenant-alpha",
            taskId: task.id,
            userId,
            role: "co_executor"
          }))
        ])
        .onConflictDoNothing();

      await transaction
        .insert(taskActivities)
        .values({
          id: `${task.id}-activity-created`,
          tenantId: "tenant-alpha",
          taskId: task.id,
          type: "system",
          title: "Задача создана",
          body: `Статус: ${task.statusId}. Ответственный: Анна Администратор.`,
          fileUrl: null,
          fileSizeBytes: null,
          mimeType: null,
          authorUserId: "user-alpha-admin",
          createdAt,
          updatedAt: createdAt
        })
        .onConflictDoNothing();
    }
  });
}
