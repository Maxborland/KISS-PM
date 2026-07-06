import {
  foreignKey,
  index,
  integer,
  jsonb,
  check,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantUsers, tenants } from "./core";
import { projects } from "./projects";
import { tasks } from "./tasks";

export const planVersions = pgTable(
  "plan_versions",
  {
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "plan_versions_pkey",
      columns: [table.tenantId, table.projectId]
    }),
    foreignKey({
      name: "plan_versions_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    check("plan_versions_version_chk", sql`${table.version} > 0`)
  ]
);

export const projectCalendars = pgTable(
  "project_calendars",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    workingWeekdays: jsonb("working_weekdays").$type<number[]>().notNull(),
    workingMinutesPerDay: integer("working_minutes_per_day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "project_calendars_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "project_calendars_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    uniqueIndex("project_calendars_tenant_id_id_uidx").on(table.tenantId, table.id),
    check("project_calendars_minutes_chk", sql`${table.workingMinutesPerDay} >= 0`)
  ]
);

export const resourceCalendars = pgTable(
  "resource_calendars",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    resourceId: text("resource_id").notNull(),
    workingWeekdays: jsonb("working_weekdays").$type<number[]>().notNull(),
    workingMinutesPerDay: integer("working_minutes_per_day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "resource_calendars_pkey",
      columns: [table.tenantId, table.resourceId, table.id]
    }),
    foreignKey({
      name: "resource_calendars_resource_fk",
      columns: [table.tenantId, table.resourceId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    uniqueIndex("resource_calendars_tenant_id_id_uidx").on(table.tenantId, table.id),
    check("resource_calendars_minutes_chk", sql`${table.workingMinutesPerDay} >= 0`)
  ]
);

export const calendarExceptions = pgTable(
  "calendar_exceptions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    calendarId: text("calendar_id").notNull(),
    resourceId: text("resource_id"),
    date: text("date").notNull(),
    workingMinutes: integer("working_minutes").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "calendar_exceptions_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "calendar_exceptions_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    index("calendar_exceptions_tenant_calendar_date_idx").on(
      table.tenantId,
      table.calendarId,
      table.date
    ),
    check("calendar_exceptions_minutes_chk", sql`${table.workingMinutes} >= 0`)
  ]
);

// BUG-PROJ-19: принятые перегрузы ресурса (risk.accept_overload). PK = ресурс+день;
// хранение делает принятие персистентным (раньше команда была no-op).

export const planAcceptedOverloads = pgTable(
  "plan_accepted_overloads",
  {
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    resourceId: text("resource_id").notNull(),
    date: text("date").notNull(),
    reason: text("reason"),
    acceptedByUserId: text("accepted_by_user_id"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({
      name: "plan_accepted_overloads_pkey",
      columns: [table.tenantId, table.projectId, table.resourceId, table.date]
    }),
    foreignKey({
      name: "plan_accepted_overloads_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade")
  ]
);

export const tenantProductionCalendars = pgTable(
  "tenant_production_calendars",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id").notNull().default("tenant-default"),
    workingWeekdays: jsonb("working_weekdays").$type<number[]>().notNull(),
    workingMinutesPerDay: integer("working_minutes_per_day").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "tenant_production_calendars_pkey",
      columns: [table.tenantId]
    }),
    check(
      "tenant_production_calendars_minutes_chk",
      sql`${table.workingMinutesPerDay} >= 0`
    )
  ]
);

export const tenantProductionCalendarExceptions = pgTable(
  "tenant_production_calendar_exceptions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id").notNull().default("tenant-default"),
    resourceId: text("resource_id"),
    date: text("date").notNull(),
    workingMinutes: integer("working_minutes").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "tenant_production_calendar_exceptions_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("tenant_production_calendar_exceptions_date_idx").on(table.tenantId, table.date),
    check(
      "tenant_production_calendar_exceptions_minutes_chk",
      sql`${table.workingMinutes} >= 0`
    )
  ]
);

export const planningSavedViews = pgTable(
  "planning_saved_views",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    scope: text("scope").notNull().default("user"),
    name: text("name").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "planning_saved_views_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "planning_saved_views_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    index("planning_saved_views_owner_idx").on(
      table.tenantId,
      table.projectId,
      table.ownerUserId
    ),
    check("planning_saved_views_scope_chk", sql`${table.scope} in ('user', 'project')`)
  ]
);

export const resourceAbsences = pgTable(
  "resource_absences",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    dateFrom: text("date_from").notNull(),
    dateTo: text("date_to").notNull(),
    status: text("status").notNull().default("approved"),
    reason: text("reason"),
    createdBy: text("created_by"),
    approvedBy: text("approved_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    foreignKey({
      name: "resource_absences_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    index("resource_absences_tenant_user_from_idx").on(
      table.tenantId,
      table.userId,
      table.dateFrom
    ),
    check(
      "resource_absences_type_chk",
      sql`${table.type} in ('vacation', 'admin_leave', 'sick_leave', 'maternity_leave', 'truancy')`
    ),
    check(
      "resource_absences_status_chk",
      sql`${table.status} in ('approved', 'pending', 'rejected')`
    ),
    check("resource_absences_date_range_chk", sql`${table.dateTo} >= ${table.dateFrom}`)
  ]
);

export const resourcePersonalCalendars = pgTable(
  "resource_personal_calendars",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    sourceProvider: text("source_provider").notNull(),
    syncStatus: text("sync_status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "resource_personal_calendars_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "resource_personal_calendars_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "resource_personal_calendars_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("resource_personal_calendars_tenant_user_idx").on(table.tenantId, table.userId),
    uniqueIndex("resource_personal_calendars_tenant_user_provider_uidx")
      .on(table.tenantId, table.userId, table.sourceProvider)
      .where(sql`${table.archivedAt} is null`),
    check(
      "resource_personal_calendars_provider_chk",
      sql`${table.sourceProvider} in ('manual', 'google', 'microsoft', 'caldav')`
    ),
    check(
      "resource_personal_calendars_sync_status_chk",
      sql`${table.syncStatus} in ('manual', 'connected', 'sync_failed', 'disabled')`
    )
  ]
);

export const resourceCalendarEvents = pgTable(
  "resource_calendar_events",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id").notNull(),
    userId: text("user_id").notNull(),
    sourceProvider: text("source_provider").notNull(),
    externalId: text("external_id"),
    title: text("title"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    finishesAt: timestamp("finishes_at", { withTimezone: true }).notNull(),
    workMinutes: integer("work_minutes"),
    capacityImpact: text("capacity_impact").notNull(),
    visibility: text("visibility").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "resource_calendar_events_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "resource_calendar_events_calendar_fk",
      columns: [table.tenantId, table.calendarId],
      foreignColumns: [resourcePersonalCalendars.tenantId, resourcePersonalCalendars.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "resource_calendar_events_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "resource_calendar_events_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("resource_calendar_events_tenant_user_start_idx").on(
      table.tenantId,
      table.userId,
      table.startsAt
    ),
    uniqueIndex("resource_calendar_events_external_uidx")
      .on(table.tenantId, table.calendarId, table.sourceProvider, table.externalId)
      .where(sql`${table.externalId} is not null and ${table.archivedAt} is null`),
    check(
      "resource_calendar_events_provider_chk",
      sql`${table.sourceProvider} in ('manual', 'google', 'microsoft', 'caldav')`
    ),
    check(
      "resource_calendar_events_capacity_impact_chk",
      sql`${table.capacityImpact} in ('busy', 'unavailable', 'tentative')`
    ),
    check(
      "resource_calendar_events_visibility_chk",
      sql`${table.visibility} in ('public', 'busy_only', 'private')`
    ),
    check("resource_calendar_events_time_range_chk", sql`${table.finishesAt} > ${table.startsAt}`),
    check(
      "resource_calendar_events_work_minutes_chk",
      sql`${table.workMinutes} is null or ${table.workMinutes} >= 0`
    )
  ]
);

export const taskAssignments = pgTable(
  "task_assignments",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    taskId: text("task_id").notNull(),
    resourceId: text("resource_id").notNull(),
    role: text("role").notNull(),
    unitsPermille: integer("units_permille").notNull(),
    workMinutes: integer("work_minutes"),
    calendarId: text("calendar_id")
  },
  (table) => [
    primaryKey({
      name: "task_assignments_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "task_assignments_task_fk",
      columns: [table.tenantId, table.projectId, table.taskId],
      foreignColumns: [tasks.tenantId, tasks.projectId, tasks.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "task_assignments_resource_fk",
      columns: [table.tenantId, table.resourceId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("task_assignments_tenant_project_task_idx").on(
      table.tenantId,
      table.projectId,
      table.taskId
    ),
    check(
      "task_assignments_role_chk",
      sql`${table.role} in ('executor', 'co_executor', 'controller', 'approver', 'observer')`
    ),
    check("task_assignments_units_chk", sql`${table.unitsPermille} > 0`)
  ]
);

export const taskAssignmentAllocations = pgTable(
  "task_assignment_allocations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    assignmentId: text("assignment_id").notNull(),
    taskId: text("task_id").notNull(),
    resourceId: text("resource_id").notNull(),
    date: text("date").notNull(),
    workMinutes: integer("work_minutes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "task_assignment_allocations_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "task_assignment_allocations_assignment_fk",
      columns: [table.tenantId, table.projectId, table.assignmentId],
      foreignColumns: [taskAssignments.tenantId, taskAssignments.projectId, taskAssignments.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "task_assignment_allocations_task_fk",
      columns: [table.tenantId, table.projectId, table.taskId],
      foreignColumns: [tasks.tenantId, tasks.projectId, tasks.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "task_assignment_allocations_resource_fk",
      columns: [table.tenantId, table.resourceId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    uniqueIndex("task_assignment_allocations_assignment_date_uidx").on(
      table.tenantId,
      table.projectId,
      table.assignmentId,
      table.date
    ),
    index("task_assignment_allocations_resource_date_idx").on(
      table.tenantId,
      table.resourceId,
      table.date
    ),
    check("task_assignment_allocations_work_chk", sql`${table.workMinutes} >= 0`)
  ]
);

export const projectBaselines = pgTable(
  "project_baselines",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    label: text("label").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "project_baselines_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "project_baselines_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade")
  ]
);

export const projectBaselineTasks = pgTable(
  "project_baseline_tasks",
  {
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    baselineId: text("baseline_id").notNull(),
    taskId: text("task_id").notNull(),
    plannedStart: text("planned_start"),
    plannedFinish: text("planned_finish"),
    workMinutes: integer("work_minutes").notNull()
  },
  (table) => [
    primaryKey({
      name: "project_baseline_tasks_pkey",
      columns: [table.tenantId, table.projectId, table.baselineId, table.taskId]
    }),
    foreignKey({
      name: "project_baseline_tasks_baseline_fk",
      columns: [table.tenantId, table.projectId, table.baselineId],
      foreignColumns: [
        projectBaselines.tenantId,
        projectBaselines.projectId,
        projectBaselines.id
      ]
    }).onDelete("cascade")
  ]
);

export const projectBaselineAssignments = pgTable(
  "project_baseline_assignments",
  {
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    baselineId: text("baseline_id").notNull(),
    assignmentId: text("assignment_id").notNull(),
    taskId: text("task_id").notNull(),
    resourceId: text("resource_id").notNull(),
    workMinutes: integer("work_minutes")
  },
  (table) => [
    primaryKey({
      name: "project_baseline_assignments_pkey",
      columns: [table.tenantId, table.projectId, table.baselineId, table.assignmentId]
    }),
    foreignKey({
      name: "project_baseline_assignments_baseline_fk",
      columns: [table.tenantId, table.projectId, table.baselineId],
      foreignColumns: [
        projectBaselines.tenantId,
        projectBaselines.projectId,
        projectBaselines.id
      ]
    }).onDelete("cascade")
  ]
);

export const resourceReservations = pgTable(
  "resource_reservations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    resourceId: text("resource_id").notNull(),
    start: text("start").notNull(),
    finish: text("finish").notNull(),
    workMinutes: integer("work_minutes").notNull(),
    reason: text("reason")
  },
  (table) => [
    primaryKey({
      name: "resource_reservations_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "resource_reservations_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "resource_reservations_resource_fk",
      columns: [table.tenantId, table.resourceId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    check("resource_reservations_work_chk", sql`${table.workMinutes} >= 0`)
  ]
);

export const planningScenarioRuns = pgTable(
  "planning_scenario_runs",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    planVersion: integer("plan_version").notNull(),
    engineVersion: text("engine_version").notNull(),
    targetConflict: jsonb("target_conflict").$type<Record<string, unknown>>().notNull(),
    proposalPayload: jsonb("proposal_payload").$type<Record<string, unknown>>().notNull(),
    proposalPayloadHash: text("proposal_payload_hash").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "planning_scenario_runs_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "planning_scenario_runs_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "planning_scenario_runs_actor_fk",
      columns: [table.tenantId, table.actorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("planning_scenario_runs_tenant_project_expires_idx").on(
      table.tenantId,
      table.projectId,
      table.expiresAt
    )
  ]
);

export const planningSolverRuns = pgTable(
  "planning_solver_runs",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    mode: text("mode").notNull(),
    clientPlanVersion: integer("client_plan_version").notNull(),
    engineVersion: text("engine_version").notNull(),
    inputSnapshotMetadata: jsonb("input_snapshot_metadata").$type<Record<string, unknown>>().notNull(),
    targetDeadline: text("target_deadline"),
    proposals: jsonb("proposals").$type<Record<string, unknown>[]>().notNull(),
    proposalPayloadHash: text("proposal_payload_hash").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    appliedProposalId: text("applied_proposal_id"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "planning_solver_runs_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "planning_solver_runs_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "planning_solver_runs_actor_fk",
      columns: [table.tenantId, table.actorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("planning_solver_runs_tenant_project_expires_idx").on(
      table.tenantId,
      table.projectId,
      table.expiresAt
    ),
    check("planning_solver_runs_mode_chk", sql`${table.mode} in ('schedule', 'repair')`),
    check("planning_solver_runs_client_plan_version_chk", sql`${table.clientPlanVersion} > 0`)
  ]
);

export const planningCommandIdempotencyKeys = pgTable(
  "planning_command_idempotency_keys",
  {
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    responsePayload: jsonb("response_payload").$type<Record<string, unknown>>().notNull(),
    actorUserId: text("actor_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "planning_command_idempotency_keys_pkey",
      columns: [table.tenantId, table.projectId, table.idempotencyKey]
    }),
    foreignKey({
      name: "planning_command_idempotency_keys_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "planning_command_idempotency_keys_actor_fk",
      columns: [table.tenantId, table.actorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("planning_command_idempotency_keys_tenant_project_created_idx").on(
      table.tenantId,
      table.projectId,
      table.createdAt
    )
  ]
);
