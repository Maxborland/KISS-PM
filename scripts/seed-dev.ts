import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import {
  calendarExceptions,
  createDatabase,
  createPostgresClient,
  createTenantAdminSeedProfile,
  seedTenantDataset,
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
