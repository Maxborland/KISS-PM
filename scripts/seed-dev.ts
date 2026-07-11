import { and, eq, isNull } from "drizzle-orm";
import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import {
  calendarExceptions,
  communicationChannelMembers,
  communicationChannels,
  conversations,
  createDatabase,
  createPostgresClient,
  createTenantAdminSeedProfile,
  discussionMessages,
  seedTenantDataset,
  meetingParticipants,
  meetings,
  opportunityDemands,
  opportunities,
  planVersions,
  projectBaselineAssignments,
  projectBaselineTasks,
  projectBaselines,
  projectCalendars,
  projectPositionDemands,
  projects,
  resourceCalendars,
  resourceReservations,
  taskActivities,
  taskAssignments,
  taskDependencies,
  taskParticipants,
  tasks,
  tenantOrgNodes,
  tenantUserOrgPlacements,
  userNotifications,
  type KissPmDatabase,
  type SeedAccessProfile,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";
const demo = createDemoTenantDataset();
const TENANT_ID = "tenant-alpha";
const dataset: SeedTenantDataset = {
  tenants: demo.tenants,
  accessProfiles: demo.tenants
    .map((tenant) =>
      createTenantAdminSeedProfile({
        id:
          tenant.id === "tenant-alpha"
            ? "access-profile-alpha-admin"
            : "access-profile-beta-admin",
        tenantId: tenant.id
      })
    )
    .concat([
      {
        id: "access-profile-resource-reader",
        tenantId: "tenant-alpha",
        name: "Наблюдатель ресурсов",
        permissions: ["tenant.project_resources.read"]
      },
      {
        id: "access-profile-crm-reader",
        tenantId: "tenant-alpha",
        name: "Наблюдатель CRM",
        permissions: [
          "tenant.clients.read",
          "tenant.contacts.read",
          "tenant.products.read",
          "tenant.project_types.read",
          "tenant.deal_stages.read",
          "tenant.crm_pipelines.read",
          "tenant.opportunities.read",
          "tenant.users.read"
        ]
      },
      {
        id: "access-profile-plan-reader-no-resources",
        tenantId: "tenant-alpha",
        name: "Наблюдатель плана без ресурсов",
        permissions: [
          "tenant.projects.read",
          "tenant.project_plan.read",
          "tenant.planning_scenarios.preview"
        ]
      }
    ] satisfies SeedAccessProfile[]),
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
    },
    {
      id: "position-analyst",
      tenantId: "tenant-alpha",
      name: "Аналитик",
      description: "Собирает требования и готовит аналитику по проектам"
    },
    {
      id: "position-lead",
      tenantId: "tenant-alpha",
      name: "Тимлид",
      description: "Ведёт команду проекта и отвечает за инженерные решения"
    }
  ],
  clients: [
    {
      id: "client-romashka",
      tenantId: "tenant-alpha",
      name: "ООО Ромашка",
      description: "Демо-клиент для CRM intake"
    },
    {
      id: "client-vektor",
      tenantId: "tenant-alpha",
      name: "ООО Вектор",
      description: "Заказчик портала подрядчиков"
    },
    {
      id: "client-gorset",
      tenantId: "tenant-alpha",
      name: "АО Горсеть",
      description: "Заказчик миграции данных"
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
    },
    {
      id: "contact-romashka-ops",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      name: "Олег Операционный",
      email: "oleg@romashka.example",
      phone: "+7 913 000-00-01",
      telegram: "@oleg_ops",
      role: "Операционный директор"
    },
    {
      id: "contact-vektor-cto",
      tenantId: "tenant-alpha",
      clientId: "client-vektor",
      name: "Виктор Технический",
      email: "victor@vektor.example",
      phone: "+7 921 111-00-00",
      telegram: "@victor_cto",
      role: "Технический директор"
    },
    {
      id: "contact-gorset-it",
      tenantId: "tenant-alpha",
      clientId: "client-gorset",
      name: "Галина ИТ",
      email: "galina@gorset.example",
      phone: "+7 922 222-00-00",
      telegram: "@galina_it",
      role: "Руководитель ИТ"
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
    },
    {
      id: "product-kiss-pm-license",
      tenantId: "tenant-alpha",
      name: "Лицензия KISS PM",
      sku: "KISS-LIC",
      type: "goods",
      unit: "лицензия",
      price: 240000,
      description: "Годовая лицензия на рабочее пространство KISS PM"
    }
  ],
  projectTypes: [
    {
      id: "project-type-implementation",
      tenantId: "tenant-alpha",
      name: "Внедрение",
      description: "Проект внедрения продукта или системы"
    },
    {
      id: "project-type-support",
      tenantId: "tenant-alpha",
      name: "Сопровождение",
      description: "Поддержка и развитие действующего решения"
    },
    {
      id: "project-type-audit",
      tenantId: "tenant-alpha",
      name: "Аудит",
      description: "Оценка процессов и подготовка рекомендаций"
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
      id: "deal-stage-negotiation",
      tenantId: "tenant-alpha",
      name: "Согласование",
      sortOrder: 25
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
    password: user.id === "user-alpha-admin" ? "admin12345" : "beta12345"
  })).concat([
    {
      id: "user-alpha-engineer",
      tenantId: "tenant-alpha",
      name: "Игорь Инженер",
      accessProfileId: "access-profile-alpha-admin",
      email: "engineer@kiss-pm.local",
      positionId: "position-engineer",
      password: "engineer12345"
    },
    {
      id: "user-alpha-plan-reader-no-resources",
      tenantId: "tenant-alpha",
      name: "Никита Без Ресурсов",
      accessProfileId: "access-profile-plan-reader-no-resources",
      email: "plan-reader-no-resources@kiss-pm.local",
      positionId: "position-engineer",
      password: "reader12345"
    },
    {
      id: "user-alpha-crm-reader",
      tenantId: "tenant-alpha",
      name: "Марина CRM",
      accessProfileId: "access-profile-crm-reader",
      email: "crm-reader@kiss-pm.local",
      positionId: "position-analyst",
      password: "crmreader12345"
    },
    {
      id: "user-alpha-resource-reader",
      tenantId: "tenant-alpha",
      name: "Роман Ресурсный",
      accessProfileId: "access-profile-resource-reader",
      email: "resource-reader@kiss-pm.local",
      positionId: "position-engineer",
      password: "resource12345"
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
  await seedExtraCrmAndProjects(db, new Date("2026-05-20T09:00:00.000Z"));
  await backfillOpportunityPipelines();
  await seedOrgStructure(db);
  await seedCommunications(db, new Date("2026-05-22T09:00:00.000Z"));
  console.log(
    "Seeded dev tenants, users, org structure, CRM, projects and communications data"
  );
} finally {
  await client.end();
}

async function backfillOpportunityPipelines(): Promise<void> {
  await client`
    UPDATE opportunities AS opportunity
    SET pipeline_id = stage.pipeline_id
    FROM crm_pipeline_stages AS stage
    WHERE opportunity.tenant_id = ${TENANT_ID}
      AND opportunity.pipeline_id IS NULL
      AND opportunity.stage_id = stage.id
      AND stage.tenant_id = opportunity.tenant_id
  `;
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
        pipelineId: "tenant-alpha-pipeline-default",
        clientName: "ООО Ромашка",
        contactName: "Ирина Клиент",
        title: "CRM intake",
        projectType: "Внедрение",
        description: "Демо-сделка для проверки задач, канбана и карточки задачи",
        plannedStart: new Date("2026-05-18T00:00:00.000Z"),
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
        plannedStart: new Date("2026-05-18T00:00:00.000Z"),
        plannedFinish: new Date("2026-06-12T00:00:00.000Z"),
        deadline: new Date("2026-06-15T00:00:00.000Z"),
        calendarId: "calendar-demo-project",
        contractValue: 960000,
        plannedHours: 160,
        templateId: null,
        createdAt,
        activatedAt: createdAt
      })
      .onConflictDoUpdate({
        target: [projects.tenantId, projects.id],
        set: {
          plannedStart: new Date("2026-05-18T00:00:00.000Z"),
          deadline: new Date("2026-06-15T00:00:00.000Z"),
          calendarId: "calendar-demo-project"
        }
      });

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
        plannedWork: 24,
        workMinutes: 1440,
        wbsCode: "1",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStartMinute: 0,
        plannedFinishMinute: 480,
        constraintType: "start_no_earlier_than",
        constraintDate: new Date("2026-05-20T00:00:00.000Z"),
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
        workMinutes: 240,
        wbsCode: "2",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStartMinute: 60,
        plannedFinishMinute: 420,
        constraintType: null,
        constraintDate: null,
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
        workMinutes: 360,
        wbsCode: "3",
        taskType: "fixed_duration",
        effortDriven: false,
        plannedStartMinute: 0,
        plannedFinishMinute: 360,
        constraintType: null,
        constraintDate: null,
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
        workMinutes: 120,
        wbsCode: "4",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStartMinute: 120,
        plannedFinishMinute: 360,
        constraintType: null,
        constraintDate: null,
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
        workMinutes: 60,
        wbsCode: "5",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStartMinute: 0,
        plannedFinishMinute: 120,
        constraintType: null,
        constraintDate: null,
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
          plannedStartMinute: task.plannedStartMinute,
          plannedFinishMinute: task.plannedFinishMinute,
          parentTaskId: null,
          wbsCode: task.wbsCode,
          schedulingMode: "auto",
          taskType: task.taskType,
          effortDriven: task.effortDriven,
          durationMinutes: task.durationWorkingDays * 480,
          workMinutes: task.workMinutes,
          constraintType: task.constraintType,
          constraintDate: task.constraintDate,
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
        .onConflictDoUpdate({
          target: [tasks.tenantId, tasks.id],
          set: {
            title: task.title,
            description: task.description,
            status: task.status,
            statusId: task.statusId,
            priority: task.priority,
            plannedStart: task.plannedStart,
            plannedFinish: task.plannedFinish,
            plannedStartMinute: task.plannedStartMinute,
            plannedFinishMinute: task.plannedFinishMinute,
            parentTaskId: null,
            wbsCode: task.wbsCode,
            schedulingMode: "auto",
            taskType: task.taskType,
            effortDriven: task.effortDriven,
            durationMinutes: task.durationWorkingDays * 480,
            workMinutes: task.workMinutes,
            constraintType: task.constraintType,
            constraintDate: task.constraintDate,
            durationWorkingDays: task.durationWorkingDays,
            plannedWork: task.plannedWork,
            requiresAcceptance: task.requiresAcceptance,
            updatedAt: createdAt
          }
        });

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
          body: "Ответственный: Анна Администратор.",
          fileUrl: null,
          fileSizeBytes: null,
          mimeType: null,
          authorUserId: "user-alpha-admin",
          createdAt,
          updatedAt: createdAt
        })
        .onConflictDoUpdate({
          target: [taskActivities.tenantId, taskActivities.id],
          set: {
            title: "Задача создана",
            body: "Ответственный: Анна Администратор.",
            updatedAt: createdAt
          }
        });
    }

    await seedDemoPlanningData(transaction, createdAt);
  });
}

async function seedDemoPlanningData(
  db: KissPmDatabase,
  createdAt: Date
): Promise<void> {
  await db
    .insert(planVersions)
    .values({
      tenantId: "tenant-alpha",
      projectId: "project-demo-crm-intake",
      version: 1,
      updatedAt: createdAt
    })
    .onConflictDoNothing();

  await db
    .insert(projectCalendars)
    .values({
      id: "calendar-demo-project",
      tenantId: "tenant-alpha",
      projectId: "project-demo-crm-intake",
      workingWeekdays: [1, 2, 3, 4, 5],
      workingMinutesPerDay: 480,
      createdAt,
      updatedAt: createdAt
    })
    .onConflictDoUpdate({
      target: [projectCalendars.tenantId, projectCalendars.projectId, projectCalendars.id],
      set: {
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480,
        updatedAt: createdAt
      }
    });

  await db
    .insert(resourceCalendars)
    .values({
      id: "calendar-demo-engineer",
      tenantId: "tenant-alpha",
      resourceId: "user-alpha-engineer",
      workingWeekdays: [1, 2, 3, 4, 5],
      workingMinutesPerDay: 480,
      createdAt,
      updatedAt: createdAt
    })
    .onConflictDoUpdate({
      target: [resourceCalendars.tenantId, resourceCalendars.resourceId, resourceCalendars.id],
      set: {
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480,
        updatedAt: createdAt
      }
    });

  await db
    .insert(calendarExceptions)
    .values([
      {
        id: "calendar-exception-demo-project-review-day",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        calendarId: "calendar-demo-project",
        resourceId: null,
        date: "2026-05-25",
        workingMinutes: 240,
        reason: "Демо: короткий день для проектного календаря",
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "calendar-exception-demo-engineer-partial",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        calendarId: "calendar-demo-engineer",
        resourceId: "user-alpha-engineer",
        date: "2026-05-22",
        workingMinutes: 240,
        reason: "Демо: частичная недоступность инженера",
        createdAt,
        updatedAt: createdAt
      }
    ])
    .onConflictDoNothing();

  await db
    .insert(taskAssignments)
    .values([
      {
        id: "assignment-demo-resource-estimate-admin",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        taskId: "task-demo-resource-estimate",
        resourceId: "user-alpha-admin",
        role: "executor",
        unitsPermille: 500,
        workMinutes: 480,
        calendarId: null
      },
      {
        id: "assignment-demo-resource-estimate-engineer",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        taskId: "task-demo-resource-estimate",
        resourceId: "user-alpha-engineer",
        role: "co_executor",
        unitsPermille: 1000,
        workMinutes: 1440,
        calendarId: "calendar-demo-engineer"
      },
      {
        id: "assignment-demo-team-setup-engineer",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        taskId: "task-demo-team-setup",
        resourceId: "user-alpha-engineer",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 300,
        calendarId: "calendar-demo-engineer"
      },
      {
        id: "assignment-demo-description-admin",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        taskId: "task-demo-description",
        resourceId: "user-alpha-admin",
        role: "executor",
        unitsPermille: 750,
        workMinutes: 360,
        calendarId: null
      },
      {
        id: "assignment-demo-gantt-review-engineer",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        taskId: "task-demo-gantt-review",
        resourceId: "user-alpha-engineer",
        role: "executor",
        unitsPermille: 500,
        workMinutes: 240,
        calendarId: "calendar-demo-engineer"
      },
      {
        id: "assignment-demo-smoke-admin",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        taskId: "task-demo-smoke",
        resourceId: "user-alpha-admin",
        role: "executor",
        unitsPermille: 250,
        workMinutes: 60,
        calendarId: null
      }
    ])
    .onConflictDoNothing();

  await db
    .insert(taskDependencies)
    .values([
      {
        id: "dependency-demo-team-starts-after-estimate-start",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        predecessorTaskId: "task-demo-resource-estimate",
        successorTaskId: "task-demo-team-setup",
        type: "SS",
        lagMinutes: 480
      },
      {
        id: "dependency-demo-estimate-before-description",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        predecessorTaskId: "task-demo-resource-estimate",
        successorTaskId: "task-demo-description",
        type: "FS",
        lagMinutes: 0
      },
      {
        id: "dependency-demo-review-finish-before-smoke",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        predecessorTaskId: "task-demo-gantt-review",
        successorTaskId: "task-demo-smoke",
        type: "FF",
        lagMinutes: 480
      }
    ])
    .onConflictDoNothing();

  await db
    .insert(resourceReservations)
    .values({
      id: "reservation-demo-engineer-support",
      tenantId: "tenant-alpha",
      projectId: "project-demo-crm-intake",
      resourceId: "user-alpha-engineer",
      start: "2026-05-21",
      finish: "2026-05-21",
      workMinutes: 240,
      reason: "Демо: поддержка действующего внедрения"
    })
    .onConflictDoUpdate({
      target: [resourceReservations.tenantId, resourceReservations.projectId, resourceReservations.id],
      set: {
        resourceId: "user-alpha-engineer",
        start: "2026-05-21",
        finish: "2026-05-21",
        workMinutes: 240,
        reason: "Демо: поддержка действующего внедрения"
      }
    });

  await db
    .insert(projectBaselines)
    .values({
      id: "baseline-demo-initial",
      tenantId: "tenant-alpha",
      projectId: "project-demo-crm-intake",
      label: "Демо baseline: стартовый план",
      capturedAt: createdAt
    })
    .onConflictDoNothing();

  await db
    .insert(projectBaselineTasks)
    .values([
      {
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        baselineId: "baseline-demo-initial",
        taskId: "task-demo-resource-estimate",
        plannedStart: "2026-05-20",
        plannedFinish: "2026-05-22",
        workMinutes: 1440
      },
      {
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        baselineId: "baseline-demo-initial",
        taskId: "task-demo-team-setup",
        plannedStart: "2026-05-21",
        plannedFinish: "2026-05-21",
        workMinutes: 240
      }
    ])
    .onConflictDoNothing();

  await db
    .insert(projectBaselineAssignments)
    .values([
      {
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        baselineId: "baseline-demo-initial",
        assignmentId: "assignment-demo-resource-estimate-engineer",
        taskId: "task-demo-resource-estimate",
        resourceId: "user-alpha-engineer",
        workMinutes: 1440
      },
      {
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        baselineId: "baseline-demo-initial",
        assignmentId: "assignment-demo-team-setup-engineer",
        taskId: "task-demo-team-setup",
        resourceId: "user-alpha-engineer",
        workMinutes: 300
      }
    ])
    .onConflictDoNothing();
}

type ExtraTaskSpec = {
  id: string;
  title: string;
  description: string;
  status: string;
  statusId: string;
  priority: string;
  parentTaskId: string | null;
  wbsCode: string;
  ownerUserId: string;
  plannedStart: Date;
  plannedFinish: Date;
  durationWorkingDays: number;
  plannedWork: number;
  workMinutes: number;
  taskType: "fixed_units" | "fixed_work" | "fixed_duration";
  effortDriven: boolean;
  progress: number;
  schedulingMode: "auto" | "manual";
  isMilestone: boolean;
  coExecutors: string[];
};

type ExtraDependencySpec = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: "FS" | "SS" | "FF" | "SF";
  lagMinutes: number;
};

type ExtraAssignmentSpec = {
  id: string;
  taskId: string;
  resourceId: string;
  role: "executor" | "co_executor";
  unitsPermille: number;
  workMinutes: number;
};

type ExtraProjectSpec = {
  projectId: string;
  opportunityId: string;
  clientId: string;
  clientName: string;
  primaryContactId: string;
  contactName: string;
  stageId: string;
  title: string;
  description: string;
  plannedStart: Date;
  plannedFinish: Date;
  deadline: Date;
  contractValue: number;
  plannedHours: number;
  plannedHourlyRate: number;
  probability: number;
  demand: { positionId: string; requiredHours: number };
  calendarId: string;
  planVersion: number;
  tasks: ExtraTaskSpec[];
  dependencies: ExtraDependencySpec[];
  assignments: ExtraAssignmentSpec[];
  baseline: { id: string; label: string; taskIds: string[]; assignmentIds: string[] };
};

type StandaloneOpportunitySpec = {
  id: string;
  clientId: string;
  clientName: string;
  primaryContactId: string;
  contactName: string;
  pipelineId: string | null;
  stageId: string | null;
  title: string;
  projectTypeId: string;
  projectType: string;
  description: string;
  plannedStart: Date;
  plannedFinish: Date;
  contractValue: number;
  plannedHourlyRate: number;
  plannedHours: number;
  probability: number;
  status: string;
  demand?: { positionId: string; requiredHours: number };
  resetOnSeed?: boolean;
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function utc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function extraProjectSpecs(): ExtraProjectSpec[] {
  return [
    {
      projectId: "project-vektor-portal",
      opportunityId: "opportunity-vektor-portal",
      clientId: "client-vektor",
      clientName: "ООО Вектор",
      primaryContactId: "contact-vektor-cto",
      contactName: "Виктор Технический",
      stageId: "deal-stage-ready",
      title: "Портал подрядчиков Вектор",
      description: "Внедрение портала для работы с подрядчиками и интеграции с 1С.",
      plannedStart: utc("2026-06-01"),
      plannedFinish: utc("2026-07-10"),
      deadline: utc("2026-07-08"),
      contractValue: 1_200_000,
      plannedHours: 220,
      plannedHourlyRate: 5_500,
      probability: 100,
      demand: { positionId: "position-engineer", requiredHours: 160 },
      calendarId: "calendar-vektor-project",
      planVersion: 1,
      tasks: [
        {
          id: "task-vektor-phase-prep",
          title: "Этап 1. Подготовка",
          description: "Сбор требований и проектирование решения.",
          status: "in_progress",
          statusId: "task-status-in-progress",
          priority: "high",
          parentTaskId: null,
          wbsCode: "1",
          ownerUserId: "user-alpha-admin",
          plannedStart: utc("2026-06-01"),
          plannedFinish: utc("2026-06-12"),
          durationWorkingDays: 10,
          plannedWork: 0,
          workMinutes: 0,
          taskType: "fixed_duration",
          effortDriven: false,
          progress: 40,
          schedulingMode: "manual",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-vektor-requirements",
          title: "Сбор требований",
          description: "Интервью с заказчиком и фиксация требований к порталу.",
          status: "done",
          statusId: "task-status-done",
          priority: "normal",
          parentTaskId: "task-vektor-phase-prep",
          wbsCode: "1.1",
          ownerUserId: "user-alpha-engineer",
          plannedStart: utc("2026-06-01"),
          plannedFinish: utc("2026-06-04"),
          durationWorkingDays: 4,
          plannedWork: 24,
          workMinutes: 1440,
          taskType: "fixed_work",
          effortDriven: true,
          progress: 100,
          schedulingMode: "auto",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-vektor-arch",
          title: "Проектирование архитектуры",
          description: "Схема интеграции, модель данных и план работ.",
          status: "in_progress",
          statusId: "task-status-in-progress",
          priority: "high",
          parentTaskId: "task-vektor-phase-prep",
          wbsCode: "1.2",
          ownerUserId: "user-alpha-admin",
          plannedStart: utc("2026-06-05"),
          plannedFinish: utc("2026-06-12"),
          durationWorkingDays: 6,
          plannedWork: 36,
          workMinutes: 2160,
          taskType: "fixed_units",
          effortDriven: false,
          progress: 50,
          schedulingMode: "auto",
          isMilestone: false,
          coExecutors: ["user-alpha-engineer"]
        },
        {
          id: "task-vektor-phase-build",
          title: "Этап 2. Реализация",
          description: "Настройка интеграции и тестирование портала.",
          status: "new",
          statusId: "task-status-new",
          priority: "normal",
          parentTaskId: null,
          wbsCode: "2",
          ownerUserId: "user-alpha-admin",
          plannedStart: utc("2026-06-15"),
          plannedFinish: utc("2026-07-08"),
          durationWorkingDays: 18,
          plannedWork: 0,
          workMinutes: 0,
          taskType: "fixed_duration",
          effortDriven: false,
          progress: 0,
          schedulingMode: "manual",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-vektor-integration",
          title: "Настройка интеграции 1С",
          description: "Обмен данными между порталом и учётной системой.",
          status: "new",
          statusId: "task-status-new",
          priority: "high",
          parentTaskId: "task-vektor-phase-build",
          wbsCode: "2.1",
          ownerUserId: "user-alpha-resource-reader",
          plannedStart: utc("2026-06-15"),
          plannedFinish: utc("2026-06-26"),
          durationWorkingDays: 10,
          plannedWork: 60,
          workMinutes: 3600,
          taskType: "fixed_work",
          effortDriven: true,
          progress: 0,
          schedulingMode: "auto",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-vektor-testing",
          title: "Тестирование портала",
          description: "Функциональное и приёмочное тестирование.",
          status: "new",
          statusId: "task-status-new",
          priority: "normal",
          parentTaskId: "task-vektor-phase-build",
          wbsCode: "2.2",
          ownerUserId: "user-alpha-plan-reader-no-resources",
          plannedStart: utc("2026-06-25"),
          plannedFinish: utc("2026-07-08"),
          durationWorkingDays: 10,
          plannedWork: 50,
          workMinutes: 3000,
          taskType: "fixed_units",
          effortDriven: false,
          progress: 0,
          schedulingMode: "auto",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-vektor-milestone-launch",
          title: "Веха: готовность к запуску",
          description: "Контрольная точка готовности портала к продуктиву.",
          status: "new",
          statusId: "task-status-new",
          priority: "critical",
          parentTaskId: null,
          wbsCode: "3",
          ownerUserId: "user-alpha-admin",
          plannedStart: utc("2026-07-09"),
          plannedFinish: utc("2026-07-09"),
          durationWorkingDays: 0,
          plannedWork: 0,
          workMinutes: 0,
          taskType: "fixed_units",
          effortDriven: false,
          progress: 0,
          schedulingMode: "manual",
          isMilestone: true,
          coExecutors: []
        }
      ],
      dependencies: [
        {
          id: "dependency-vektor-req-arch",
          predecessorTaskId: "task-vektor-requirements",
          successorTaskId: "task-vektor-arch",
          type: "FS",
          lagMinutes: 0
        },
        {
          id: "dependency-vektor-arch-integration",
          predecessorTaskId: "task-vektor-arch",
          successorTaskId: "task-vektor-integration",
          type: "FS",
          lagMinutes: 0
        },
        {
          id: "dependency-vektor-integration-testing",
          predecessorTaskId: "task-vektor-integration",
          successorTaskId: "task-vektor-testing",
          type: "SS",
          lagMinutes: 480
        },
        {
          id: "dependency-vektor-testing-milestone",
          predecessorTaskId: "task-vektor-testing",
          successorTaskId: "task-vektor-milestone-launch",
          type: "FS",
          lagMinutes: 0
        }
      ],
      assignments: [
        {
          id: "assignment-vektor-requirements-engineer",
          taskId: "task-vektor-requirements",
          resourceId: "user-alpha-engineer",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 1440
        },
        {
          id: "assignment-vektor-arch-admin",
          taskId: "task-vektor-arch",
          resourceId: "user-alpha-admin",
          role: "executor",
          unitsPermille: 500,
          workMinutes: 1080
        },
        {
          id: "assignment-vektor-arch-engineer",
          taskId: "task-vektor-arch",
          resourceId: "user-alpha-engineer",
          role: "co_executor",
          unitsPermille: 750,
          workMinutes: 1080
        },
        {
          id: "assignment-vektor-integration-reader",
          taskId: "task-vektor-integration",
          resourceId: "user-alpha-resource-reader",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 3600
        },
        {
          id: "assignment-vektor-testing-planreader",
          taskId: "task-vektor-testing",
          resourceId: "user-alpha-plan-reader-no-resources",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 3000
        }
      ],
      baseline: {
        id: "baseline-vektor-initial",
        label: "Базовый план: старт портала",
        taskIds: [
          "task-vektor-requirements",
          "task-vektor-arch",
          "task-vektor-integration",
          "task-vektor-testing"
        ],
        assignmentIds: [
          "assignment-vektor-requirements-engineer",
          "assignment-vektor-arch-engineer"
        ]
      }
    },
    {
      projectId: "project-gorset-migration",
      opportunityId: "opportunity-gorset-migration",
      clientId: "client-gorset",
      clientName: "АО Горсеть",
      primaryContactId: "contact-gorset-it",
      contactName: "Галина ИТ",
      stageId: "deal-stage-ready",
      title: "Миграция данных Горсеть",
      description: "Перенос данных из легаси-систем в новый контур с проверкой качества.",
      plannedStart: utc("2026-05-12"),
      plannedFinish: utc("2026-06-20"),
      deadline: utc("2026-06-25"),
      contractValue: 840_000,
      plannedHours: 150,
      plannedHourlyRate: 5_600,
      probability: 100,
      demand: { positionId: "position-engineer", requiredHours: 120 },
      calendarId: "calendar-gorset-project",
      planVersion: 1,
      tasks: [
        {
          id: "task-gorset-phase-analysis",
          title: "Этап 1. Анализ данных",
          description: "Аудит источников и подготовка маппинга.",
          status: "done",
          statusId: "task-status-done",
          priority: "high",
          parentTaskId: null,
          wbsCode: "1",
          ownerUserId: "user-alpha-engineer",
          plannedStart: utc("2026-05-12"),
          plannedFinish: utc("2026-05-22"),
          durationWorkingDays: 9,
          plannedWork: 0,
          workMinutes: 0,
          taskType: "fixed_duration",
          effortDriven: false,
          progress: 100,
          schedulingMode: "manual",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-gorset-audit",
          title: "Аудит источников",
          description: "Инвентаризация и оценка качества исходных данных.",
          status: "done",
          statusId: "task-status-done",
          priority: "normal",
          parentTaskId: "task-gorset-phase-analysis",
          wbsCode: "1.1",
          ownerUserId: "user-alpha-engineer",
          plannedStart: utc("2026-05-12"),
          plannedFinish: utc("2026-05-15"),
          durationWorkingDays: 4,
          plannedWork: 24,
          workMinutes: 1440,
          taskType: "fixed_work",
          effortDriven: true,
          progress: 100,
          schedulingMode: "auto",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-gorset-mapping",
          title: "Маппинг полей",
          description: "Сопоставление полей источников и целевой модели.",
          status: "done",
          statusId: "task-status-done",
          priority: "normal",
          parentTaskId: "task-gorset-phase-analysis",
          wbsCode: "1.2",
          ownerUserId: "user-alpha-resource-reader",
          plannedStart: utc("2026-05-18"),
          plannedFinish: utc("2026-05-22"),
          durationWorkingDays: 5,
          plannedWork: 30,
          workMinutes: 1800,
          taskType: "fixed_units",
          effortDriven: false,
          progress: 100,
          schedulingMode: "auto",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-gorset-phase-migration",
          title: "Этап 2. Перенос",
          description: "Настройка ETL и сверка результатов миграции.",
          status: "in_progress",
          statusId: "task-status-in-progress",
          priority: "high",
          parentTaskId: null,
          wbsCode: "2",
          ownerUserId: "user-alpha-admin",
          plannedStart: utc("2026-05-25"),
          plannedFinish: utc("2026-06-19"),
          durationWorkingDays: 19,
          plannedWork: 0,
          workMinutes: 0,
          taskType: "fixed_duration",
          effortDriven: false,
          progress: 80,
          schedulingMode: "manual",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-gorset-etl",
          title: "Настройка ETL",
          description: "Конвейер переноса данных и обработка ошибок.",
          status: "done",
          statusId: "task-status-done",
          priority: "high",
          parentTaskId: "task-gorset-phase-migration",
          wbsCode: "2.1",
          ownerUserId: "user-alpha-engineer",
          plannedStart: utc("2026-05-25"),
          plannedFinish: utc("2026-06-05"),
          durationWorkingDays: 10,
          plannedWork: 60,
          workMinutes: 3600,
          taskType: "fixed_work",
          effortDriven: true,
          progress: 100,
          schedulingMode: "auto",
          isMilestone: false,
          coExecutors: ["user-alpha-admin"]
        },
        {
          id: "task-gorset-verify",
          title: "Сверка результатов",
          description: "Контроль качества перенесённых данных.",
          status: "review",
          statusId: "task-status-review",
          priority: "critical",
          parentTaskId: "task-gorset-phase-migration",
          wbsCode: "2.2",
          ownerUserId: "user-alpha-admin",
          plannedStart: utc("2026-06-08"),
          plannedFinish: utc("2026-06-19"),
          durationWorkingDays: 10,
          plannedWork: 40,
          workMinutes: 2400,
          taskType: "fixed_units",
          effortDriven: false,
          progress: 80,
          schedulingMode: "auto",
          isMilestone: false,
          coExecutors: []
        },
        {
          id: "task-gorset-milestone-signoff",
          title: "Веха: приёмка миграции",
          description: "Контрольная точка приёмки результатов миграции.",
          status: "new",
          statusId: "task-status-new",
          priority: "high",
          parentTaskId: null,
          wbsCode: "3",
          ownerUserId: "user-alpha-admin",
          plannedStart: utc("2026-06-20"),
          plannedFinish: utc("2026-06-20"),
          durationWorkingDays: 0,
          plannedWork: 0,
          workMinutes: 0,
          taskType: "fixed_units",
          effortDriven: false,
          progress: 0,
          schedulingMode: "manual",
          isMilestone: true,
          coExecutors: []
        }
      ],
      dependencies: [
        {
          id: "dependency-gorset-audit-mapping",
          predecessorTaskId: "task-gorset-audit",
          successorTaskId: "task-gorset-mapping",
          type: "FS",
          lagMinutes: 0
        },
        {
          id: "dependency-gorset-mapping-etl",
          predecessorTaskId: "task-gorset-mapping",
          successorTaskId: "task-gorset-etl",
          type: "FS",
          lagMinutes: 0
        },
        {
          id: "dependency-gorset-etl-verify",
          predecessorTaskId: "task-gorset-etl",
          successorTaskId: "task-gorset-verify",
          type: "SS",
          lagMinutes: 480
        },
        {
          id: "dependency-gorset-verify-signoff",
          predecessorTaskId: "task-gorset-verify",
          successorTaskId: "task-gorset-milestone-signoff",
          type: "FS",
          lagMinutes: 0
        }
      ],
      assignments: [
        {
          id: "assignment-gorset-audit-engineer",
          taskId: "task-gorset-audit",
          resourceId: "user-alpha-engineer",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 1440
        },
        {
          id: "assignment-gorset-mapping-reader",
          taskId: "task-gorset-mapping",
          resourceId: "user-alpha-resource-reader",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 1800
        },
        {
          id: "assignment-gorset-etl-engineer",
          taskId: "task-gorset-etl",
          resourceId: "user-alpha-engineer",
          role: "executor",
          unitsPermille: 750,
          workMinutes: 2700
        },
        {
          id: "assignment-gorset-etl-admin",
          taskId: "task-gorset-etl",
          resourceId: "user-alpha-admin",
          role: "co_executor",
          unitsPermille: 250,
          workMinutes: 900
        },
        {
          id: "assignment-gorset-verify-admin",
          taskId: "task-gorset-verify",
          resourceId: "user-alpha-admin",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 2400
        }
      ],
      baseline: {
        id: "baseline-gorset-initial",
        label: "Базовый план: миграция Горсеть",
        taskIds: [
          "task-gorset-audit",
          "task-gorset-mapping",
          "task-gorset-etl",
          "task-gorset-verify"
        ],
        assignmentIds: [
          "assignment-gorset-audit-engineer",
          "assignment-gorset-etl-engineer"
        ]
      }
    }
  ];
}

function standaloneOpportunitySpecs(): StandaloneOpportunitySpec[] {
  return [
    {
      id: "opportunity-romashka-support",
      clientId: "client-romashka",
      clientName: "ООО Ромашка",
      primaryContactId: "contact-irina",
      contactName: "Ирина Клиент",
      stageId: "deal-stage-new",
      pipelineId: `${TENANT_ID}-pipeline-default`,
      title: "Поддержка после внедрения",
      projectType: "Сопровождение",
      projectTypeId: "project-type-support",
      description: "Запрос на сопровождение управленческого контура после внедрения.",
      plannedStart: utc("2026-07-01"),
      plannedFinish: utc("2026-09-30"),
      contractValue: 360_000,
      plannedHourlyRate: 6_000,
      plannedHours: 60,
      probability: 40,
      status: "new"
    },
    {
      id: "opportunity-without-stage",
      clientId: "client-romashka",
      clientName: "ООО Ромашка",
      primaryContactId: "contact-irina",
      contactName: "Ирина Клиент",
      pipelineId: null,
      stageId: null,
      title: "Запрос без стадии",
      projectType: "Сопровождение",
      projectTypeId: "project-type-support",
      description: "Новый запрос до первичного распределения по воронке.",
      plannedStart: utc("2026-07-08"),
      plannedFinish: utc("2026-08-31"),
      contractValue: 120_000,
      plannedHourlyRate: 6_000,
      plannedHours: 20,
      probability: 20,
      status: "new",
      resetOnSeed: true
    },
    {
      id: "opportunity-vektor-audit",
      clientId: "client-vektor",
      clientName: "ООО Вектор",
      primaryContactId: "contact-vektor-cto",
      contactName: "Виктор Технический",
      stageId: "deal-stage-qualified",
      pipelineId: `${TENANT_ID}-pipeline-default`,
      title: "Аудит процессов Вектор",
      projectType: "Аудит",
      projectTypeId: "project-type-audit",
      description: "Оценка зрелости проектного контура и подготовка рекомендаций.",
      plannedStart: utc("2026-06-22"),
      plannedFinish: utc("2026-06-22"),
      contractValue: 180_000,
      plannedHourlyRate: 6_000,
      plannedHours: 30,
      demand: { positionId: "position-project-manager", requiredHours: 30 },
      probability: 55,
      status: "feasibility",
      resetOnSeed: true
    },
    {
      id: "opportunity-reader-e2e",
      clientId: "client-vektor",
      clientName: "ООО Вектор",
      primaryContactId: "contact-vektor-cto",
      contactName: "Виктор Технический",
      stageId: "deal-stage-qualified",
      pipelineId: `${TENANT_ID}-pipeline-default`,
      title: "Проверка прав CRM E2E",
      projectType: "Аудит",
      projectTypeId: "project-type-audit",
      description: "Резервная сделка для проверки CRM в режиме только чтения.",
      plannedStart: utc("2026-07-01"),
      plannedFinish: utc("2026-07-03"),
      contractValue: 120_000,
      plannedHourlyRate: 6_000,
      plannedHours: 20,
      probability: 30,
      status: "new",
      resetOnSeed: true
    },
    {
      id: "opportunity-gorset-expansion",
      clientId: "client-gorset",
      clientName: "АО Горсеть",
      primaryContactId: "contact-gorset-it",
      contactName: "Галина ИТ",
      stageId: "deal-stage-negotiation",
      pipelineId: `${TENANT_ID}-pipeline-default`,
      title: "Расширение интеграций Горсеть",
      projectType: "Внедрение",
      projectTypeId: "project-type-implementation",
      description: "Дополнительные интеграции после успешной миграции данных.",
      plannedStart: utc("2026-07-01"),
      plannedFinish: utc("2026-08-30"),
      contractValue: 540_000,
      plannedHourlyRate: 5_600,
      plannedHours: 95,
      probability: 70,
      status: "ready_to_activate"
    }
  ];
}

async function seedExtraCrmAndProjects(db: KissPmDatabase, createdAt: Date): Promise<void> {
  await db.transaction(async (transaction) => {
    for (const opportunity of standaloneOpportunitySpecs()) {
      if (opportunity.resetOnSeed) {
        // A prior activation creates a project with a unique sourceOpportunityId.
        // Remove that disposable bundle before restoring the reserved E2E deal.
        await transaction
          .delete(projects)
          .where(and(
            eq(projects.tenantId, TENANT_ID),
            eq(projects.sourceOpportunityId, opportunity.id)
          ));
      }
      const insert = transaction
        .insert(opportunities)
        .values({
          id: opportunity.id,
          tenantId: TENANT_ID,
          clientId: opportunity.clientId,
          primaryContactId: opportunity.primaryContactId,
          ownerUserId: "user-alpha-admin",
          projectTypeId: opportunity.projectTypeId,
          stageId: opportunity.stageId,
          pipelineId: opportunity.pipelineId,
          clientName: opportunity.clientName,
          contactName: opportunity.contactName,
          title: opportunity.title,
          projectType: opportunity.projectType,
          description: opportunity.description,
          plannedStart: opportunity.plannedStart,
          plannedFinish: opportunity.plannedFinish,
          contractValue: opportunity.contractValue,
          plannedHourlyRate: opportunity.plannedHourlyRate,
          plannedHours: opportunity.plannedHours,
          probability: opportunity.probability,
          status: opportunity.status,
          templateId: null,
          feasibilityStatus: null,
          feasibilityResult: null,
          feasibilityCheckedAt: null,
          customFieldValues: {},
          createdAt,
          updatedAt: createdAt
        });
      if (opportunity.resetOnSeed) {
        // Reserved E2E data is reset; ordinary seeded deals retain developer changes.
        await insert.onConflictDoUpdate({
          target: [opportunities.tenantId, opportunities.id],
          set: {
            clientId: opportunity.clientId,
            primaryContactId: opportunity.primaryContactId,
            ownerUserId: "user-alpha-admin",
            projectTypeId: opportunity.projectTypeId,
            stageId: opportunity.stageId,
            pipelineId: opportunity.pipelineId,
            clientName: opportunity.clientName,
            contactName: opportunity.contactName,
            title: opportunity.title,
            projectType: opportunity.projectType,
            description: opportunity.description,
            plannedStart: opportunity.plannedStart,
            plannedFinish: opportunity.plannedFinish,
            contractValue: opportunity.contractValue,
            plannedHourlyRate: opportunity.plannedHourlyRate,
            plannedHours: opportunity.plannedHours,
            probability: opportunity.probability,
            status: opportunity.status,
            templateId: null,
            feasibilityStatus: null,
            feasibilityResult: null,
            feasibilityCheckedAt: null,
            customFieldValues: {},
            updatedAt: createdAt
          }
        });
      } else {
        await insert.onConflictDoNothing();
        // Upgrade databases seeded before projectTypeId became required. Preserve every
        // developer-edited field, including an explicitly selected non-null project type.
        await transaction
          .update(opportunities)
          .set({ projectTypeId: opportunity.projectTypeId })
          .where(and(
            eq(opportunities.tenantId, TENANT_ID),
            eq(opportunities.id, opportunity.id),
            isNull(opportunities.projectTypeId)
          ));
      }
      if (opportunity.demand) {
        if (opportunity.resetOnSeed) {
          await transaction
            .delete(opportunityDemands)
            .where(and(
              eq(opportunityDemands.tenantId, TENANT_ID),
              eq(opportunityDemands.opportunityId, opportunity.id)
            ));
        }
        await transaction
          .insert(opportunityDemands)
          .values({
            tenantId: TENANT_ID,
            opportunityId: opportunity.id,
            positionId: opportunity.demand.positionId,
            requiredHours: opportunity.demand.requiredHours
          })
          .onConflictDoNothing();
      }
    }

    for (const spec of extraProjectSpecs()) {
      await seedProjectBundle(transaction, spec, createdAt);
    }
  });
}

async function seedProjectBundle(
  db: KissPmDatabase,
  spec: ExtraProjectSpec,
  createdAt: Date
): Promise<void> {
  await db
    .insert(opportunities)
    .values({
      id: spec.opportunityId,
      tenantId: TENANT_ID,
      clientId: spec.clientId,
      primaryContactId: spec.primaryContactId,
      ownerUserId: "user-alpha-admin",
      projectTypeId: "project-type-implementation",
      stageId: spec.stageId,
      pipelineId: `${TENANT_ID}-pipeline-default`,
      clientName: spec.clientName,
      contactName: spec.contactName,
      title: spec.title,
      projectType: "Внедрение",
      description: spec.description,
      plannedStart: spec.plannedStart,
      plannedFinish: spec.plannedFinish,
      contractValue: spec.contractValue,
      plannedHourlyRate: spec.plannedHourlyRate,
      plannedHours: spec.plannedHours,
      probability: spec.probability,
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

  await db
    .insert(projects)
    .values({
      id: spec.projectId,
      tenantId: TENANT_ID,
      sourceOpportunityId: spec.opportunityId,
      clientId: spec.clientId,
      projectTypeId: "project-type-implementation",
      title: spec.title,
      clientName: spec.clientName,
      status: "active",
      plannedStart: spec.plannedStart,
      plannedFinish: spec.plannedFinish,
      deadline: spec.deadline,
      calendarId: spec.calendarId,
      contractValue: spec.contractValue,
      plannedHours: spec.plannedHours,
      templateId: null,
      createdAt,
      activatedAt: createdAt
    })
    .onConflictDoUpdate({
      target: [projects.tenantId, projects.id],
      set: {
        plannedStart: spec.plannedStart,
        plannedFinish: spec.plannedFinish,
        deadline: spec.deadline,
        status: "active",
        calendarId: spec.calendarId
      }
    });

  await db
    .insert(projectPositionDemands)
    .values({
      tenantId: TENANT_ID,
      projectId: spec.projectId,
      positionId: spec.demand.positionId,
      requiredHours: spec.demand.requiredHours
    })
    .onConflictDoNothing();

  await db
    .insert(planVersions)
    .values({
      tenantId: TENANT_ID,
      projectId: spec.projectId,
      version: spec.planVersion,
      updatedAt: createdAt
    })
    .onConflictDoNothing();

  await db
    .insert(projectCalendars)
    .values({
      id: spec.calendarId,
      tenantId: TENANT_ID,
      projectId: spec.projectId,
      workingWeekdays: [1, 2, 3, 4, 5],
      workingMinutesPerDay: 480,
      createdAt,
      updatedAt: createdAt
    })
    .onConflictDoUpdate({
      target: [projectCalendars.tenantId, projectCalendars.projectId, projectCalendars.id],
      set: {
        workingWeekdays: [1, 2, 3, 4, 5],
        workingMinutesPerDay: 480,
        updatedAt: createdAt
      }
    });

  const taskById = new Map(spec.tasks.map((task) => [task.id, task]));

  for (const task of spec.tasks) {
    const durationMinutes = task.durationWorkingDays * 480;
    const actualWork =
      task.status === "done"
        ? task.plannedWork
        : Math.round((task.plannedWork * task.progress) / 100);

    await db
      .insert(tasks)
      .values({
        id: task.id,
        tenantId: TENANT_ID,
        projectId: spec.projectId,
        stageId: null,
        title: task.title,
        description: task.description,
        status: task.status,
        statusId: task.statusId,
        priority: task.priority,
        requesterUserId: "user-alpha-admin",
        ownerUserId: task.ownerUserId,
        plannedStart: task.plannedStart,
        plannedFinish: task.plannedFinish,
        plannedStartMinute: 0,
        plannedFinishMinute: task.isMilestone ? 0 : 480,
        parentTaskId: task.parentTaskId,
        wbsCode: task.wbsCode,
        schedulingMode: task.schedulingMode,
        taskType: task.taskType,
        effortDriven: task.effortDriven,
        durationMinutes,
        workMinutes: task.workMinutes,
        constraintType: null,
        constraintDate: null,
        durationWorkingDays: task.durationWorkingDays,
        plannedWork: task.plannedWork,
        actualWork,
        progress: task.progress,
        requiresAcceptance: false,
        source: "manual",
        createdAt,
        updatedAt: createdAt,
        archivedAt: null
      })
      .onConflictDoUpdate({
        target: [tasks.tenantId, tasks.id],
        set: {
          title: task.title,
          description: task.description,
          status: task.status,
          statusId: task.statusId,
          priority: task.priority,
          ownerUserId: task.ownerUserId,
          plannedStart: task.plannedStart,
          plannedFinish: task.plannedFinish,
          plannedStartMinute: 0,
          plannedFinishMinute: task.isMilestone ? 0 : 480,
          parentTaskId: task.parentTaskId,
          wbsCode: task.wbsCode,
          schedulingMode: task.schedulingMode,
          taskType: task.taskType,
          effortDriven: task.effortDriven,
          durationMinutes,
          workMinutes: task.workMinutes,
          durationWorkingDays: task.durationWorkingDays,
          plannedWork: task.plannedWork,
          actualWork,
          progress: task.progress,
          updatedAt: createdAt
        }
      });

    await db
      .insert(taskParticipants)
      .values([
        {
          tenantId: TENANT_ID,
          taskId: task.id,
          userId: "user-alpha-admin",
          role: "requester"
        },
        {
          tenantId: TENANT_ID,
          taskId: task.id,
          userId: task.ownerUserId,
          role: "executor"
        },
        ...task.coExecutors.map((userId) => ({
          tenantId: TENANT_ID,
          taskId: task.id,
          userId,
          role: "co_executor"
        }))
      ])
      .onConflictDoNothing();

    await db
      .insert(taskActivities)
      .values({
        id: `${task.id}-activity-created`,
        tenantId: TENANT_ID,
        taskId: task.id,
        type: "system",
        title: "Задача создана",
        body: "Задача добавлена в проект.",
        fileUrl: null,
        fileSizeBytes: null,
        mimeType: null,
        authorUserId: "user-alpha-admin",
        createdAt,
        updatedAt: createdAt
      })
      .onConflictDoUpdate({
        target: [taskActivities.tenantId, taskActivities.id],
        set: {
          title: "Задача создана",
          body: "Задача добавлена в проект.",
          updatedAt: createdAt
        }
      });
  }

  await db
    .insert(taskAssignments)
    .values(
      spec.assignments.map((assignment) => ({
        id: assignment.id,
        tenantId: TENANT_ID,
        projectId: spec.projectId,
        taskId: assignment.taskId,
        resourceId: assignment.resourceId,
        role: assignment.role,
        unitsPermille: assignment.unitsPermille,
        workMinutes: assignment.workMinutes,
        calendarId: null
      }))
    )
    .onConflictDoNothing();

  await db
    .insert(taskDependencies)
    .values(
      spec.dependencies.map((dependency) => ({
        id: dependency.id,
        tenantId: TENANT_ID,
        projectId: spec.projectId,
        predecessorTaskId: dependency.predecessorTaskId,
        successorTaskId: dependency.successorTaskId,
        type: dependency.type,
        lagMinutes: dependency.lagMinutes
      }))
    )
    .onConflictDoNothing();

  await db
    .insert(projectBaselines)
    .values({
      id: spec.baseline.id,
      tenantId: TENANT_ID,
      projectId: spec.projectId,
      label: spec.baseline.label,
      capturedAt: createdAt
    })
    .onConflictDoNothing();

  await db
    .insert(projectBaselineTasks)
    .values(
      spec.baseline.taskIds.map((taskId) => {
        const task = taskById.get(taskId);
        if (!task) {
          throw new Error(`seed_baseline_task_missing:${taskId}`);
        }
        return {
          tenantId: TENANT_ID,
          projectId: spec.projectId,
          baselineId: spec.baseline.id,
          taskId,
          plannedStart: toIsoDate(task.plannedStart),
          plannedFinish: toIsoDate(task.plannedFinish),
          workMinutes: task.workMinutes
        };
      })
    )
    .onConflictDoNothing();

  const assignmentById = new Map(
    spec.assignments.map((assignment) => [assignment.id, assignment])
  );

  await db
    .insert(projectBaselineAssignments)
    .values(
      spec.baseline.assignmentIds.map((assignmentId) => {
        const assignment = assignmentById.get(assignmentId);
        if (!assignment) {
          throw new Error(`seed_baseline_assignment_missing:${assignmentId}`);
        }
        return {
          tenantId: TENANT_ID,
          projectId: spec.projectId,
          baselineId: spec.baseline.id,
          assignmentId,
          taskId: assignment.taskId,
          resourceId: assignment.resourceId,
          workMinutes: assignment.workMinutes
        };
      })
    )
    .onConflictDoNothing();
}

async function seedOrgStructure(db: KissPmDatabase): Promise<void> {
  await db.transaction(async (transaction) => {
    await transaction
      .insert(tenantOrgNodes)
      .values([
        {
          id: "org-alpha-fn-dir",
          tenantId: TENANT_ID,
          track: "functional",
          nodeType: "direction",
          name: "Производственный блок",
          parentId: null,
          sortOrder: 0
        },
        {
          id: "org-alpha-fn-delivery",
          tenantId: TENANT_ID,
          track: "functional",
          nodeType: "department",
          name: "Отдел внедрения",
          parentId: "org-alpha-fn-dir",
          sortOrder: 0
        },
        {
          id: "org-alpha-fn-engineering",
          tenantId: TENANT_ID,
          track: "functional",
          nodeType: "department",
          name: "Отдел инженерии",
          parentId: "org-alpha-fn-dir",
          sortOrder: 1
        },
        {
          id: "org-alpha-fn-pmo",
          tenantId: TENANT_ID,
          track: "functional",
          nodeType: "department",
          name: "Проектный офис",
          parentId: "org-alpha-fn-dir",
          sortOrder: 2
        },
        {
          id: "org-alpha-pr-dir",
          tenantId: TENANT_ID,
          track: "project",
          nodeType: "direction",
          name: "Портфель проектов",
          parentId: null,
          sortOrder: 0
        },
        {
          id: "org-alpha-pr-team-vektor",
          tenantId: TENANT_ID,
          track: "project",
          nodeType: "team",
          name: "Команда Вектор",
          parentId: "org-alpha-pr-dir",
          sortOrder: 0
        },
        {
          id: "org-alpha-pr-team-gorset",
          tenantId: TENANT_ID,
          track: "project",
          nodeType: "team",
          name: "Команда Горсеть",
          parentId: "org-alpha-pr-dir",
          sortOrder: 1
        }
      ])
      .onConflictDoNothing();

    await transaction
      .insert(tenantUserOrgPlacements)
      .values([
        {
          tenantId: TENANT_ID,
          userId: "user-alpha-admin",
          track: "functional",
          directionId: "org-alpha-fn-dir",
          departmentId: "org-alpha-fn-pmo",
          teamId: null,
          positionId: "position-project-manager"
        },
        {
          tenantId: TENANT_ID,
          userId: "user-alpha-engineer",
          track: "functional",
          directionId: "org-alpha-fn-dir",
          departmentId: "org-alpha-fn-engineering",
          teamId: null,
          positionId: "position-engineer"
        },
        {
          tenantId: TENANT_ID,
          userId: "user-alpha-plan-reader-no-resources",
          track: "functional",
          directionId: "org-alpha-fn-dir",
          departmentId: "org-alpha-fn-delivery",
          teamId: null,
          positionId: "position-engineer"
        },
        {
          tenantId: TENANT_ID,
          userId: "user-alpha-resource-reader",
          track: "functional",
          directionId: "org-alpha-fn-dir",
          departmentId: "org-alpha-fn-engineering",
          teamId: null,
          positionId: "position-engineer"
        },
        {
          tenantId: TENANT_ID,
          userId: "user-alpha-admin",
          track: "project",
          directionId: "org-alpha-pr-dir",
          departmentId: null,
          teamId: "org-alpha-pr-team-vektor",
          positionId: "position-project-manager"
        },
        {
          tenantId: TENANT_ID,
          userId: "user-alpha-engineer",
          track: "project",
          directionId: "org-alpha-pr-dir",
          departmentId: null,
          teamId: "org-alpha-pr-team-vektor",
          positionId: "position-lead"
        },
        {
          tenantId: TENANT_ID,
          userId: "user-alpha-plan-reader-no-resources",
          track: "project",
          directionId: "org-alpha-pr-dir",
          departmentId: null,
          teamId: "org-alpha-pr-team-gorset",
          positionId: "position-engineer"
        },
        {
          tenantId: TENANT_ID,
          userId: "user-alpha-resource-reader",
          track: "project",
          directionId: "org-alpha-pr-dir",
          departmentId: null,
          teamId: "org-alpha-pr-team-gorset",
          positionId: "position-analyst"
        }
      ])
      .onConflictDoNothing();
  });
}

async function seedCommunications(db: KissPmDatabase, createdAt: Date): Promise<void> {
  const minute = 60 * 1000;
  await db.transaction(async (transaction) => {
    await transaction
      .insert(communicationChannels)
      .values([
        {
          id: "channel-alpha-general",
          tenantId: TENANT_ID,
          channelType: "workspace_general",
          title: "Общий канал Альфа",
          description: "Общие объявления и обсуждения команды.",
          scopeEntityType: null,
          scopeEntityId: null,
          createdByUserId: "user-alpha-admin",
          createdAt,
          updatedAt: createdAt,
          archivedAt: null
        },
        {
          id: "channel-alpha-delivery",
          tenantId: TENANT_ID,
          channelType: "team",
          title: "Отдел внедрения",
          description: "Рабочий канал отдела внедрения.",
          scopeEntityType: "org_unit",
          scopeEntityId: "org-alpha-fn-delivery",
          createdByUserId: "user-alpha-admin",
          createdAt,
          updatedAt: createdAt,
          archivedAt: null
        }
      ])
      .onConflictDoNothing();

    await transaction
      .insert(communicationChannelMembers)
      .values([
        {
          tenantId: TENANT_ID,
          channelId: "channel-alpha-general",
          userId: "user-alpha-admin",
          role: "owner",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        },
        {
          tenantId: TENANT_ID,
          channelId: "channel-alpha-general",
          userId: "user-alpha-engineer",
          role: "member",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        },
        {
          tenantId: TENANT_ID,
          channelId: "channel-alpha-general",
          userId: "user-alpha-plan-reader-no-resources",
          role: "member",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        },
        {
          tenantId: TENANT_ID,
          channelId: "channel-alpha-general",
          userId: "user-alpha-resource-reader",
          role: "member",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        },
        {
          tenantId: TENANT_ID,
          channelId: "channel-alpha-delivery",
          userId: "user-alpha-admin",
          role: "owner",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        },
        {
          tenantId: TENANT_ID,
          channelId: "channel-alpha-delivery",
          userId: "user-alpha-engineer",
          role: "moderator",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        },
        {
          tenantId: TENANT_ID,
          channelId: "channel-alpha-delivery",
          userId: "user-alpha-plan-reader-no-resources",
          role: "member",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        }
      ])
      .onConflictDoNothing();

    await transaction
      .insert(conversations)
      .values([
        {
          id: "conversation-alpha-delivery",
          tenantId: TENANT_ID,
          entityType: "communication_channel",
          entityId: "channel-alpha-delivery",
          conversationType: "default",
          title: "Лента отдела внедрения",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        },
        {
          id: "conversation-vektor-portal",
          tenantId: TENANT_ID,
          entityType: "project",
          entityId: "project-vektor-portal",
          conversationType: "default",
          title: "Обсуждение проекта «Портал Вектор»",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        }
      ])
      .onConflictDoNothing();

    await transaction
      .insert(discussionMessages)
      .values([
        {
          id: "message-alpha-delivery-1",
          tenantId: TENANT_ID,
          conversationId: "conversation-alpha-delivery",
          authorUserId: "user-alpha-admin",
          body: "Коллеги, синхронизируемся по загрузке на этой неделе.",
          metadata: {},
          createdAt: new Date(createdAt.getTime()),
          editedAt: null,
          archivedAt: null,
          pinnedAt: null,
          pinnedByUserId: null
        },
        {
          id: "message-alpha-delivery-2",
          tenantId: TENANT_ID,
          conversationId: "conversation-alpha-delivery",
          authorUserId: "user-alpha-engineer",
          body: "Беру на себя интеграцию по проекту Вектор.",
          metadata: {},
          createdAt: new Date(createdAt.getTime() + 5 * minute),
          editedAt: null,
          archivedAt: null,
          pinnedAt: null,
          pinnedByUserId: null
        },
        {
          id: "message-alpha-delivery-3",
          tenantId: TENANT_ID,
          conversationId: "conversation-alpha-delivery",
          authorUserId: "user-alpha-resource-reader",
          body: "Подготовлю сверку результатов по миграции Горсеть.",
          metadata: {},
          createdAt: new Date(createdAt.getTime() + 12 * minute),
          editedAt: null,
          archivedAt: null,
          pinnedAt: null,
          pinnedByUserId: null
        },
        {
          id: "message-vektor-portal-1",
          tenantId: TENANT_ID,
          conversationId: "conversation-vektor-portal",
          authorUserId: "user-alpha-admin",
          body: "Запускаем подготовительный этап портала.",
          metadata: {},
          createdAt: new Date(createdAt.getTime() + 20 * minute),
          editedAt: null,
          archivedAt: null,
          pinnedAt: null,
          pinnedByUserId: null
        },
        {
          id: "message-vektor-portal-2",
          tenantId: TENANT_ID,
          conversationId: "conversation-vektor-portal",
          authorUserId: "user-alpha-engineer",
          body: "Архитектура почти готова, выложу на ревью завтра.",
          metadata: {},
          createdAt: new Date(createdAt.getTime() + 28 * minute),
          editedAt: null,
          archivedAt: null,
          pinnedAt: null,
          pinnedByUserId: null
        }
      ])
      .onConflictDoNothing();

    await transaction
      .insert(meetings)
      .values([
        {
          id: "meeting-alpha-vektor-kickoff",
          tenantId: TENANT_ID,
          entityType: "project",
          entityId: "project-vektor-portal",
          title: "Кик-офф: Портал Вектор",
          agenda: "Цели проекта, состав команды и ближайшие шаги.",
          scheduledStart: new Date("2026-06-02T07:00:00.000Z"),
          scheduledFinish: new Date("2026-06-02T08:00:00.000Z"),
          status: "scheduled",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        },
        {
          id: "meeting-alpha-gorset-review",
          tenantId: TENANT_ID,
          entityType: "project",
          entityId: "project-gorset-migration",
          title: "Статус миграции Горсеть",
          agenda: "Прогресс ETL, открытые риски и план сверки.",
          scheduledStart: new Date("2026-06-10T11:00:00.000Z"),
          scheduledFinish: new Date("2026-06-10T12:00:00.000Z"),
          status: "completed",
          createdByUserId: "user-alpha-admin",
          createdAt,
          archivedAt: null
        }
      ])
      .onConflictDoNothing();

    await transaction
      .insert(meetingParticipants)
      .values([
        {
          tenantId: TENANT_ID,
          meetingId: "meeting-alpha-vektor-kickoff",
          userId: "user-alpha-admin",
          role: "organizer",
          response: "accepted",
          createdAt
        },
        {
          tenantId: TENANT_ID,
          meetingId: "meeting-alpha-vektor-kickoff",
          userId: "user-alpha-engineer",
          role: "required",
          response: "accepted",
          createdAt
        },
        {
          tenantId: TENANT_ID,
          meetingId: "meeting-alpha-vektor-kickoff",
          userId: "user-alpha-resource-reader",
          role: "optional",
          response: "pending",
          createdAt
        },
        {
          tenantId: TENANT_ID,
          meetingId: "meeting-alpha-gorset-review",
          userId: "user-alpha-admin",
          role: "organizer",
          response: "accepted",
          createdAt
        },
        {
          tenantId: TENANT_ID,
          meetingId: "meeting-alpha-gorset-review",
          userId: "user-alpha-engineer",
          role: "required",
          response: "accepted",
          createdAt
        },
        {
          tenantId: TENANT_ID,
          meetingId: "meeting-alpha-gorset-review",
          userId: "user-alpha-plan-reader-no-resources",
          role: "required",
          response: "declined",
          createdAt
        }
      ])
      .onConflictDoNothing();

    await transaction
      .insert(userNotifications)
      .values([
        {
          id: "notification-alpha-vektor-invite",
          tenantId: TENANT_ID,
          userId: "user-alpha-engineer",
          notificationType: "meeting_invite",
          sourceEntityType: "meeting",
          sourceEntityId: "meeting-alpha-vektor-kickoff",
          title: "Приглашение на кик-офф «Портал Вектор»",
          body: "Вас пригласили на установочную встречу проекта.",
          route: "/communications",
          createdAt,
          readAt: null,
          archivedAt: null
        },
        {
          id: "notification-alpha-arch-assignment",
          tenantId: TENANT_ID,
          userId: "user-alpha-engineer",
          notificationType: "assignment_changed",
          sourceEntityType: "task",
          sourceEntityId: "task-vektor-arch",
          title: "Обновлено назначение по задаче",
          body: "Вам назначена задача «Проектирование архитектуры».",
          route: "/projects/project-vektor-portal",
          createdAt,
          readAt: null,
          archivedAt: null
        },
        {
          id: "notification-alpha-vektor-deadline",
          tenantId: TENANT_ID,
          userId: "user-alpha-admin",
          notificationType: "deadline_risk",
          sourceEntityType: "project",
          sourceEntityId: "project-vektor-portal",
          title: "Риск срыва срока",
          body: "Проект «Портал Вектор» приближается к дедлайну.",
          route: "/projects/project-vektor-portal",
          createdAt,
          readAt: null,
          archivedAt: null
        },
        {
          id: "notification-alpha-delivery-mention",
          tenantId: TENANT_ID,
          userId: "user-alpha-resource-reader",
          notificationType: "mention",
          sourceEntityType: "conversation",
          sourceEntityId: "conversation-alpha-delivery",
          title: "Вас упомянули в обсуждении",
          body: "Сверка по миграции Горсеть закреплена за вами.",
          route: "/communications",
          createdAt,
          readAt: null,
          archivedAt: null
        }
      ])
      .onConflictDoNothing();
  });
}
