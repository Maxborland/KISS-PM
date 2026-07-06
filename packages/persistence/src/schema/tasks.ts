import {
  boolean,
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

export const taskStatuses = pgTable(
  "task_statuses",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull().default("active"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "task_statuses_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("task_statuses_tenant_id_idx").on(table.tenantId),
    uniqueIndex("task_statuses_tenant_sort_order_uidx").on(
      table.tenantId,
      table.sortOrder
    ),
    uniqueIndex("task_statuses_tenant_name_uidx").on(table.tenantId, table.name),
    check(
      "task_statuses_category_chk",
      sql`${table.category} in ('new', 'waiting', 'in_progress', 'review', 'done')`
    ),
    check(
      "task_statuses_status_chk",
      sql`${table.status} in ('active', 'archived')`
    )
  ]
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    stageId: text("stage_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("new"),
    statusId: text("status_id").notNull().default("task-status-new"),
    priority: text("priority").notNull().default("normal"),
    requesterUserId: text("requester_user_id").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    plannedStart: timestamp("planned_start", { withTimezone: true }).notNull(),
    plannedFinish: timestamp("planned_finish", { withTimezone: true }).notNull(),
    plannedStartMinute: integer("planned_start_minute").notNull().default(0),
    plannedFinishMinute: integer("planned_finish_minute").notNull().default(0),
    parentTaskId: text("parent_task_id"),
    wbsCode: text("wbs_code").notNull().default("1"),
    schedulingMode: text("scheduling_mode").notNull().default("auto"),
    taskType: text("task_type").notNull().default("fixed_units"),
    effortDriven: boolean("effort_driven").notNull().default(false),
    durationMinutes: integer("duration_minutes"),
    workMinutes: integer("work_minutes"),
    constraintType: text("constraint_type"),
    constraintDate: timestamp("constraint_date", { withTimezone: true }),
    durationWorkingDays: integer("duration_working_days").notNull().default(1),
    plannedWork: integer("planned_work").notNull(),
    actualWork: integer("actual_work").notNull().default(0),
    progress: integer("progress").notNull().default(0),
    requiresAcceptance: boolean("requires_acceptance").notNull().default(false),
    source: text("source").notNull().default("manual"),
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "tasks_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "tasks_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "tasks_status_fk",
      columns: [table.tenantId, table.statusId],
      foreignColumns: [taskStatuses.tenantId, taskStatuses.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "tasks_requester_user_fk",
      columns: [table.tenantId, table.requesterUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "tasks_owner_user_fk",
      columns: [table.tenantId, table.ownerUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    uniqueIndex("tasks_tenant_project_id_id_uidx").on(
      table.tenantId,
      table.projectId,
      table.id
    ),
    index("tasks_tenant_project_id_idx").on(table.tenantId, table.projectId),
    index("tasks_tenant_status_idx").on(table.tenantId, table.status),
    index("tasks_tenant_status_id_idx").on(table.tenantId, table.statusId),
    index("tasks_tenant_owner_idx").on(table.tenantId, table.ownerUserId),
    check("tasks_scheduling_mode_chk", sql`${table.schedulingMode} in ('auto', 'manual')`),
    check(
      "tasks_task_type_chk",
      sql`${table.taskType} in ('fixed_units', 'fixed_work', 'fixed_duration')`
    ),
    check(
      "tasks_constraint_type_chk",
      sql`${table.constraintType} is null or ${table.constraintType} in (
        'as_soon_as_possible',
        'start_no_earlier_than',
        'finish_no_later_than',
        'must_start_on',
        'must_finish_on'
      )`
    )
  ]
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    predecessorTaskId: text("predecessor_task_id").notNull(),
    successorTaskId: text("successor_task_id").notNull(),
    type: text("type").notNull(),
    lagMinutes: integer("lag_minutes").notNull().default(0)
  },
  (table) => [
    primaryKey({
      name: "task_dependencies_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "task_dependencies_predecessor_fk",
      columns: [table.tenantId, table.projectId, table.predecessorTaskId],
      foreignColumns: [tasks.tenantId, tasks.projectId, tasks.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "task_dependencies_successor_fk",
      columns: [table.tenantId, table.projectId, table.successorTaskId],
      foreignColumns: [tasks.tenantId, tasks.projectId, tasks.id]
    }).onDelete("cascade"),
    index("task_dependencies_tenant_project_successor_idx").on(
      table.tenantId,
      table.projectId,
      table.successorTaskId
    ),
    check("task_dependencies_type_chk", sql`${table.type} in ('FS', 'SS', 'FF', 'SF')`),
    check(
      "task_dependencies_not_self_chk",
      sql`${table.predecessorTaskId} <> ${table.successorTaskId}`
    )
  ]
);

export const taskParticipants = pgTable(
  "task_participants",
  {
    tenantId: text("tenant_id").notNull(),
    taskId: text("task_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull()
  },
  (table) => [
    primaryKey({
      name: "task_participants_pkey",
      columns: [table.tenantId, table.taskId, table.userId, table.role]
    }),
    foreignKey({
      name: "task_participants_task_fk",
      columns: [table.tenantId, table.taskId],
      foreignColumns: [tasks.tenantId, tasks.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "task_participants_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("task_participants_tenant_user_id_idx").on(table.tenantId, table.userId)
  ]
);

export const taskActivities = pgTable(
  "task_activities",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    taskId: text("task_id").notNull(),
    type: text("type").notNull(),
    body: text("body"),
    title: text("title"),
    fileUrl: text("file_url"),
    fileSizeBytes: integer("file_size_bytes"),
    mimeType: text("mime_type"),
    authorUserId: text("author_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "task_activities_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "task_activities_task_fk",
      columns: [table.tenantId, table.taskId],
      foreignColumns: [tasks.tenantId, tasks.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "task_activities_author_user_fk",
      columns: [table.tenantId, table.authorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("task_activities_tenant_task_created_idx").on(
      table.tenantId,
      table.taskId,
      table.createdAt
    ),
    check("task_activities_type_chk", sql`${table.type} in ('comment', 'file', 'system')`),
    check(
      "task_activities_payload_chk",
      sql`(
        (${table.type} = 'comment' and ${table.body} is not null)
        or
        (${table.type} = 'file' and ${table.title} is not null and ${table.fileUrl} is not null)
        or
        (${table.type} = 'system' and ${table.title} is not null and ${table.body} is not null)
      )`
    )
  ]
);
