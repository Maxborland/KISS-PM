import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";
import { createPlanningRepository } from "./planningRepository";
import { createProjectIntakeRepository } from "./projectIntakeRepository";
import { createProjectWorkRepository } from "./projectWorkRepository";
import {
  calendarExceptions,
  resourceCalendarEvents,
  projectBaselineTasks,
  projectBaselineAssignments,
  projectBaselines,
  projectCalendars,
  resourcePersonalCalendars,
  resourceCalendars,
  resourceReservations,
  taskAssignmentAllocations,
  taskAssignments,
  taskParticipants,
  tasks
} from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const planningSeed: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Альфа Проект" }],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: [
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.project_plan.read",
        "tenant.project_plan.manage"
      ]
    }
  ],
  positions: [
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
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-engineer",
      password: "admin12345"
    },
    {
      id: "user-alpha-executor",
      tenantId: "tenant-alpha",
      email: "executor@kiss-pm.local",
      name: "Егор Исполнитель",
      accessProfileId: "access-profile-alpha-admin",
      positionId: "position-engineer",
      password: "executor12345"
    }
  ]
};

describe("planning repository", () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
  });

  beforeEach(async () => {
    await client`TRUNCATE planning_command_idempotency_keys, planning_forecast_runs, planning_solver_runs, planning_scenario_runs, task_assignment_allocations, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, audit_events, task_activities, task_participants, tasks, task_statuses, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await seedTenantDataset(
      createDatabase(client),
      planningSeed,
      new Date("2026-05-21T00:00:00.000Z")
    );
  });

  afterAll(async () => {
    await client`TRUNCATE planning_command_idempotency_keys, planning_forecast_runs, planning_solver_runs, planning_scenario_runs, task_assignment_allocations, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, audit_events, task_activities, task_participants, tasks, task_statuses, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
    await client.end();
  });

  it("assembles a full PlanSnapshot for an active project", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);
    const now = new Date("2026-05-21T00:00:00.000Z");

    await db.insert(projectCalendars).values({
      id: "calendar-project-alpha",
      tenantId: "tenant-alpha",
      projectId,
      workingWeekdays: [1, 2, 3, 4, 5],
      workingMinutesPerDay: 480,
      createdAt: now,
      updatedAt: now
    });
    await db.insert(calendarExceptions).values({
      id: "calendar-exception-alpha",
      tenantId: "tenant-alpha",
      projectId,
      calendarId: "calendar-project-alpha",
      resourceId: null,
      date: "2026-06-12",
      workingMinutes: 0,
      reason: "holiday",
      createdAt: now,
      updatedAt: now
    });
    await planningRepository.upsertTaskAssignment({
      id: "assignment-alpha",
      tenantId: "tenant-alpha",
      projectId,
      taskId: "task-alpha",
      resourceId: "user-alpha-executor",
      role: "executor",
      unitsPermille: 1000,
      workMinutes: 960,
      calendarId: null
    });
    await db.insert(taskParticipants).values({
      tenantId: "tenant-alpha",
      taskId: "task-alpha",
      userId: "user-alpha-admin",
      role: "controller"
    });
    await planningRepository.upsertTaskDependency({
      id: "dep-alpha-beta",
      tenantId: "tenant-alpha",
      projectId,
      predecessorTaskId: "task-alpha",
      successorTaskId: "task-beta",
      type: "FS",
      lagMinutes: 0
    });
    await db.insert(resourceReservations).values({
      id: "reservation-alpha",
      tenantId: "tenant-alpha",
      projectId,
      resourceId: "user-alpha-executor",
      start: "2026-06-10",
      finish: "2026-06-10",
      workMinutes: 120,
      reason: "support"
    });
    await db.insert(projectBaselines).values({
      id: "baseline-alpha",
      tenantId: "tenant-alpha",
      projectId,
      label: "Baseline",
      capturedAt: now
    });
    await db.insert(projectBaselineTasks).values({
      tenantId: "tenant-alpha",
      projectId,
      baselineId: "baseline-alpha",
      taskId: "task-alpha",
      plannedStart: "2026-06-02",
      plannedFinish: "2026-06-05",
      workMinutes: 960
    });
    await db.insert(projectBaselineAssignments).values({
      tenantId: "tenant-alpha",
      projectId,
      baselineId: "baseline-alpha",
      assignmentId: "assignment-alpha",
      taskId: "task-alpha",
      resourceId: "user-alpha-executor",
      workMinutes: 960
    });
    await db.insert(resourcePersonalCalendars).values({
      id: "personal-calendar-user-alpha-executor",
      tenantId: "tenant-alpha",
      userId: "user-alpha-executor",
      name: "Личный календарь",
      timezone: "UTC",
      sourceProvider: "manual",
      syncStatus: "manual",
      createdByUserId: "user-alpha-admin",
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    });
    await db.insert(resourceCalendarEvents).values({
      id: "calendar-event-alpha",
      tenantId: "tenant-alpha",
      calendarId: "personal-calendar-user-alpha-executor",
      userId: "user-alpha-executor",
      sourceProvider: "manual",
      externalId: null,
      title: "Фокус-время",
      startsAt: new Date("2026-06-04T09:00:00.000Z"),
      finishesAt: new Date("2026-06-04T10:30:00.000Z"),
      workMinutes: null,
      capacityImpact: "busy",
      visibility: "busy_only",
      metadata: {},
      createdByUserId: "user-alpha-admin",
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(snapshot).toMatchObject({
      tenantId: "tenant-alpha",
      projectId,
      planVersion: 1,
      project: {
        sourceType: "opportunity",
        sourceOpportunityId: "opportunity-alpha"
      },
      tasks: expect.arrayContaining([
        expect.objectContaining({
          id: "task-alpha",
          taskType: "fixed_units",
          workMinutes: 1440
        })
      ]),
      assignments: expect.arrayContaining([
        expect.objectContaining({ id: "assignment-alpha" }),
        expect.objectContaining({
          id: "task-alpha-user-alpha-admin-controller",
          taskId: "task-alpha",
          resourceId: "user-alpha-admin",
          role: "controller"
        }),
        expect.objectContaining({ id: "task-beta-user-alpha-executor-executor" })
      ]),
      dependencies: [expect.objectContaining({ id: "dep-alpha-beta", type: "FS" })],
      baselines: [
        expect.objectContaining({
          id: "baseline-alpha",
          assignments: [
            {
              assignmentId: "assignment-alpha",
              taskId: "task-alpha",
              resourceId: "user-alpha-executor",
              role: "executor",
              unitsPermille: 1000,
              workMinutes: 960
            }
          ]
        })
      ],
      calendars: expect.arrayContaining([
        expect.objectContaining({ id: "tenant-default" }),
        expect.objectContaining({ id: "calendar-project-alpha" })
      ]),
      calendarExceptions: [expect.objectContaining({ id: "calendar-exception-alpha" })],
      reservations: [expect.objectContaining({ id: "reservation-alpha" })],
      occupancyWindows: [
        expect.objectContaining({
          id: "calendar-event:calendar-event-alpha",
          resourceId: "user-alpha-executor",
          sourceType: "personal_calendar_event"
        })
      ]
    });
    expect(snapshot?.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "user-alpha-executor", positionId: "position-engineer" })
      ])
    );
  });

  it("rejects cross-project dependencies through same-project foreign keys", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    await createActiveProjectWithTasks(intakeRepository, workRepository);
    await createActiveProjectWithTasks(intakeRepository, workRepository, {
      opportunityId: "opportunity-beta",
      projectId: "project-beta",
      taskAId: "task-beta-a",
      taskBId: "task-beta-b"
    });

    await expect(
      planningRepository.upsertTaskDependency({
        id: "dep-cross-project",
        tenantId: "tenant-alpha",
        projectId: "project-alpha",
        predecessorTaskId: "task-beta-a",
        successorTaskId: "task-alpha",
        type: "FS",
        lagMinutes: 0
      })
    ).rejects.toThrow();
  });

  it("persists explicit assignment allocations with assignment/date uniqueness", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "assignment.upsert",
        payload: {
          id: "assignment-alpha",
          taskId: "task-alpha",
          resourceId: "user-alpha-executor",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 960
        }
      }
    });
    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "assignment.allocations.replace",
        payload: {
          assignmentId: "assignment-alpha",
          allocations: [
            { date: "2026-06-02", workMinutes: 480 },
            { date: "2026-06-03", workMinutes: 480 }
          ]
        }
      }
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(snapshot?.assignmentAllocations).toEqual([
      {
        assignmentId: "assignment-alpha",
        taskId: "task-alpha",
        resourceId: "user-alpha-executor",
        date: "2026-06-02",
        workMinutes: 480
      },
      {
        assignmentId: "assignment-alpha",
        taskId: "task-alpha",
        resourceId: "user-alpha-executor",
        date: "2026-06-03",
        workMinutes: 480
      }
    ]);
    await expect(
      db.insert(taskAssignmentAllocations).values({
        id: "duplicate-allocation",
        tenantId: "tenant-alpha",
        projectId,
        assignmentId: "assignment-alpha",
        taskId: "task-alpha",
        resourceId: "user-alpha-executor",
        date: "2026-06-02",
        workMinutes: 60,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    ).rejects.toThrow();
  });

  it("cascades explicit allocations when their assignment is deleted", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "assignment.upsert",
        payload: {
          id: "assignment-alpha",
          taskId: "task-alpha",
          resourceId: "user-alpha-executor",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: 480
        }
      }
    });
    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "assignment.allocations.replace",
        payload: {
          assignmentId: "assignment-alpha",
          allocations: [{ date: "2026-06-02", workMinutes: 480 }]
        }
      }
    });

    await db
      .delete(taskAssignments)
      .where(
        and(
          eq(taskAssignments.tenantId, "tenant-alpha"),
          eq(taskAssignments.projectId, projectId),
          eq(taskAssignments.id, "assignment-alpha")
        )
      );

    const rows = await db
      .select({ id: taskAssignmentAllocations.id })
      .from(taskAssignmentAllocations)
      .where(
        and(
          eq(taskAssignmentAllocations.tenantId, "tenant-alpha"),
          eq(taskAssignmentAllocations.projectId, projectId),
          eq(taskAssignmentAllocations.assignmentId, "assignment-alpha")
        )
      );
    expect(rows).toEqual([]);
  });

  it("persists solver runs without recomputing proposals during apply marking", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);
    const proposals = [
      {
        id: "proposal-1",
        planDelta: { commands: [] },
        explainability: { reason: "stored result" }
      }
    ];

    await planningRepository.createPlanningSolverRun({
      id: "solver-run-alpha",
      tenantId: "tenant-alpha",
      projectId,
      mode: "schedule",
      clientPlanVersion: 1,
      engineVersion: "planning-core-v1",
      inputSnapshotMetadata: { projectId, planVersion: 1 },
      targetDeadline: "2026-06-20",
      proposals,
      proposalPayloadHash: "hash-alpha",
      actorUserId: "user-alpha-admin",
      expiresAt: new Date("2026-05-21T00:30:00.000Z")
    });
    await planningRepository.markPlanningSolverRunApplied({
      tenantId: "tenant-alpha",
      projectId,
      runId: "solver-run-alpha",
      proposalId: "proposal-1",
      appliedAt: new Date("2026-05-21T00:10:00.000Z")
    });

    const run = await planningRepository.findPlanningSolverRun(
      "tenant-alpha",
      projectId,
      "solver-run-alpha"
    );
    const crossTenantRun = await planningRepository.findPlanningSolverRun(
      "tenant-beta",
      projectId,
      "solver-run-alpha"
    );
    const crossProjectRun = await planningRepository.findPlanningSolverRun(
      "tenant-alpha",
      "project-other",
      "solver-run-alpha"
    );

    expect(run).toMatchObject({
      id: "solver-run-alpha",
      mode: "schedule",
      clientPlanVersion: 1,
      targetDeadline: "2026-06-20",
      proposals,
      appliedProposalId: "proposal-1"
    });
    expect(run?.appliedAt?.toISOString()).toBe("2026-05-21T00:10:00.000Z");
    expect(crossTenantRun).toBeUndefined();
    expect(crossProjectRun).toBeUndefined();
  });

  it("persists forecast runs with scoped readback and JSON payloads", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);
    const otherProjectId = await createActiveProjectWithTasks(intakeRepository, workRepository, {
      opportunityId: "opportunity-forecast-other",
      projectId: "project-forecast-other",
      taskAId: "task-forecast-other-alpha",
      taskBId: "task-forecast-other-beta"
    });
    const calculatedAt = new Date("2026-05-21T00:05:00.000Z");
    const createdAt = new Date("2026-05-21T00:06:00.000Z");
    const expiresAt = new Date("2026-05-22T00:06:00.000Z");

    await planningRepository.createPlanningForecastRun({
      id: "forecast-run-alpha",
      tenantId: "tenant-alpha",
      projectId,
      clientPlanVersion: 7,
      engineVersion: "forecast-engine-v1",
      health: "needs_decision",
      managerSummary: "Plan needs a manager decision before commit.",
      riskDrivers: [
        {
          code: "resource_overloaded",
          severity: "critical",
          message: "Executor is overloaded.",
          taskIds: ["task-alpha"],
          resourceIds: ["user-alpha-executor"],
          dependencyIds: [],
          date: "2026-06-20",
          overloadMinutes: 240,
          deadlineDeltaDays: null,
          validationIssueCodes: []
        }
      ],
      recommendations: [
        {
          code: "add_resource",
          message: "Add another executor before changing baseline.",
          actionRequired: true,
          taskIds: ["task-alpha"],
          resourceIds: ["user-alpha-executor"]
        }
      ],
      engineMetadata: {
        source: "deterministic_planning_engine",
        tenantId: "tenant-alpha",
        projectId,
        planVersion: 7,
        engineVersion: "forecast-engine-v1",
        calculatedAt: calculatedAt.toISOString(),
        projectFinish: "2026-06-20",
        deadline: "2026-06-18",
        deadlineDeltaDays: 2,
        solverProposalCount: 1
      },
      engineDebug: {
        inspectedTaskIds: ["task-alpha"],
        matrix: { "user-alpha-executor": 1240 }
      },
      actorUserId: "user-alpha-admin",
      createdAt,
      expiresAt
    });

    const run = await planningRepository.findPlanningForecastRun(
      "tenant-alpha",
      projectId,
      "forecast-run-alpha"
    );
    const crossTenantRun = await planningRepository.findPlanningForecastRun(
      "tenant-beta",
      projectId,
      "forecast-run-alpha"
    );
    const crossProjectRun = await planningRepository.findPlanningForecastRun(
      "tenant-alpha",
      otherProjectId,
      "forecast-run-alpha"
    );

    expect(run).toMatchObject({
      id: "forecast-run-alpha",
      tenantId: "tenant-alpha",
      projectId,
      clientPlanVersion: 7,
      engineVersion: "forecast-engine-v1",
      health: "needs_decision",
      managerSummary: "Plan needs a manager decision before commit.",
      riskDrivers: [
        expect.objectContaining({
          code: "resource_overloaded",
          resourceIds: ["user-alpha-executor"]
        })
      ],
      recommendations: [
        expect.objectContaining({
          code: "add_resource",
          taskIds: ["task-alpha"]
        })
      ],
      engineMetadata: expect.objectContaining({
        planVersion: 7,
        solverProposalCount: 1
      }),
      engineDebug: {
        inspectedTaskIds: ["task-alpha"],
        matrix: { "user-alpha-executor": 1240 }
      },
      actorUserId: "user-alpha-admin"
    });
    expect(run?.createdAt).toEqual(createdAt);
    expect(run?.expiresAt).toEqual(expiresAt);
    expect(crossTenantRun).toBeUndefined();
    expect(crossProjectRun).toBeUndefined();
  });

  it("excludes archived tasks and their planning edges from PlanSnapshot", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.upsertTaskAssignment({
      id: "assignment-alpha",
      tenantId: "tenant-alpha",
      projectId,
      taskId: "task-alpha",
      resourceId: "user-alpha-executor",
      role: "executor",
      unitsPermille: 1000,
      workMinutes: 960,
      calendarId: null
    });
    await planningRepository.upsertTaskDependency({
      id: "dep-alpha-beta",
      tenantId: "tenant-alpha",
      projectId,
      predecessorTaskId: "task-alpha",
      successorTaskId: "task-beta",
      type: "FS",
      lagMinutes: 0
    });

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.delete_or_archive",
        payload: { taskId: "task-alpha", mode: "archive" }
      }
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(snapshot?.tasks.map((task) => task.id)).toEqual(["task-beta"]);
    expect(snapshot?.assignments.some((assignment) => assignment.taskId === "task-alpha")).toBe(false);
    expect(snapshot?.dependencies).toEqual([]);
  });

  it("keeps participant rows while sibling assignments with the same tuple remain", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "assignment.upsert",
        payload: {
          id: "assignment-alpha-primary",
          taskId: "task-alpha",
          resourceId: "user-alpha-executor",
          role: "executor",
          unitsPermille: 500,
          workMinutes: 480
        }
      }
    });
    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "assignment.upsert",
        payload: {
          id: "assignment-alpha-sibling",
          taskId: "task-alpha",
          resourceId: "user-alpha-executor",
          role: "executor",
          unitsPermille: 500,
          workMinutes: 480
        }
      }
    });

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "assignment.delete",
        payload: { assignmentId: "assignment-alpha-primary" }
      }
    });

    const participantRows = await db
      .select()
      .from(taskParticipants)
      .where(
        and(
          eq(taskParticipants.tenantId, "tenant-alpha"),
          eq(taskParticipants.taskId, "task-alpha"),
          eq(taskParticipants.userId, "user-alpha-executor"),
          eq(taskParticipants.role, "executor")
        )
      );

    expect(participantRows).toHaveLength(1);
  });

  it("omits participant fallback assignments whose generated id collides with explicit assignments", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "assignment.upsert",
        payload: {
          id: "task-beta-user-alpha-executor-executor",
          taskId: "task-alpha",
          resourceId: "user-alpha-admin",
          role: "executor",
          unitsPermille: 1000,
          workMinutes: null
        }
      }
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);
    const collidingAssignments = snapshot?.assignments.filter(
      (assignment) => assignment.id === "task-beta-user-alpha-executor-executor"
    );
    expect(collidingAssignments).toHaveLength(1);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "baseline.capture",
        payload: { baselineId: "baseline-collision", label: "Collision baseline" }
      }
    });

    const rows = await db
      .select()
      .from(projectBaselineAssignments)
      .where(eq(projectBaselineAssignments.baselineId, "baseline-collision"));
    expect(
      rows.filter((assignment) => assignment.assignmentId === "task-beta-user-alpha-executor-executor")
    ).toHaveLength(1);
  });

  it("excludes inactive users and their assignments from active planning resources", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.upsertTaskAssignment({
      id: "assignment-inactive-executor",
      tenantId: "tenant-alpha",
      projectId,
      taskId: "task-alpha",
      resourceId: "user-alpha-executor",
      role: "executor",
      unitsPermille: 1000,
      workMinutes: 960,
      calendarId: null
    });
    await client`
      UPDATE tenant_users
      SET status = 'inactive'
      WHERE tenant_id = 'tenant-alpha'
        AND id = 'user-alpha-executor'
    `;

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(snapshot?.resources.some((resource) => resource.id === "user-alpha-executor")).toBe(false);
    expect(snapshot?.assignments.some((assignment) => assignment.resourceId === "user-alpha-executor")).toBe(false);
  });

  it("uses a real project default calendar when only resource calendars exist", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);
    const now = new Date("2026-05-21T00:00:00.000Z");

    await db.insert(resourceCalendars).values({
      id: "calendar-resource-alpha",
      tenantId: "tenant-alpha",
      resourceId: "user-alpha-executor",
      workingWeekdays: [],
      workingMinutesPerDay: 0,
      createdAt: now,
      updatedAt: now
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(snapshot?.project.calendarId).toBe(`${projectId}-default-calendar`);
    expect(snapshot?.tasks.every((task) => task.calendarId === `${projectId}-default-calendar`)).toBe(true);
    expect(snapshot?.calendars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `${projectId}-default-calendar`,
          workingWeekdays: [1, 2, 3, 4, 5],
          workingMinutesPerDay: 480
        }),
        expect.objectContaining({
          id: "calendar-resource-alpha",
          workingWeekdays: [],
          workingMinutesPerDay: 0
        })
      ])
    );
    expect(
      snapshot?.resources.find((resource) => resource.id === "user-alpha-executor")?.calendarId
    ).toBe("calendar-resource-alpha");
  });

  it("scopes task mutation commands to the command project", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    await createActiveProjectWithTasks(intakeRepository, workRepository);
    await createActiveProjectWithTasks(intakeRepository, workRepository, {
      opportunityId: "opportunity-beta",
      projectId: "project-beta",
      taskAId: "task-beta-a",
      taskBId: "task-beta-b"
    });

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId: "project-beta",
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.update_identity",
        payload: {
          taskId: "task-alpha",
          title: "Не должно примениться к другому проекту"
        }
      }
    });

    const alphaSnapshot = await planningRepository.getPlanSnapshot("tenant-alpha", "project-alpha");
    const betaSnapshot = await planningRepository.getPlanSnapshot("tenant-alpha", "project-beta");

    expect(alphaSnapshot?.tasks.find((task) => task.id === "task-alpha")).toMatchObject({
      title: "Подготовить план внедрения"
    });
    expect(betaSnapshot?.tasks.map((task) => task.id)).toEqual(["task-beta-a", "task-beta-b"]);
  });

  it("reindexes WBS codes for every active project task when moving a task", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    for (let index = 3; index <= 12; index += 1) {
      await planningRepository.applyPlanningCommand({
        tenantId: "tenant-alpha",
        projectId,
        actorUserId: "user-alpha-admin",
        command: {
          type: "task.create",
          payload: {
            id: `task-extra-${index}`,
            projectId,
            title: `Дополнительная задача ${index}`,
            statusId: "task-status-new",
            plannedStart: "2026-06-10",
            plannedFinish: "2026-06-10",
            durationMinutes: 480,
            workMinutes: 480,
            assignments: []
          }
        }
      });
    }

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.move_wbs",
        payload: { taskId: "task-beta", parentTaskId: null, sortOrder: 10 }
      }
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(snapshot?.tasks.map((task) => ({ id: task.id, wbsCode: task.wbsCode }))).toEqual([
      { id: "task-alpha", wbsCode: "1" },
      { id: "task-extra-3", wbsCode: "2" },
      { id: "task-extra-4", wbsCode: "3" },
      { id: "task-extra-5", wbsCode: "4" },
      { id: "task-extra-6", wbsCode: "5" },
      { id: "task-extra-7", wbsCode: "6" },
      { id: "task-extra-8", wbsCode: "7" },
      { id: "task-extra-9", wbsCode: "8" },
      { id: "task-extra-10", wbsCode: "9" },
      { id: "task-extra-11", wbsCode: "10" },
      { id: "task-beta", wbsCode: "11" },
      { id: "task-extra-12", wbsCode: "12" }
    ]);
  });

  it("updates timestamps only for tasks whose WBS row changed", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    const beforeRows = await db
      .select({ id: tasks.id, updatedAt: tasks.updatedAt })
      .from(tasks)
      .where(and(eq(tasks.tenantId, "tenant-alpha"), eq(tasks.projectId, projectId)));
    const beforeUpdatedAt = new Map(beforeRows.map((task) => [task.id, task.updatedAt.getTime()]));
    await new Promise((resolve) => setTimeout(resolve, 5));

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.move_wbs",
        payload: { taskId: "task-beta", parentTaskId: null, sortOrder: 1 }
      }
    });

    const afterRows = await db
      .select({ id: tasks.id, updatedAt: tasks.updatedAt, wbsCode: tasks.wbsCode })
      .from(tasks)
      .where(and(eq(tasks.tenantId, "tenant-alpha"), eq(tasks.projectId, projectId)));
    const afterById = new Map(afterRows.map((task) => [task.id, task]));

    expect(afterById.get("task-alpha")?.wbsCode).toBe("1");
    expect(afterById.get("task-alpha")?.updatedAt.getTime()).toBe(beforeUpdatedAt.get("task-alpha"));
    expect(afterById.get("task-beta")?.wbsCode).toBe("2");
    expect(afterById.get("task-beta")?.updatedAt.getTime()).toBeGreaterThan(
      beforeUpdatedAt.get("task-beta") ?? 0
    );
  });

  it("preserves hierarchical WBS codes when creating and moving child tasks", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.create",
        payload: {
          id: "task-child",
          projectId,
          parentTaskId: "task-alpha",
          title: "Дочерняя задача",
          statusId: "task-status-new",
          plannedStart: "2026-06-10",
          plannedFinish: "2026-06-10",
          durationMinutes: 480,
          workMinutes: 480,
          assignments: []
        }
      }
    });
    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.move_wbs",
        payload: { taskId: "task-beta", parentTaskId: "task-alpha", sortOrder: 0 }
      }
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(
      snapshot?.tasks.map((task) => ({
        id: task.id,
        parentTaskId: task.parentTaskId,
        wbsCode: task.wbsCode
      }))
    ).toEqual([
      { id: "task-alpha", parentTaskId: null, wbsCode: "1" },
      { id: "task-beta", parentTaskId: "task-alpha", wbsCode: "1.1" },
      { id: "task-child", parentTaskId: "task-alpha", wbsCode: "1.2" }
    ]);
  });

  it("rejects task.create with a missing parent before persisting orphan hierarchy rows", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await expect(
      planningRepository.applyPlanningCommand({
        tenantId: "tenant-alpha",
        projectId,
        actorUserId: "user-alpha-admin",
        command: {
          type: "task.create",
          payload: {
            id: "task-orphan",
            projectId,
            parentTaskId: "task-missing",
            title: "Сиротская задача",
            statusId: "task-status-new",
            plannedStart: "2026-06-10",
            plannedFinish: "2026-06-10",
            durationMinutes: 480,
            workMinutes: 480,
            assignments: []
          }
        }
      })
    ).rejects.toThrow("parent_task_not_found");

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);
    expect(snapshot?.tasks.map((task) => task.id)).toEqual(["task-alpha", "task-beta"]);
  });

  it("preserves requested duration when applying task.create planning commands", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.create",
        payload: {
          id: "task-long-light",
          projectId,
          title: "Длинная задача с малой трудоемкостью",
          statusId: "task-status-new",
          plannedStart: "2026-06-10",
          plannedFinish: "2026-06-13",
          durationMinutes: 1920,
          workMinutes: 480,
          assignments: []
        }
      }
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(snapshot?.tasks.find((task) => task.id === "task-long-light")).toMatchObject({
      durationMinutes: 1920,
      workMinutes: 480
    });
  });

  it("preserves zero work when updating task work model", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.update_work_model",
        payload: {
          taskId: "task-alpha",
          taskType: "fixed_work",
          effortDriven: false,
          durationMinutes: 480,
          workMinutes: 0
        }
      }
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);
    expect(snapshot?.tasks.find((task) => task.id === "task-alpha")).toMatchObject({
      durationMinutes: 480,
      workMinutes: 0
    });

    const [storedTask] = await db
      .select({ plannedWork: tasks.plannedWork, workMinutes: tasks.workMinutes })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, "tenant-alpha"),
          eq(tasks.projectId, projectId),
          eq(tasks.id, "task-alpha")
        )
      )
      .limit(1);

    expect(storedTask).toEqual({ plannedWork: 0, workMinutes: 0 });
  });

  it("generates new WBS codes from active project tasks only", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.delete_or_archive",
        payload: { taskId: "task-beta", mode: "archive" }
      }
    });
    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.create",
        payload: {
          id: "task-after-archive",
          projectId,
          title: "Задача после архивации",
          statusId: "task-status-new",
          plannedStart: "2026-06-10",
          plannedFinish: "2026-06-10",
          durationMinutes: 480,
          workMinutes: 480,
          assignments: []
        }
      }
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(snapshot?.tasks.map((task) => ({ id: task.id, wbsCode: task.wbsCode }))).toEqual([
      { id: "task-alpha", wbsCode: "1" },
      { id: "task-after-archive", wbsCode: "2" }
    ]);
  });

  it("does not reuse an active WBS code after archiving a middle task", async () => {
    const db = createDatabase(client);
    const intakeRepository = createProjectIntakeRepository(db);
    const workRepository = createProjectWorkRepository(db);
    const planningRepository = createPlanningRepository(db);
    const projectId = await createActiveProjectWithTasks(intakeRepository, workRepository);

    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.create",
        payload: {
          id: "task-third",
          projectId,
          title: "Третья задача",
          statusId: "task-status-new",
          plannedStart: "2026-06-10",
          plannedFinish: "2026-06-10",
          durationMinutes: 480,
          workMinutes: 480,
          assignments: []
        }
      }
    });
    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.move_wbs",
        payload: { taskId: "task-beta", parentTaskId: null, sortOrder: 1 }
      }
    });
    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.delete_or_archive",
        payload: { taskId: "task-beta", mode: "archive" }
      }
    });
    await planningRepository.applyPlanningCommand({
      tenantId: "tenant-alpha",
      projectId,
      actorUserId: "user-alpha-admin",
      command: {
        type: "task.create",
        payload: {
          id: "task-after-middle-archive",
          projectId,
          title: "Задача после архивации середины",
          statusId: "task-status-new",
          plannedStart: "2026-06-10",
          plannedFinish: "2026-06-10",
          durationMinutes: 480,
          workMinutes: 480,
          assignments: []
        }
      }
    });

    const snapshot = await planningRepository.getPlanSnapshot("tenant-alpha", projectId);

    expect(snapshot?.tasks.map((task) => ({ id: task.id, wbsCode: task.wbsCode }))).toEqual([
      { id: "task-alpha", wbsCode: "1" },
      { id: "task-third", wbsCode: "3" },
      { id: "task-after-middle-archive", wbsCode: "4" }
    ]);
  });
});

async function createActiveProjectWithTasks(
  intakeRepository: ReturnType<typeof createProjectIntakeRepository>,
  workRepository: ReturnType<typeof createProjectWorkRepository>,
  overrides: {
    opportunityId?: string;
    projectId?: string;
    taskAId?: string;
    taskBId?: string;
  } = {}
) {
  const opportunityId = overrides.opportunityId ?? "opportunity-alpha";
  const projectId = overrides.projectId ?? "project-alpha";
  const opportunity = await intakeRepository.createOpportunity({
    id: opportunityId,
    tenantId: "tenant-alpha",
    clientId: "client-romashka",
    primaryContactId: null,
    projectTypeId: "project-type-implementation",
    stageId: null,
    clientName: "ООО Ромашка",
    contactName: "Ирина Клиент",
    title: `Внедрение ${projectId}`,
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
    id: projectId,
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
    id: overrides.taskAId ?? "task-alpha",
    tenantId: "tenant-alpha",
    projectId,
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
  await workRepository.createTask({
    id: overrides.taskBId ?? "task-beta",
    tenantId: "tenant-alpha",
    projectId,
    stageId: null,
    title: "Провести kickoff",
    description: null,
    status: "new",
    statusId: "task-status-new",
    statusName: "Новая",
    statusCategory: "new",
    priority: "normal",
    requesterUserId: "user-alpha-admin",
    ownerUserId: "user-alpha-executor",
    plannedStart: new Date("2026-06-08T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-09T00:00:00.000Z"),
    durationWorkingDays: 2,
    plannedWork: 8,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: false,
    source: "manual",
    participants: [
      { userId: "user-alpha-admin", role: "requester" },
      { userId: "user-alpha-executor", role: "executor" }
    ]
  });

  return projectId;
}
