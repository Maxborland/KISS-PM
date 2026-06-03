import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import {
  calendarExceptions,
  createDatabase,
  createPostgresClient,
  createTenantAdminSeedProfile,
  seedTenantDataset,
  auditEvents,
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
  type KissPmDatabase,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";
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
      id: "position-lead-architect",
      tenantId: "tenant-alpha",
      name: "Главный архитектор",
      description: "Ведет архитектурную концепцию и критические проектные решения"
    },
    {
      id: "position-architect",
      tenantId: "tenant-alpha",
      name: "Архитектор",
      description: "Готовит разделы проекта, координирует смежников и выпуск стадий"
    },
    {
      id: "position-bim-coordinator",
      tenantId: "tenant-alpha",
      name: "BIM-координатор",
      description: "Контролирует модель, коллизии и выпуск проектной документации"
    },
    {
      id: "position-estimator",
      tenantId: "tenant-alpha",
      name: "Сметчик",
      description: "Готовит сметные расчеты и проверяет коммерческие предпосылки"
    },
    {
      id: "position-engineer",
      tenantId: "tenant-alpha",
      name: "Инженер",
      description: "Участвует в проектных работах и ресурсном планировании"
    },
    {
      id: "position-interior-designer",
      tenantId: "tenant-alpha",
      name: "Дизайнер интерьеров",
      description: "Роль намеренно не закрыта пользователем в beta seed для проверки missing role"
    }
  ],
  clients: [
    {
      id: "client-romashka",
      tenantId: "tenant-alpha",
      name: "ГК Северный квартал",
      description: "Заказчик жилого комплекса и текущего проектного портфеля"
    },
    {
      id: "client-museum",
      tenantId: "tenant-alpha",
      name: "Фонд Музей города",
      description: "Заказчик общественного культурного объекта"
    },
    {
      id: "client-hotel",
      tenantId: "tenant-alpha",
      name: "Отель Набережная",
      description: "Заказчик реконструкции гостиницы и интерьерных зон"
    }
  ],
  contacts: [
    {
      id: "contact-irina",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      name: "Ирина Захарова",
      email: "irina@sever.example",
      phone: "+7 913 000-00-00",
      telegram: "@irina_sever",
      role: "Директор по развитию"
    },
    {
      id: "contact-museum-elena",
      tenantId: "tenant-alpha",
      clientId: "client-museum",
      name: "Елена Орлова",
      email: "elena@museum.example",
      phone: "+7 913 111-00-00",
      telegram: "@elena_museum",
      role: "Куратор проекта"
    },
    {
      id: "contact-hotel-pavel",
      tenantId: "tenant-alpha",
      clientId: "client-hotel",
      name: "Павел Лазарев",
      email: "pavel@hotel.example",
      phone: "+7 913 222-00-00",
      telegram: "@pavel_hotel",
      role: "Управляющий объектом"
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
      name: "Архитектурное проектирование",
      description: "Проектирование общественных и жилых объектов"
    },
    {
      id: "project-type-reconstruction",
      tenantId: "tenant-alpha",
      name: "Реконструкция",
      description: "Обследование, концепция и проект реконструкции"
    },
    {
      id: "project-type-supervision",
      tenantId: "tenant-alpha",
      name: "Авторский надзор",
      description: "Сопровождение реализации и контроль проектных решений"
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
    },
    {
      id: "deal-stage-commercial",
      tenantId: "tenant-alpha",
      name: "Коммерческое предложение",
      sortOrder: 40
    },
    {
      id: "deal-stage-contract",
      tenantId: "tenant-alpha",
      name: "Договор",
      sortOrder: 50
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
      id: "user-alpha-lead-architect",
      tenantId: "tenant-alpha",
      name: "Мария Главный архитектор",
      accessProfileId: "access-profile-alpha-admin",
      email: "lead.architect@kiss-pm.local",
      positionId: "position-lead-architect",
      password: "lead12345"
    },
    {
      id: "user-alpha-architect",
      tenantId: "tenant-alpha",
      name: "Сергей Архитектор",
      accessProfileId: "access-profile-alpha-admin",
      email: "architect@kiss-pm.local",
      positionId: "position-architect",
      password: "architect12345"
    },
    {
      id: "user-alpha-bim",
      tenantId: "tenant-alpha",
      name: "Ольга BIM",
      accessProfileId: "access-profile-alpha-admin",
      email: "bim@kiss-pm.local",
      positionId: "position-bim-coordinator",
      password: "bim12345"
    },
    {
      id: "user-alpha-estimator",
      tenantId: "tenant-alpha",
      name: "Никита Сметчик",
      accessProfileId: "access-profile-alpha-admin",
      email: "estimator@kiss-pm.local",
      positionId: "position-estimator",
      password: "estimator12345"
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
  console.log("Seeded beta architecture bureau dataset");
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
        clientName: "ГК Северный квартал",
        contactName: "Ирина Захарова",
        title: "ЖК Северный квартал — стадия П",
        projectType: "Архитектурное проектирование",
        description: "Жилой комплекс: проектная документация, координация разделов и авторский контроль рисков",
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
        title: "ЖК Северный квартал — стадия П",
        clientName: "ГК Северный квартал",
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
        title: "Подготовить ресурсную оценку по стадии П",
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
        title: "Согласовать состав команды по Северному кварталу",
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
        title: "Разобрать замечания заказчика по планировкам",
        description: "Собрать контекст по встрече и перенести решения в карточку проекта.",
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
        title: "Проверить критический путь выпуска стадии П",
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
        title: "Закрыть замечание по ведомости помещений",
        description: "Проверить корректность ведомости перед передачей заказчику.",
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

    await seedDemoPlanningData(transaction, createdAt);
    await seedBetaPortfolioData(transaction, createdAt);
  });
}

async function seedBetaPortfolioData(
  db: KissPmDatabase,
  createdAt: Date
): Promise<void> {
  const betaOpportunities = [
    {
      id: "opportunity-beta-school-renovation",
      tenantId: "tenant-alpha",
      clientId: "client-romashka",
      primaryContactId: "contact-irina",
      ownerUserId: "user-alpha-lead-architect",
      projectTypeId: "project-type-reconstruction",
      stageId: "deal-stage-contract",
      clientName: "ГК Северный квартал",
      contactName: "Ирина Захарова",
      title: "Школа на 600 мест — реконструкция",
      projectType: "Реконструкция",
      description: "Переустройство учебного корпуса с жестким сроком выпуска экспертизы.",
      plannedStart: new Date("2026-05-04T00:00:00.000Z"),
      plannedFinish: new Date("2026-05-29T00:00:00.000Z"),
      contractValue: 1440000,
      plannedHourlyRate: 6000,
      plannedHours: 240,
      probability: 90,
      status: "ready_to_activate",
      templateId: null,
      feasibilityStatus: "warning",
      feasibilityResult: { blockers: ["missing_position_capacity"], warnings: ["architect_overload"] },
      feasibilityCheckedAt: createdAt,
      customFieldValues: {},
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "opportunity-beta-museum-concept",
      tenantId: "tenant-alpha",
      clientId: "client-museum",
      primaryContactId: "contact-museum-elena",
      ownerUserId: "user-alpha-admin",
      projectTypeId: "project-type-implementation",
      stageId: "deal-stage-commercial",
      clientName: "Фонд Музей города",
      contactName: "Елена Орлова",
      title: "Музей города — концепция экспозиции",
      projectType: "Архитектурное проектирование",
      description: "Концепция общественного пространства и сценарий согласований.",
      plannedStart: new Date("2026-06-03T00:00:00.000Z"),
      plannedFinish: new Date("2026-07-10T00:00:00.000Z"),
      contractValue: 2160000,
      plannedHourlyRate: 6000,
      plannedHours: 360,
      probability: 75,
      status: "proposal_sent",
      templateId: null,
      feasibilityStatus: "sufficient",
      feasibilityResult: { warnings: [] },
      feasibilityCheckedAt: createdAt,
      customFieldValues: {},
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "opportunity-beta-hotel-interiors",
      tenantId: "tenant-alpha",
      clientId: "client-hotel",
      primaryContactId: "contact-hotel-pavel",
      ownerUserId: "user-alpha-lead-architect",
      projectTypeId: "project-type-reconstruction",
      stageId: "deal-stage-qualified",
      clientName: "Отель Набережная",
      contactName: "Павел Лазарев",
      title: "Отель Набережная — общественные зоны",
      projectType: "Реконструкция",
      description: "Реконструкция лобби, ресторана и навигации с незакрытой ролью дизайнера интерьеров.",
      plannedStart: new Date("2026-06-10T00:00:00.000Z"),
      plannedFinish: new Date("2026-08-14T00:00:00.000Z"),
      contractValue: 1800000,
      plannedHourlyRate: 6000,
      plannedHours: 300,
      probability: 55,
      status: "feasibility_check",
      templateId: null,
      feasibilityStatus: "blocked",
      feasibilityResult: { blockers: ["missing_position_capacity"] },
      feasibilityCheckedAt: createdAt,
      customFieldValues: {},
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "opportunity-beta-office-fitout",
      tenantId: "tenant-alpha",
      clientId: "client-museum",
      primaryContactId: "contact-museum-elena",
      ownerUserId: "user-alpha-estimator",
      projectTypeId: "project-type-supervision",
      stageId: "deal-stage-new",
      clientName: "Фонд Музей города",
      contactName: "Елена Орлова",
      title: "Фонд Музей города — авторский надзор",
      projectType: "Авторский надзор",
      description: "Пакет надзора после запуска строительных работ.",
      plannedStart: new Date("2026-07-01T00:00:00.000Z"),
      plannedFinish: new Date("2026-09-30T00:00:00.000Z"),
      contractValue: 720000,
      plannedHourlyRate: 6000,
      plannedHours: 120,
      probability: 35,
      status: "new",
      templateId: null,
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      customFieldValues: {},
      createdAt,
      updatedAt: createdAt
    }
  ];

  for (const opportunity of betaOpportunities) {
    await db
      .insert(opportunities)
      .values(opportunity)
      .onConflictDoUpdate({
        target: [opportunities.tenantId, opportunities.id],
        set: {
          stageId: opportunity.stageId,
          title: opportunity.title,
          status: opportunity.status,
          probability: opportunity.probability,
          plannedFinish: opportunity.plannedFinish,
          feasibilityStatus: opportunity.feasibilityStatus,
          feasibilityResult: opportunity.feasibilityResult,
          updatedAt: createdAt
        }
      });
  }

  await db
    .insert(opportunityDemands)
    .values([
      {
        tenantId: "tenant-alpha",
        opportunityId: "opportunity-beta-school-renovation",
        positionId: "position-architect",
        requiredHours: 120
      },
      {
        tenantId: "tenant-alpha",
        opportunityId: "opportunity-beta-school-renovation",
        positionId: "position-bim-coordinator",
        requiredHours: 60
      },
      {
        tenantId: "tenant-alpha",
        opportunityId: "opportunity-beta-hotel-interiors",
        positionId: "position-interior-designer",
        requiredHours: 140
      },
      {
        tenantId: "tenant-alpha",
        opportunityId: "opportunity-beta-museum-concept",
        positionId: "position-lead-architect",
        requiredHours: 80
      }
    ])
    .onConflictDoNothing();

  const betaProjects = [
    {
      id: "project-beta-school-renovation",
      tenantId: "tenant-alpha",
      sourceOpportunityId: "opportunity-beta-school-renovation",
      clientId: "client-romashka",
      projectTypeId: "project-type-reconstruction",
      title: "Школа на 600 мест — реконструкция",
      clientName: "ГК Северный квартал",
      status: "active",
      plannedStart: new Date("2026-05-04T00:00:00.000Z"),
      plannedFinish: new Date("2026-05-29T00:00:00.000Z"),
      deadline: new Date("2026-05-31T00:00:00.000Z"),
      calendarId: null,
      contractValue: 1440000,
      plannedHours: 240,
      templateId: null,
      createdAt,
      activatedAt: createdAt
    },
    {
      id: "project-beta-museum-concept",
      tenantId: "tenant-alpha",
      sourceOpportunityId: "opportunity-beta-museum-concept",
      clientId: "client-museum",
      projectTypeId: "project-type-implementation",
      title: "Музей города — концепция экспозиции",
      clientName: "Фонд Музей города",
      status: "active",
      plannedStart: new Date("2026-06-03T00:00:00.000Z"),
      plannedFinish: new Date("2026-07-10T00:00:00.000Z"),
      deadline: new Date("2026-07-12T00:00:00.000Z"),
      calendarId: null,
      contractValue: 2160000,
      plannedHours: 360,
      templateId: null,
      createdAt,
      activatedAt: createdAt
    },
    {
      id: "project-beta-hotel-interiors",
      tenantId: "tenant-alpha",
      sourceOpportunityId: "opportunity-beta-hotel-interiors",
      clientId: "client-hotel",
      projectTypeId: "project-type-reconstruction",
      title: "Отель Набережная — общественные зоны",
      clientName: "Отель Набережная",
      status: "draft",
      plannedStart: new Date("2026-06-10T00:00:00.000Z"),
      plannedFinish: new Date("2026-08-14T00:00:00.000Z"),
      deadline: new Date("2026-08-20T00:00:00.000Z"),
      calendarId: null,
      contractValue: 1800000,
      plannedHours: 300,
      templateId: null,
      createdAt,
      activatedAt: null
    }
  ];

  for (const project of betaProjects) {
    await db
      .insert(projects)
      .values(project)
      .onConflictDoUpdate({
        target: [projects.tenantId, projects.id],
        set: {
          title: project.title,
          status: project.status,
          plannedStart: project.plannedStart,
          plannedFinish: project.plannedFinish,
          deadline: project.deadline,
          plannedHours: project.plannedHours
        }
      });
  }

  await db
    .insert(projectPositionDemands)
    .values([
      {
        tenantId: "tenant-alpha",
        projectId: "project-beta-school-renovation",
        positionId: "position-architect",
        requiredHours: 120
      },
      {
        tenantId: "tenant-alpha",
        projectId: "project-beta-school-renovation",
        positionId: "position-bim-coordinator",
        requiredHours: 60
      },
      {
        tenantId: "tenant-alpha",
        projectId: "project-beta-hotel-interiors",
        positionId: "position-interior-designer",
        requiredHours: 140
      },
      {
        tenantId: "tenant-alpha",
        projectId: "project-beta-museum-concept",
        positionId: "position-lead-architect",
        requiredHours: 80
      }
    ])
    .onConflictDoNothing();

  const betaTasks = [
    betaTask("task-beta-school-survey", "project-beta-school-renovation", "Обмерить существующие классы", "in_progress", "task-status-in-progress", "critical", "user-alpha-architect", "2026-05-06", "2026-05-08", 32, ["user-alpha-bim"]),
    betaTask("task-beta-school-fire-brief", "project-beta-school-renovation", "Согласовать пожарные требования", "waiting", "task-status-waiting", "critical", "user-alpha-lead-architect", "2026-05-09", "2026-05-13", 24, []),
    betaTask("task-beta-school-layouts", "project-beta-school-renovation", "Выпустить планировочные решения", "in_progress", "task-status-in-progress", "high", "user-alpha-architect", "2026-05-14", "2026-05-20", 56, ["user-alpha-bim"]),
    betaTask("task-beta-school-bim-clashes", "project-beta-school-renovation", "Разобрать BIM-коллизии эвакуации", "review", "task-status-review", "high", "user-alpha-bim", "2026-05-21", "2026-05-24", 28, ["user-alpha-architect"]),
    betaTask("task-beta-school-estimate", "project-beta-school-renovation", "Проверить сметные предпосылки", "new", "task-status-new", "normal", "user-alpha-estimator", "2026-05-24", "2026-05-27", 18, []),
    betaTask("task-beta-school-expertise-pack", "project-beta-school-renovation", "Собрать пакет на экспертизу", "waiting", "task-status-waiting", "critical", "user-alpha-admin", "2026-05-28", "2026-05-29", 16, ["user-alpha-lead-architect"]),
    betaTask("task-beta-museum-program", "project-beta-museum-concept", "Собрать функциональную программу музея", "in_progress", "task-status-in-progress", "high", "user-alpha-lead-architect", "2026-06-03", "2026-06-07", 40, []),
    betaTask("task-beta-museum-scenarios", "project-beta-museum-concept", "Разложить сценарии посетителей", "new", "task-status-new", "normal", "user-alpha-architect", "2026-06-05", "2026-06-11", 36, ["user-alpha-bim"]),
    betaTask("task-beta-museum-board", "project-beta-museum-concept", "Подготовить презентацию концепции", "new", "task-status-new", "high", "user-alpha-admin", "2026-06-12", "2026-06-17", 32, ["user-alpha-lead-architect"]),
    betaTask("task-beta-museum-cost-frame", "project-beta-museum-concept", "Оценить рамку бюджета концепции", "new", "task-status-new", "normal", "user-alpha-estimator", "2026-06-14", "2026-06-18", 20, []),
    betaTask("task-beta-museum-bim-shell", "project-beta-museum-concept", "Подготовить BIM-основу зала", "new", "task-status-new", "normal", "user-alpha-bim", "2026-06-18", "2026-06-24", 48, []),
    betaTask("task-beta-hotel-survey", "project-beta-hotel-interiors", "Проверить обмеры общественных зон", "new", "task-status-new", "high", "user-alpha-architect", "2026-06-10", "2026-06-12", 24, []),
    betaTask("task-beta-hotel-interior-gap", "project-beta-hotel-interiors", "Закрыть роль дизайнера интерьеров", "waiting", "task-status-waiting", "critical", "user-alpha-admin", "2026-06-10", "2026-06-14", 8, []),
    betaTask("task-beta-hotel-code-check", "project-beta-hotel-interiors", "Проверить нормы реконструкции лобби", "new", "task-status-new", "normal", "user-alpha-lead-architect", "2026-06-15", "2026-06-20", 28, ["user-alpha-engineer"]),
    betaTask("task-beta-hotel-estimate", "project-beta-hotel-interiors", "Подготовить оценку стоимости интерьеров", "new", "task-status-new", "normal", "user-alpha-estimator", "2026-06-21", "2026-06-26", 22, []),
    betaTask("task-beta-cross-weekly-risk", "project-demo-crm-intake", "Обновить недельный список рисков", "in_progress", "task-status-in-progress", "high", "user-alpha-admin", "2026-06-01", "2026-06-03", 12, []),
    betaTask("task-beta-cross-client-followup", "project-demo-crm-intake", "Подготовить follow-up заказчику", "new", "task-status-new", "normal", "user-alpha-lead-architect", "2026-06-03", "2026-06-04", 8, []),
    betaTask("task-beta-cross-resource-conflict", "project-demo-crm-intake", "Разрулить перегруз архитектора", "waiting", "task-status-waiting", "critical", "user-alpha-architect", "2026-06-03", "2026-06-03", 12, ["user-alpha-admin"]),
    betaTask("task-beta-cross-agent-audit", "project-demo-crm-intake", "Проверить результат действия агента", "review", "task-status-review", "normal", "user-alpha-admin", "2026-06-04", "2026-06-05", 6, [])
  ];

  for (const task of betaTasks) {
    await db
      .insert(tasks)
      .values({
        id: task.id,
        tenantId: "tenant-alpha",
        projectId: task.projectId,
        stageId: null,
        title: task.title,
        description: task.description,
        status: task.status,
        statusId: task.statusId,
        priority: task.priority,
        requesterUserId: "user-alpha-admin",
        ownerUserId: task.ownerUserId,
        plannedStart: new Date(`${task.plannedStart}T00:00:00.000Z`),
        plannedFinish: new Date(`${task.plannedFinish}T00:00:00.000Z`),
        plannedStartMinute: 0,
        plannedFinishMinute: 480,
        parentTaskId: null,
        wbsCode: task.wbsCode,
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        durationMinutes: task.durationWorkingDays * 480,
        workMinutes: task.plannedWork * 60,
        constraintType: null,
        constraintDate: null,
        durationWorkingDays: task.durationWorkingDays,
        plannedWork: task.plannedWork,
        actualWork: task.status === "done" ? task.plannedWork : 0,
        progress: task.status === "review" ? 80 : task.status === "in_progress" ? 35 : 0,
        requiresAcceptance: task.priority === "critical",
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
          plannedStart: new Date(`${task.plannedStart}T00:00:00.000Z`),
          plannedFinish: new Date(`${task.plannedFinish}T00:00:00.000Z`),
          plannedWork: task.plannedWork,
          workMinutes: task.plannedWork * 60,
          updatedAt: createdAt
        }
      });

    await db
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
          userId: task.ownerUserId,
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

    await db
      .insert(taskAssignments)
      .values([
        {
          id: `${task.id}-assignment-owner`,
          tenantId: "tenant-alpha",
          projectId: task.projectId,
          taskId: task.id,
          resourceId: task.ownerUserId,
          role: "executor",
          unitsPermille: 1000,
          workMinutes: task.plannedWork * 60,
          calendarId: task.ownerUserId === "user-alpha-engineer" ? "calendar-demo-engineer" : null
        },
        ...task.coExecutors.map((userId) => ({
          id: `${task.id}-assignment-${userId}`,
          tenantId: "tenant-alpha",
          projectId: task.projectId,
          taskId: task.id,
          resourceId: userId,
          role: "co_executor",
          unitsPermille: 500,
          workMinutes: Math.max(60, Math.round(task.plannedWork * 30)),
          calendarId: userId === "user-alpha-engineer" ? "calendar-demo-engineer" : null
        }))
      ])
      .onConflictDoNothing();

    await db
      .insert(taskActivities)
      .values({
        id: `${task.id}-activity-seed`,
        tenantId: "tenant-alpha",
        taskId: task.id,
        type: "system",
        title: task.status === "waiting" ? "Блокер требует решения" : "Задача добавлена в beta seed",
        body:
          task.status === "waiting"
            ? "Задача намеренно находится в ожидании: нужен внешний ответ, роль или управленческое решение."
            : `Ответственный: ${task.ownerUserId}. План: ${task.plannedWork} ч.`,
        fileUrl: null,
        fileSizeBytes: null,
        mimeType: null,
        authorUserId: "user-alpha-admin",
        createdAt,
        updatedAt: createdAt
      })
      .onConflictDoNothing();
  }

  await db
    .insert(resourceReservations)
    .values([
      {
        id: "reservation-beta-architect-overload",
        tenantId: "tenant-alpha",
        projectId: "project-demo-crm-intake",
        resourceId: "user-alpha-architect",
        start: "2026-06-03",
        finish: "2026-06-03",
        workMinutes: 420,
        reason: "Beta seed: перегруз архитектора на день управленческого контроля"
      },
      {
        id: "reservation-beta-lead-client-workshop",
        tenantId: "tenant-alpha",
        projectId: "project-beta-museum-concept",
        resourceId: "user-alpha-lead-architect",
        start: "2026-06-05",
        finish: "2026-06-05",
        workMinutes: 360,
        reason: "Beta seed: воркшоп с заказчиком"
      }
    ])
    .onConflictDoNothing();

  await db
    .insert(auditEvents)
    .values([
      betaAuditEvent("audit-beta-seed-project-risk", "project.risk.seeded", "Project", "project-beta-school-renovation", createdAt, {
        title: "Школа на 600 мест — реконструкция",
        reason: "Проект просрочен и должен появиться в attention cockpit."
      }),
      betaAuditEvent("audit-beta-seed-task-blocker", "task.blocker.seeded", "Task", "task-beta-hotel-interior-gap", createdAt, {
        title: "Закрыть роль дизайнера интерьеров",
        reason: "Незакрытая роль в beta seed."
      }),
      betaAuditEvent("audit-beta-seed-agent-result", "workspace.agent.seeded_result", "Task", "task-beta-cross-agent-audit", createdAt, {
        title: "Проверить результат действия агента",
        reason: "История для будущей проверки audit/result surface агента."
      })
    ])
    .onConflictDoNothing();
}

function betaTask(
  id: string,
  projectId: string,
  title: string,
  status: "new" | "waiting" | "in_progress" | "review" | "done",
  statusId: string,
  priority: "low" | "normal" | "high" | "critical",
  ownerUserId: string,
  plannedStart: string,
  plannedFinish: string,
  plannedWork: number,
  coExecutors: string[]
) {
  const durationWorkingDays = Math.max(
    1,
    Math.round(
      (new Date(`${plannedFinish}T00:00:00.000Z`).getTime() -
        new Date(`${plannedStart}T00:00:00.000Z`).getTime()) /
        86_400_000
    ) + 1
  );

  return {
    id,
    projectId,
    title,
    description: `${title}. Beta seed для founder-ready проверки проектного контура.`,
    status,
    statusId,
    priority,
    ownerUserId,
    plannedStart,
    plannedFinish,
    plannedWork,
    durationWorkingDays,
    wbsCode: id.replace("task-beta-", "").replaceAll("-", "."),
    coExecutors
  };
}

function betaAuditEvent(
  id: string,
  actionType: string,
  sourceEntityType: string,
  sourceEntityId: string,
  createdAt: Date,
  afterState: Record<string, unknown>
) {
  return {
    id,
    tenantId: "tenant-alpha",
    actorUserId: "user-alpha-admin",
    actionType,
    sourceSurfaceId: "beta-seed",
    sourceWorkflow: "founder-beta-seed",
    sourceEntity: {
      type: sourceEntityType,
      id: sourceEntityId
    },
    input: {
      seeded: true
    },
    beforeState: null,
    afterState,
    permissionResult: {
      allowed: true,
      reason: "seeded"
    },
    executionResult: {
      status: "applied"
    },
    correlationId: `${id}:correlation`,
    createdAt
  };
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
        reason: "Beta seed: короткий день для проектного календаря",
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
        reason: "Beta seed: частичная недоступность инженера",
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
      reason: "Beta seed: поддержка действующего проекта"
    })
    .onConflictDoUpdate({
      target: [resourceReservations.tenantId, resourceReservations.projectId, resourceReservations.id],
      set: {
        resourceId: "user-alpha-engineer",
        start: "2026-05-21",
        finish: "2026-05-21",
        workMinutes: 240,
        reason: "Beta seed: поддержка действующего проекта"
      }
    });

  await db
    .insert(projectBaselines)
    .values({
      id: "baseline-demo-initial",
      tenantId: "tenant-alpha",
      projectId: "project-demo-crm-intake",
      label: "Beta baseline: стартовый план",
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
