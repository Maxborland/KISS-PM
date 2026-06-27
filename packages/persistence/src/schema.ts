import {
  bigint,
  boolean,
  doublePrecision,
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

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const accessProfiles = pgTable(
  "access_profiles",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    permissions: jsonb("permissions").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "access_profiles_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("access_profiles_tenant_id_idx").on(table.tenantId)
  ]
);

export const positions = pgTable(
  "positions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    index("positions_tenant_id_idx").on(table.tenantId),
    uniqueIndex("positions_tenant_id_id_uidx").on(table.tenantId, table.id),
    uniqueIndex("positions_tenant_id_name_uidx").on(table.tenantId, table.name)
  ]
);

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    systemKey: text("system_key").notNull(),
    tenantLabel: text("tenant_label").notNull(),
    targetEntity: text("target_entity").notNull(),
    fieldType: text("field_type").notNull(),
    required: boolean("required").notNull().default(false),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "custom_field_definitions_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("custom_field_definitions_tenant_id_idx").on(table.tenantId),
    uniqueIndex("custom_field_definitions_tenant_id_system_key_uidx").on(
      table.tenantId,
      table.systemKey
    )
  ]
);

export const projectTemplates = pgTable(
  "project_templates",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    systemKey: text("system_key").notNull(),
    tenantLabel: text("tenant_label").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "project_templates_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("project_templates_tenant_id_idx").on(table.tenantId),
    uniqueIndex("project_templates_tenant_id_system_key_uidx").on(
      table.tenantId,
      table.systemKey
    )
  ]
);

export const clients = pgTable(
  "clients",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "clients_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("clients_tenant_id_idx").on(table.tenantId),
    uniqueIndex("clients_tenant_id_name_uidx").on(table.tenantId, table.name)
  ]
);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    telegram: text("telegram"),
    role: text("role"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "contacts_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "contacts_client_fk",
      columns: [table.tenantId, table.clientId],
      foreignColumns: [clients.tenantId, clients.id]
    }).onDelete("cascade"),
    index("contacts_tenant_id_idx").on(table.tenantId),
    index("contacts_tenant_client_id_idx").on(table.tenantId, table.clientId),
    uniqueIndex("contacts_tenant_id_client_id_id_uidx").on(
      table.tenantId,
      table.clientId,
      table.id
    )
  ]
);

export const products = pgTable(
  "products",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    type: text("type").notNull(),
    unit: text("unit").notNull(),
    price: integer("price").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "products_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("products_tenant_id_idx").on(table.tenantId),
    uniqueIndex("products_tenant_id_name_uidx").on(table.tenantId, table.name),
    uniqueIndex("products_tenant_id_sku_uidx").on(table.tenantId, table.sku),
    check("products_type_chk", sql`${table.type} in ('service', 'goods')`),
    check("products_price_chk", sql`${table.price} > 0`)
  ]
);

export const projectTypes = pgTable(
  "project_types",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "project_types_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("project_types_tenant_id_idx").on(table.tenantId),
    uniqueIndex("project_types_tenant_id_name_uidx").on(table.tenantId, table.name)
  ]
);

export const dealStages = pgTable(
  "deal_stages",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "deal_stages_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("deal_stages_tenant_id_idx").on(table.tenantId),
    uniqueIndex("deal_stages_tenant_id_sort_order_uidx").on(
      table.tenantId,
      table.sortOrder
    ),
    uniqueIndex("deal_stages_tenant_id_name_uidx").on(table.tenantId, table.name)
  ]
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: text("client_id"),
    primaryContactId: text("primary_contact_id"),
    ownerUserId: text("owner_user_id"),
    projectTypeId: text("project_type_id"),
    stageId: text("stage_id"),
    clientName: text("client_name").notNull(),
    contactName: text("contact_name").notNull(),
    title: text("title").notNull(),
    projectType: text("project_type").notNull(),
    description: text("description"),
    plannedStart: timestamp("planned_start", { withTimezone: true }).notNull(),
    plannedFinish: timestamp("planned_finish", { withTimezone: true }).notNull(),
    contractValue: integer("contract_value").notNull(),
    plannedHourlyRate: integer("planned_hourly_rate").notNull(),
    plannedHours: integer("planned_hours").notNull(),
    probability: integer("probability").notNull(),
    status: text("status").notNull(),
    templateId: text("template_id"),
    feasibilityStatus: text("feasibility_status"),
    feasibilityResult: jsonb("feasibility_result").$type<Record<string, unknown> | null>(),
    feasibilityCheckedAt: timestamp("feasibility_checked_at", { withTimezone: true }),
    customFieldValues: jsonb("custom_field_values")
      .$type<Record<string, string>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "opportunities_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "opportunities_client_fk",
      columns: [table.tenantId, table.clientId],
      foreignColumns: [clients.tenantId, clients.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "opportunities_primary_contact_client_fk",
      columns: [table.tenantId, table.clientId, table.primaryContactId],
      foreignColumns: [contacts.tenantId, contacts.clientId, contacts.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "opportunities_project_type_fk",
      columns: [table.tenantId, table.projectTypeId],
      foreignColumns: [projectTypes.tenantId, projectTypes.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "opportunities_stage_fk",
      columns: [table.tenantId, table.stageId],
      foreignColumns: [dealStages.tenantId, dealStages.id]
    }).onDelete("restrict"),
    index("opportunities_tenant_id_idx").on(table.tenantId),
    index("opportunities_status_idx").on(table.status),
    index("opportunities_owner_user_id_idx").on(table.tenantId, table.ownerUserId),
    index("opportunities_stage_id_idx").on(table.tenantId, table.stageId)
  ]
);

export const opportunityDemands = pgTable(
  "opportunity_demands",
  {
    tenantId: text("tenant_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    positionId: text("position_id").notNull(),
    requiredHours: integer("required_hours").notNull()
  },
  (table) => [
    primaryKey({
      name: "opportunity_demands_pkey",
      columns: [table.tenantId, table.opportunityId, table.positionId]
    }),
    foreignKey({
      name: "opportunity_demands_opportunity_fk",
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [opportunities.tenantId, opportunities.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "opportunity_demands_position_fk",
      columns: [table.tenantId, table.positionId],
      foreignColumns: [positions.tenantId, positions.id]
    }).onDelete("restrict"),
    index("opportunity_demands_tenant_id_idx").on(table.tenantId)
  ]
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull().default("opportunity"),
    sourceOpportunityId: text("source_opportunity_id"),
    clientId: text("client_id"),
    projectTypeId: text("project_type_id"),
    title: text("title").notNull(),
    clientName: text("client_name").notNull(),
    status: text("status").notNull(),
    plannedStart: timestamp("planned_start", { withTimezone: true }).notNull(),
    plannedFinish: timestamp("planned_finish", { withTimezone: true }).notNull(),
    deadline: timestamp("deadline", { withTimezone: true }),
    calendarId: text("calendar_id"),
    contractValue: integer("contract_value").notNull(),
    plannedHours: integer("planned_hours").notNull(),
    templateId: text("template_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "projects_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "projects_source_opportunity_fk",
      columns: [table.tenantId, table.sourceOpportunityId],
      foreignColumns: [opportunities.tenantId, opportunities.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "projects_client_fk",
      columns: [table.tenantId, table.clientId],
      foreignColumns: [clients.tenantId, clients.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "projects_project_type_fk",
      columns: [table.tenantId, table.projectTypeId],
      foreignColumns: [projectTypes.tenantId, projectTypes.id]
    }).onDelete("restrict"),
    uniqueIndex("projects_tenant_source_opportunity_uidx").on(
      table.tenantId,
      table.sourceOpportunityId
    ),
    uniqueIndex("projects_tenant_workspace_inbox_uidx")
      .on(table.tenantId, table.sourceType)
      .where(
        sql`${table.sourceType} = 'workspace_inbox' and ${table.status} in ('draft', 'active', 'paused')`
      ),
    index("projects_tenant_id_idx").on(table.tenantId),
    index("projects_status_idx").on(table.status),
    check(
      "projects_source_type_chk",
      sql`${table.sourceType} in ('opportunity', 'workspace_inbox', 'manual')`
    ),
    check(
      "projects_source_opportunity_chk",
      sql`(
        (${table.sourceType} = 'opportunity' and ${table.sourceOpportunityId} is not null)
        or
        (${table.sourceType} <> 'opportunity' and ${table.sourceOpportunityId} is null)
      )`
    )
  ]
);

export const projectPositionDemands = pgTable(
  "project_position_demands",
  {
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    positionId: text("position_id").notNull(),
    requiredHours: integer("required_hours").notNull()
  },
  (table) => [
    primaryKey({
      name: "project_position_demands_pkey",
      columns: [table.tenantId, table.projectId, table.positionId]
    }),
    foreignKey({
      name: "project_position_demands_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "project_position_demands_position_fk",
      columns: [table.tenantId, table.positionId],
      foreignColumns: [positions.tenantId, positions.id]
    }).onDelete("restrict"),
    index("project_position_demands_tenant_id_idx").on(table.tenantId)
  ]
);

export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    accessProfileId: text("access_profile_id").notNull(),
    positionId: text("position_id"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    telegram: text("telegram"),
    status: text("status").notNull().default("active"),
    theme: text("theme").notNull().default("light"),
    accentColor: text("accent_color").notNull().default("#0f766e"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    index("tenant_users_tenant_id_idx").on(table.tenantId),
    uniqueIndex("tenant_users_tenant_id_id_uidx").on(table.tenantId, table.id),
    uniqueIndex("tenant_users_tenant_id_email_uidx").on(table.tenantId, table.email),
    foreignKey({
      name: "tenant_users_access_profile_same_tenant_fk",
      columns: [table.tenantId, table.accessProfileId],
      foreignColumns: [accessProfiles.tenantId, accessProfiles.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "tenant_users_position_same_tenant_fk",
      columns: [table.tenantId, table.positionId],
      foreignColumns: [positions.tenantId, positions.id]
    }).onDelete("restrict")
  ]
);

export const userCredentials = pgTable(
  "user_credentials",
  {
    userId: text("user_id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    uniqueIndex("user_credentials_email_uidx").on(table.email),
    foreignKey({
      name: "user_credentials_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade")
  ]
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    uniqueIndex("user_sessions_token_hash_uidx").on(table.tokenHash),
    index("user_sessions_user_id_idx").on(table.userId),
    foreignKey({
      name: "user_sessions_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade")
  ]
);

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

export const tenantOrgNodes = pgTable(
  "tenant_org_nodes",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    track: text("track").notNull(),
    nodeType: text("node_type").notNull(),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => [
    primaryKey({
      name: "tenant_org_nodes_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "tenant_org_nodes_parent_fk",
      columns: [table.tenantId, table.parentId],
      foreignColumns: [table.tenantId, table.id]
    }).onDelete("cascade"),
    index("tenant_org_nodes_tenant_track_idx").on(table.tenantId, table.track, table.sortOrder),
    check("tenant_org_nodes_track_chk", sql`${table.track} in ('functional', 'project')`),
    check(
      "tenant_org_nodes_type_chk",
      sql`${table.nodeType} in ('direction', 'department', 'team')`
    ),
    check(
      "tenant_org_nodes_direction_parent_chk",
      sql`(${table.nodeType} = 'direction' and ${table.parentId} is null) or (${table.nodeType} in ('department', 'team') and ${table.parentId} is not null)`
    ),
    check(
      "tenant_org_nodes_track_type_chk",
      sql`(${table.track} = 'functional' and ${table.nodeType} in ('direction', 'department')) or (${table.track} = 'project' and ${table.nodeType} in ('direction', 'team'))`
    )
  ]
);

export const tenantUserOrgPlacements = pgTable(
  "tenant_user_org_placements",
  {
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    track: text("track").notNull(),
    directionId: text("direction_id").notNull(),
    departmentId: text("department_id"),
    teamId: text("team_id"),
    positionId: text("position_id").notNull()
  },
  (table) => [
    primaryKey({
      name: "tenant_user_org_placements_pkey",
      columns: [table.tenantId, table.userId, table.track]
    }),
    foreignKey({
      name: "tenant_user_org_placements_tenant_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "tenant_user_org_placements_direction_fk",
      columns: [table.tenantId, table.directionId],
      foreignColumns: [tenantOrgNodes.tenantId, tenantOrgNodes.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "tenant_user_org_placements_department_fk",
      columns: [table.tenantId, table.departmentId],
      foreignColumns: [tenantOrgNodes.tenantId, tenantOrgNodes.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "tenant_user_org_placements_team_fk",
      columns: [table.tenantId, table.teamId],
      foreignColumns: [tenantOrgNodes.tenantId, tenantOrgNodes.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "tenant_user_org_placements_position_fk",
      columns: [table.tenantId, table.positionId],
      foreignColumns: [positions.tenantId, positions.id]
    }).onDelete("restrict"),
    index("tenant_user_org_placements_tenant_track_idx").on(table.tenantId, table.track),
    check("tenant_user_org_placements_track_chk", sql`${table.track} in ('functional', 'project')`),
    check(
      "tenant_user_org_placements_unit_chk",
      sql`(${table.track} = 'functional' and ${table.departmentId} is not null and ${table.teamId} is null) or (${table.track} = 'project' and ${table.teamId} is not null and ${table.departmentId} is null)`
    )
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

export const kpiDefinitions = pgTable(
  "kpi_definitions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    formula: jsonb("formula").$type<Record<string, unknown>>().notNull(),
    unit: text("unit").notNull(),
    period: text("period").notNull(),
    thresholdRules: jsonb("threshold_rules").$type<Record<string, unknown>[]>().notNull(),
    ownerRole: text("owner_role"),
    allowedActions: jsonb("allowed_actions").$type<string[]>().notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "kpi_definitions_pkey",
      columns: [table.tenantId, table.id]
    }),
    uniqueIndex("kpi_definitions_tenant_code_uidx").on(table.tenantId, table.code),
    index("kpi_definitions_tenant_status_idx").on(table.tenantId, table.status),
    check("kpi_definitions_entity_type_chk", sql`${table.entityType} in ('project')`),
    check("kpi_definitions_version_chk", sql`${table.version} > 0`),
    check("kpi_definitions_status_chk", sql`${table.status} in ('active', 'archived')`)
  ]
);

export const kpiEvaluations = pgTable(
  "kpi_evaluations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    definitionId: text("definition_id").notNull(),
    definitionVersion: integer("definition_version").notNull(),
    formulaVersion: integer("formula_version").notNull(),
    sourceData: jsonb("source_data").$type<Record<string, unknown>>().notNull(),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    threshold: jsonb("threshold").$type<Record<string, unknown> | null>(),
    calculatedValue: doublePrecision("calculated_value").notNull(),
    severity: text("severity").notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "kpi_evaluations_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "kpi_evaluations_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "kpi_evaluations_definition_fk",
      columns: [table.tenantId, table.definitionId],
      foreignColumns: [kpiDefinitions.tenantId, kpiDefinitions.id]
    }).onDelete("restrict"),
    index("kpi_evaluations_tenant_project_evaluated_idx").on(
      table.tenantId,
      table.projectId,
      table.evaluatedAt
    ),
    check("kpi_evaluations_severity_chk", sql`${table.severity} in ('ok', 'warning', 'critical')`)
  ]
);

export const controlSignals = pgTable(
  "control_signals",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    evaluationId: text("evaluation_id"),
    sourceEntity: jsonb("source_entity").$type<AuditSourceEntity>().notNull(),
    sourceMetric: text("source_metric").notNull(),
    severity: text("severity").notNull(),
    explanation: text("explanation").notNull(),
    ownerUserId: text("owner_user_id"),
    allowedActions: jsonb("allowed_actions").$type<string[]>().notNull(),
    scenarioProposals: jsonb("scenario_proposals").$type<Record<string, unknown>[]>().notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "control_signals_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "control_signals_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "control_signals_owner_user_fk",
      columns: [table.tenantId, table.ownerUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("control_signals_tenant_project_status_idx").on(
      table.tenantId,
      table.projectId,
      table.status
    ),
    check("control_signals_severity_chk", sql`${table.severity} in ('warning', 'critical')`),
    check(
      "control_signals_status_chk",
      sql`${table.status} in ('open', 'acknowledged', 'resolved', 'accepted_risk')`
    )
  ]
);

export const correctiveActions = pgTable(
  "corrective_actions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    controlSignalId: text("control_signal_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    responsibleUserId: text("responsible_user_id"),
    dueDate: text("due_date"),
    status: text("status").notNull().default("open"),
    result: text("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "corrective_actions_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "corrective_actions_signal_fk",
      columns: [table.tenantId, table.projectId, table.controlSignalId],
      foreignColumns: [controlSignals.tenantId, controlSignals.projectId, controlSignals.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "corrective_actions_responsible_user_fk",
      columns: [table.tenantId, table.responsibleUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("corrective_actions_tenant_project_status_idx").on(
      table.tenantId,
      table.projectId,
      table.status
    ),
    check("corrective_actions_status_chk", sql`${table.status} in ('open', 'in_progress', 'done', 'cancelled')`)
  ]
);

export const actionExecutions = pgTable(
  "action_executions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    actionType: text("action_type").notNull(),
    targetEntity: jsonb("target_entity").$type<AuditSourceEntity>().notNull(),
    actorUserId: text("actor_user_id").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    previewPayload: jsonb("preview_payload").$type<Record<string, unknown> | null>(),
    resultPayload: jsonb("result_payload").$type<Record<string, unknown> | null>(),
    status: text("status").notNull(),
    auditEventId: text("audit_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "action_executions_pkey",
      columns: [table.tenantId, table.projectId, table.id]
    }),
    foreignKey({
      name: "action_executions_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "action_executions_actor_fk",
      columns: [table.tenantId, table.actorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("action_executions_tenant_project_created_idx").on(
      table.tenantId,
      table.projectId,
      table.createdAt
    ),
    check("action_executions_status_chk", sql`${table.status} in ('previewed', 'succeeded', 'failed', 'denied')`)
  ]
);

export const projectClosureSnapshots = pgTable(
  "project_closure_snapshots",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    projectStatusBefore: text("project_status_before").notNull(),
    planVersion: integer("plan_version").notNull(),
    snapshotPayload: jsonb("snapshot_payload")
      .$type<Record<string, unknown>>()
      .notNull(),
    planFactSummary: jsonb("plan_fact_summary")
      .$type<Record<string, unknown>>()
      .notNull(),
    closedByUserId: text("closed_by_user_id").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
    closeReason: text("close_reason").notNull(),
    auditEventId: text("audit_event_id")
  },
  (table) => [
    primaryKey({
      name: "project_closure_snapshots_pkey",
      columns: [table.tenantId, table.id]
    }),
    uniqueIndex("project_closure_snapshots_tenant_project_uidx").on(
      table.tenantId,
      table.projectId
    ),
    foreignKey({
      name: "project_closure_snapshots_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "project_closure_snapshots_closed_by_fk",
      columns: [table.tenantId, table.closedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("project_closure_snapshots_tenant_closed_idx").on(
      table.tenantId,
      table.closedAt
    ),
    check("project_closure_snapshots_plan_version_chk", sql`${table.planVersion} > 0`)
  ]
);

export const retrospectiveLessons = pgTable(
  "retrospective_lessons",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    impact: text("impact").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "retrospective_lessons_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "retrospective_lessons_snapshot_fk",
      columns: [table.tenantId, table.snapshotId],
      foreignColumns: [projectClosureSnapshots.tenantId, projectClosureSnapshots.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "retrospective_lessons_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "retrospective_lessons_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("retrospective_lessons_tenant_project_created_idx").on(
      table.tenantId,
      table.projectId,
      table.createdAt
    ),
    check(
      "retrospective_lessons_category_chk",
      sql`${table.category} in ('schedule', 'scope', 'resource', 'quality', 'communication', 'commercial', 'process')`
    ),
    check(
      "retrospective_lessons_impact_chk",
      sql`${table.impact} in ('positive', 'negative', 'neutral')`
    )
  ]
);

export const templateImprovementActions = pgTable(
  "template_improvement_actions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    templateId: text("template_id").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    impact: jsonb("impact").$type<Record<string, unknown>>().notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    appliedByUserId: text("applied_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    auditEventId: text("audit_event_id")
  },
  (table) => [
    primaryKey({
      name: "template_improvement_actions_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "template_improvement_actions_snapshot_fk",
      columns: [table.tenantId, table.snapshotId],
      foreignColumns: [projectClosureSnapshots.tenantId, projectClosureSnapshots.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "template_improvement_actions_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "template_improvement_actions_template_fk",
      columns: [table.tenantId, table.templateId],
      foreignColumns: [projectTemplates.tenantId, projectTemplates.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "template_improvement_actions_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "template_improvement_actions_applied_by_fk",
      columns: [table.tenantId, table.appliedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("template_improvement_actions_tenant_template_status_idx").on(
      table.tenantId,
      table.templateId,
      table.status
    ),
    check(
      "template_improvement_actions_status_chk",
      sql`${table.status} in ('proposed', 'applied', 'rejected')`
    )
  ]
);

export const controlSurfaceDefinitions = pgTable(
  "control_surface_definitions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ownerUserId: text("owner_user_id"),
    status: text("status").notNull().default("draft"),
    currentVersion: integer("current_version").notNull().default(0),
    draftVersion: integer("draft_version").notNull().default(1),
    draftDefinition: jsonb("draft_definition").$type<Record<string, unknown>>().notNull(),
    publishedDefinition: jsonb("published_definition").$type<Record<string, unknown> | null>(),
    createdByUserId: text("created_by_user_id").notNull(),
    updatedByUserId: text("updated_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "control_surface_definitions_pkey",
      columns: [table.tenantId, table.id]
    }),
    uniqueIndex("control_surface_definitions_tenant_code_uidx").on(table.tenantId, table.code),
    foreignKey({
      name: "control_surface_definitions_owner_user_fk",
      columns: [table.tenantId, table.ownerUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "control_surface_definitions_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "control_surface_definitions_updated_by_fk",
      columns: [table.tenantId, table.updatedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("control_surface_definitions_tenant_status_idx").on(table.tenantId, table.status),
    check("control_surface_definitions_status_chk", sql`${table.status} in ('draft', 'published', 'archived')`),
    check("control_surface_definitions_current_version_chk", sql`${table.currentVersion} >= 0`),
    check("control_surface_definitions_draft_version_chk", sql`${table.draftVersion} > 0`)
  ]
);

export const controlSurfaceVersions = pgTable(
  "control_surface_versions",
  {
    tenantId: text("tenant_id").notNull(),
    surfaceId: text("surface_id").notNull(),
    version: integer("version").notNull(),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
    publishedByUserId: text("published_by_user_id").notNull(),
    auditEventId: text("audit_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "control_surface_versions_pkey",
      columns: [table.tenantId, table.surfaceId, table.version]
    }),
    foreignKey({
      name: "control_surface_versions_surface_fk",
      columns: [table.tenantId, table.surfaceId],
      foreignColumns: [controlSurfaceDefinitions.tenantId, controlSurfaceDefinitions.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "control_surface_versions_published_by_fk",
      columns: [table.tenantId, table.publishedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("control_surface_versions_tenant_surface_created_idx").on(
      table.tenantId,
      table.surfaceId,
      table.createdAt
    ),
    check("control_surface_versions_version_chk", sql`${table.version} > 0`)
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

export const fileAssets = pgTable(
  "file_assets",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    safeDisplayName: text("safe_display_name").notNull(),
    mimeType: text("mime_type").notNull(),
    // bigint: HD call recordings routinely exceed the 2GB PostgreSQL integer ceiling; mode
    // "number" keeps the JS surface unchanged (sizes stay well under 2^53).
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksumSha256: text("checksum_sha256"),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    purgedAt: timestamp("purged_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "file_assets_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "file_assets_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    uniqueIndex("file_assets_tenant_storage_key_uidx").on(
      table.tenantId,
      table.storageKey
    ),
    index("file_assets_tenant_status_idx").on(table.tenantId, table.status),
    index("file_assets_tenant_archived_purge_idx").on(
      table.tenantId,
      table.archivedAt,
      table.purgedAt
    ),
    check("file_assets_provider_chk", sql`${table.provider} in ('local', 's3')`),
    check(
      "file_assets_status_chk",
      sql`${table.status} in ('pending', 'ready', 'archived', 'failed')`
    ),
    check("file_assets_size_chk", sql`${table.sizeBytes} >= 0`)
  ]
);

export const externalReferences = pgTable(
  "external_references",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    connectorType: text("connector_type").notNull(),
    externalId: text("external_id"),
    url: text("url").notNull(),
    title: text("title").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "external_references_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "external_references_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("external_references_tenant_connector_idx").on(
      table.tenantId,
      table.connectorType
    ),
    check(
      "external_references_connector_type_chk",
      sql`${table.connectorType} in ('manual_link', 'bitrix24', 'amocrm', 'jira', 'slack', 'email', 's3', 'local', 'other')`
    )
  ]
);

export const entityAttachments = pgTable(
  "entity_attachments",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    assetId: text("asset_id"),
    externalReferenceId: text("external_reference_id"),
    relationType: text("relation_type").notNull(),
    sourceActivityType: text("source_activity_type"),
    sourceActivityId: text("source_activity_id"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "entity_attachments_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "entity_attachments_asset_fk",
      columns: [table.tenantId, table.assetId],
      foreignColumns: [fileAssets.tenantId, fileAssets.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "entity_attachments_external_reference_fk",
      columns: [table.tenantId, table.externalReferenceId],
      foreignColumns: [externalReferences.tenantId, externalReferences.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "entity_attachments_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("entity_attachments_tenant_entity_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId
    ),
    index("entity_attachments_tenant_source_activity_idx").on(
      table.tenantId,
      table.sourceActivityType,
      table.sourceActivityId
    ),
    check(
      "entity_attachments_entity_type_chk",
      sql`${table.entityType} in ('opportunity', 'client', 'contact', 'product', 'project', 'task', 'communication_channel', 'document')`
    ),
    check(
      "entity_attachments_source_activity_type_chk",
      sql`${table.sourceActivityType} is null or ${table.sourceActivityType} in ('crm', 'task')`
    ),
    check(
      "entity_attachments_target_chk",
      sql`(
        (${table.assetId} is not null and ${table.externalReferenceId} is null)
        or
        (${table.assetId} is null and ${table.externalReferenceId} is not null)
      )`
    )
  ]
);

export const backgroundJobSchedules = pgTable(
  "background_job_schedules",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    intervalSeconds: integer("interval_seconds").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    lastEnqueuedAt: timestamp("last_enqueued_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "background_job_schedules_pkey",
      columns: [table.tenantId, table.id]
    }),
    uniqueIndex("background_job_schedules_tenant_key_uidx").on(
      table.tenantId,
      table.scheduleKey
    ),
    index("background_job_schedules_due_idx").on(
      table.enabled,
      table.nextRunAt,
      table.tenantId
    ),
    check(
      "background_job_schedules_kind_chk",
      sql`${table.kind} in ('storage.asset_cleanup', 'notification.dispatch', 'connector.sync', 'search.projection_rebuild', 'capacity.cache_warmup', 'calls.recording_janitor', 'calls.recording_compose')`
    ),
    check("background_job_schedules_interval_chk", sql`${table.intervalSeconds} > 0`)
  ]
);

export const backgroundJobRuns = pgTable(
  "background_job_runs",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    priority: integer("priority").notNull().default(0),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull(),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "background_job_runs_pkey",
      columns: [table.tenantId, table.id]
    }),
    uniqueIndex("background_job_runs_tenant_idempotency_uidx").on(
      table.tenantId,
      table.idempotencyKey
    ),
    index("background_job_runs_claim_idx").on(
      table.status,
      table.runAfter,
      table.priority,
      table.createdAt
    ),
    index("background_job_runs_tenant_status_idx").on(table.tenantId, table.status),
    check(
      "background_job_runs_kind_chk",
      sql`${table.kind} in ('storage.asset_cleanup', 'notification.dispatch', 'connector.sync', 'search.projection_rebuild', 'capacity.cache_warmup', 'calls.recording_janitor', 'calls.recording_compose')`
    ),
    check(
      "background_job_runs_status_chk",
      sql`${table.status} in ('queued', 'running', 'succeeded', 'dead', 'cancelled')`
    ),
    check("background_job_runs_attempt_chk", sql`${table.attempt} >= 0`),
    check(
      "background_job_runs_max_attempts_chk",
      sql`${table.maxAttempts} >= 1 and ${table.maxAttempts} <= 25`
    ),
    check(
      "background_job_runs_priority_chk",
      sql`${table.priority} >= -100 and ${table.priority} <= 100`
    )
  ]
);

export const backgroundJobEvents = pgTable(
  "background_job_events",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: text("job_id").notNull(),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "background_job_events_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "background_job_events_job_fk",
      columns: [table.tenantId, table.jobId],
      foreignColumns: [backgroundJobRuns.tenantId, backgroundJobRuns.id]
    }).onDelete("cascade"),
    index("background_job_events_tenant_job_idx").on(table.tenantId, table.jobId),
    check(
      "background_job_events_type_chk",
      sql`${table.eventType} in ('enqueued', 'claimed', 'succeeded', 'failed', 'retry_scheduled', 'dead', 'cancelled')`
    )
  ]
);

export const communicationChannels = pgTable(
  "communication_channels",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    channelType: text("channel_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    scopeEntityType: text("scope_entity_type"),
    scopeEntityId: text("scope_entity_id"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "communication_channels_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "communication_channels_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    uniqueIndex("communication_channels_workspace_general_uidx")
      .on(table.tenantId, table.channelType)
      .where(sql`${table.channelType} = 'workspace_general' and ${table.archivedAt} is null`),
    index("communication_channels_tenant_type_idx").on(
      table.tenantId,
      table.channelType,
      table.createdAt
    ),
    check(
      "communication_channels_type_chk",
      sql`${table.channelType} in ('workspace_general', 'team', 'project_general', 'custom')`
    ),
    check(
      "communication_channels_scope_type_chk",
      sql`${table.scopeEntityType} is null or ${table.scopeEntityType} in ('project', 'org_unit')`
    ),
    check(
      "communication_channels_scope_chk",
      sql`(
        (${table.channelType} in ('team', 'project_general') and ${table.scopeEntityType} is not null and ${table.scopeEntityId} is not null)
        or
        (${table.channelType} not in ('team', 'project_general'))
      )`
    )
  ]
);

export const communicationChannelMembers = pgTable(
  "communication_channel_members",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "communication_channel_members_pkey",
      columns: [table.tenantId, table.channelId, table.userId]
    }),
    foreignKey({
      name: "communication_channel_members_channel_fk",
      columns: [table.tenantId, table.channelId],
      foreignColumns: [communicationChannels.tenantId, communicationChannels.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "communication_channel_members_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "communication_channel_members_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("communication_channel_members_tenant_user_idx").on(table.tenantId, table.userId),
    check("communication_channel_members_role_chk", sql`${table.role} in ('owner', 'moderator', 'member')`)
  ]
);

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    conversationType: text("conversation_type").notNull(),
    title: text("title").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "conversations_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "conversations_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    uniqueIndex("conversations_tenant_entity_type_uidx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.conversationType
    ),
    index("conversations_tenant_entity_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId
    ),
    check(
      "conversations_entity_type_chk",
      sql`${table.entityType} in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel')`
    ),
    check("conversations_type_chk", sql`${table.conversationType} in ('default', 'meeting_followup')`)
  ]
);

export const discussionMessages = pgTable(
  "discussion_messages",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(),
    authorUserId: text("author_user_id").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    pinnedByUserId: text("pinned_by_user_id")
  },
  (table) => [
    primaryKey({
      name: "discussion_messages_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "discussion_messages_conversation_fk",
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [conversations.tenantId, conversations.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "discussion_messages_author_fk",
      columns: [table.tenantId, table.authorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "discussion_messages_pinned_by_fk",
      columns: [table.tenantId, table.pinnedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("discussion_messages_tenant_conversation_created_idx").on(
      table.tenantId,
      table.conversationId,
      table.createdAt,
      table.id
    )
  ]
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    userId: text("user_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "message_reactions_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "message_reactions_message_fk",
      columns: [table.tenantId, table.messageId],
      foreignColumns: [discussionMessages.tenantId, discussionMessages.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "message_reactions_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    uniqueIndex("message_reactions_active_uidx")
      .on(table.tenantId, table.messageId, table.userId, table.emoji)
      .where(sql`${table.archivedAt} is null`),
    index("message_reactions_tenant_message_idx").on(table.tenantId, table.messageId)
  ]
);

export const stickerPacks = pgTable(
  "sticker_packs",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "sticker_packs_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "sticker_packs_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("sticker_packs_tenant_created_idx").on(table.tenantId, table.createdAt),
    check(
      "sticker_packs_source_chk",
      sql`${table.source} in ('manual_upload', 'telegram_export', 'other_import')`
    ),
    check("sticker_packs_status_chk", sql`${table.status} in ('ready', 'archived')`)
  ]
);

export const stickerAssets = pgTable(
  "sticker_assets",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    packId: text("pack_id").notNull(),
    fileAssetId: text("file_asset_id").notNull(),
    emoji: text("emoji").notNull(),
    title: text("title").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "sticker_assets_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "sticker_assets_pack_fk",
      columns: [table.tenantId, table.packId],
      foreignColumns: [stickerPacks.tenantId, stickerPacks.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "sticker_assets_file_asset_fk",
      columns: [table.tenantId, table.fileAssetId],
      foreignColumns: [fileAssets.tenantId, fileAssets.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "sticker_assets_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("sticker_assets_tenant_pack_idx").on(table.tenantId, table.packId),
    check("sticker_assets_mime_chk", sql`${table.mimeType} in ('image/png', 'image/webp')`),
    check("sticker_assets_status_chk", sql`${table.status} in ('pending', 'ready', 'archived', 'failed')`),
    check("sticker_assets_size_chk", sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= ${2 * 1024 * 1024}`),
    check("sticker_assets_dimensions_chk", sql`${table.width} between 64 and 512 and ${table.height} between 64 and 512`)
  ]
);

export const messageStickers = pgTable(
  "message_stickers",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    stickerAssetId: text("sticker_asset_id").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "message_stickers_pkey",
      columns: [table.tenantId, table.messageId]
    }),
    foreignKey({
      name: "message_stickers_message_fk",
      columns: [table.tenantId, table.messageId],
      foreignColumns: [discussionMessages.tenantId, discussionMessages.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "message_stickers_sticker_fk",
      columns: [table.tenantId, table.stickerAssetId],
      foreignColumns: [stickerAssets.tenantId, stickerAssets.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "message_stickers_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("message_stickers_tenant_sticker_idx").on(table.tenantId, table.stickerAssetId)
  ]
);

export const messageMentions = pgTable(
  "message_mentions",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    mentionedUserId: text("mentioned_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "message_mentions_pkey",
      columns: [table.tenantId, table.messageId, table.mentionedUserId]
    }),
    foreignKey({
      name: "message_mentions_message_fk",
      columns: [table.tenantId, table.messageId],
      foreignColumns: [discussionMessages.tenantId, discussionMessages.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "message_mentions_user_fk",
      columns: [table.tenantId, table.mentionedUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("message_mentions_tenant_user_created_idx").on(
      table.tenantId,
      table.mentionedUserId,
      table.createdAt
    )
  ]
);

export const conversationReadStates = pgTable(
  "conversation_read_states",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(),
    userId: text("user_id").notNull(),
    lastReadMessageId: text("last_read_message_id"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    unreadCount: integer("unread_count").notNull()
  },
  (table) => [
    primaryKey({
      name: "conversation_read_states_pkey",
      columns: [table.tenantId, table.conversationId, table.userId]
    }),
    foreignKey({
      name: "conversation_read_states_conversation_fk",
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [conversations.tenantId, conversations.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "conversation_read_states_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    check("conversation_read_states_unread_chk", sql`${table.unreadCount} >= 0`)
  ]
);

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    notificationType: text("notification_type").notNull(),
    sourceEntityType: text("source_entity_type").notNull(),
    sourceEntityId: text("source_entity_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    route: text("route").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "user_notifications_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "user_notifications_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    index("user_notifications_tenant_user_created_idx").on(
      table.tenantId,
      table.userId,
      table.createdAt
    ),
    index("user_notifications_tenant_user_unread_idx").on(
      table.tenantId,
      table.userId,
      table.readAt
    ),
    check(
      "user_notifications_type_chk",
      sql`${table.notificationType} in ('mention', 'assignment_changed', 'deadline_risk', 'control_signal', 'meeting_invite', 'meeting_action_item')`
    )
  ]
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    channel: text("channel").notNull(),
    notificationType: text("notification_type").notNull(),
    enabled: boolean("enabled").notNull(),
    digestFrequency: text("digest_frequency").notNull()
  },
  (table) => [
    primaryKey({
      name: "notification_preferences_pkey",
      columns: [table.tenantId, table.userId, table.channel, table.notificationType]
    }),
    foreignKey({
      name: "notification_preferences_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    check("notification_preferences_channel_chk", sql`${table.channel} in ('in_app', 'email', 'digest')`),
    check(
      "notification_preferences_type_chk",
      sql`${table.notificationType} in ('mention', 'assignment_changed', 'deadline_risk', 'control_signal', 'meeting_invite', 'meeting_action_item')`
    ),
    check("notification_preferences_digest_chk", sql`${table.digestFrequency} in ('none', 'daily', 'weekly')`)
  ]
);

export const meetings = pgTable(
  "meetings",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    agenda: text("agenda").notNull(),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    scheduledFinish: timestamp("scheduled_finish", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "meetings_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "meetings_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("meetings_tenant_entity_start_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.scheduledStart
    ),
    check(
      "meetings_entity_type_chk",
      sql`${table.entityType} in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel')`
    ),
    check("meetings_status_chk", sql`${table.status} in ('scheduled', 'completed', 'cancelled')`),
    check("meetings_schedule_chk", sql`${table.scheduledFinish} > ${table.scheduledStart}`)
  ]
);

export const meetingParticipants = pgTable(
  "meeting_participants",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    response: text("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "meeting_participants_pkey",
      columns: [table.tenantId, table.meetingId, table.userId]
    }),
    foreignKey({
      name: "meeting_participants_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "meeting_participants_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    check("meeting_participants_role_chk", sql`${table.role} in ('organizer', 'required', 'optional')`),
    check("meeting_participants_response_chk", sql`${table.response} in ('pending', 'accepted', 'declined')`)
  ]
);

export const meetingExternalLinks = pgTable(
  "meeting_external_links",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").notNull(),
    provider: text("provider").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "meeting_external_links_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "meeting_external_links_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "meeting_external_links_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("meeting_external_links_tenant_meeting_idx").on(table.tenantId, table.meetingId),
    check(
      "meeting_external_links_provider_chk",
      sql`${table.provider} in ('zoom', 'teams', 'google_meet', 'manual_link', 'other')`
    )
  ]
);

export const meetingNotes = pgTable(
  "meeting_notes",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").notNull(),
    authorUserId: text("author_user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "meeting_notes_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "meeting_notes_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "meeting_notes_author_fk",
      columns: [table.tenantId, table.authorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("meeting_notes_tenant_meeting_created_idx").on(
      table.tenantId,
      table.meetingId,
      table.createdAt
    )
  ]
);

export const meetingActionItems = pgTable(
  "meeting_action_items",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").notNull(),
    title: text("title").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    dueDate: text("due_date"),
    targetEntityType: text("target_entity_type").notNull(),
    targetEntityId: text("target_entity_id").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "meeting_action_items_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "meeting_action_items_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "meeting_action_items_owner_fk",
      columns: [table.tenantId, table.ownerUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "meeting_action_items_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("meeting_action_items_tenant_meeting_created_idx").on(
      table.tenantId,
      table.meetingId,
      table.createdAt
    ),
    check(
      "meeting_action_items_target_type_chk",
      sql`${table.targetEntityType} in ('task', 'corrective_action', 'project', 'opportunity')`
    ),
    check("meeting_action_items_status_chk", sql`${table.status} in ('open', 'done', 'cancelled')`)
  ]
);

export const callRooms = pgTable(
  "call_rooms",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    meetingId: text("meeting_id"),
    title: text("title").notNull(),
    mediaKind: text("media_kind").notNull(),
    provider: text("provider").notNull(),
    providerRoomId: text("provider_room_id").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "call_rooms_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "call_rooms_meeting_fk",
      columns: [table.tenantId, table.meetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "call_rooms_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("call_rooms_tenant_entity_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    uniqueIndex("call_rooms_tenant_provider_room_uidx").on(
      table.tenantId,
      table.provider,
      table.providerRoomId
    ),
    check(
      "call_rooms_entity_type_chk",
      sql`${table.entityType} in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel')`
    ),
    check("call_rooms_media_kind_chk", sql`${table.mediaKind} in ('audio', 'video')`),
    check("call_rooms_provider_chk", sql`${table.provider} in ('manual', 'jitsi', 'livekit')`),
    check(
      "call_rooms_status_chk",
      sql`${table.status} in ('scheduled', 'open', 'active', 'ended', 'cancelled')`
    )
  ]
);

export const callSessions = pgTable(
  "call_sessions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    providerSessionId: text("provider_session_id"),
    status: text("status").notNull(),
    startedByUserId: text("started_by_user_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedByUserId: text("ended_by_user_id"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    failureReason: text("failure_reason")
  },
  (table) => [
    primaryKey({
      name: "call_sessions_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "call_sessions_room_fk",
      columns: [table.tenantId, table.roomId],
      foreignColumns: [callRooms.tenantId, callRooms.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_sessions_started_by_fk",
      columns: [table.tenantId, table.startedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "call_sessions_ended_by_fk",
      columns: [table.tenantId, table.endedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("call_sessions_tenant_room_started_idx").on(
      table.tenantId,
      table.roomId,
      table.startedAt
    ),
    uniqueIndex("call_sessions_tenant_room_id_uidx").on(
      table.tenantId,
      table.roomId,
      table.id
    ),
    uniqueIndex("call_sessions_one_active_per_room_uidx")
      .on(table.tenantId, table.roomId)
      .where(sql`${table.status} = 'active'`),
    check("call_sessions_status_chk", sql`${table.status} in ('active', 'ended', 'failed')`),
    check(
      "call_sessions_end_chk",
      sql`(
        (${table.status} = 'active' and ${table.endedAt} is null)
        or
        (${table.status} <> 'active' and ${table.endedAt} is not null)
      )`
    )
  ]
);

export const callParticipantStates = pgTable(
  "call_participant_states",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    sessionId: text("session_id").notNull(),
    userId: text("user_id").notNull(),
    state: text("state").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "call_participant_states_pkey",
      columns: [table.tenantId, table.roomId, table.sessionId, table.userId]
    }),
    foreignKey({
      name: "call_participant_states_session_fk",
      columns: [table.tenantId, table.roomId, table.sessionId],
      foreignColumns: [callSessions.tenantId, callSessions.roomId, callSessions.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_participant_states_user_fk",
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("cascade"),
    check(
      "call_participant_states_state_chk",
      sql`${table.state} in ('invited', 'joining', 'joined', 'left', 'removed')`
    )
  ]
);

export const callEvents = pgTable(
  "call_events",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    sessionId: text("session_id"),
    eventType: text("event_type").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "call_events_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "call_events_room_fk",
      columns: [table.tenantId, table.roomId],
      foreignColumns: [callRooms.tenantId, callRooms.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_events_session_fk",
      columns: [table.tenantId, table.roomId, table.sessionId],
      foreignColumns: [callSessions.tenantId, callSessions.roomId, callSessions.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_events_actor_fk",
      columns: [table.tenantId, table.actorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("call_events_tenant_room_created_idx").on(
      table.tenantId,
      table.roomId,
      table.createdAt,
      table.id
    ),
    check(
      "call_events_type_chk",
      sql`${table.eventType} in ('room_created', 'session_started', 'join_token_issued', 'participant_invited', 'participant_joining', 'participant_joined', 'participant_left', 'session_ended', 'recording_attached', 'recording_started', 'recording_track_completed', 'recording_completed', 'recording_failed')`
    )
  ]
);

export const callRecordings = pgTable(
  "call_recordings",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    sessionId: text("session_id"),
    recordingGroupId: text("recording_group_id").notNull(),
    attachmentId: text("attachment_id"),
    egressId: text("egress_id"),
    participantId: text("participant_id"),
    trackId: text("track_id"),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    durationSeconds: integer("duration_seconds"),
    title: text("title").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "call_recordings_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "call_recordings_room_fk",
      columns: [table.tenantId, table.roomId],
      foreignColumns: [callRooms.tenantId, callRooms.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_recordings_session_fk",
      columns: [table.tenantId, table.roomId, table.sessionId],
      foreignColumns: [callSessions.tenantId, callSessions.roomId, callSessions.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "call_recordings_attachment_fk",
      columns: [table.tenantId, table.attachmentId],
      foreignColumns: [entityAttachments.tenantId, entityAttachments.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "call_recordings_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("call_recordings_tenant_room_created_idx").on(
      table.tenantId,
      table.roomId,
      table.createdAt
    ),
    index("call_recordings_tenant_group_idx").on(table.tenantId, table.recordingGroupId),
    uniqueIndex("call_recordings_tenant_egress_uidx")
      .on(table.tenantId, table.egressId)
      .where(sql`${table.egressId} is not null`),
    check("call_recordings_kind_chk", sql`${table.kind} in ('audio', 'video', 'composed')`),
    check(
      "call_recordings_status_chk",
      sql`${table.status} in ('starting', 'recording', 'ready', 'failed')`
    ),
    check(
      "call_recordings_ready_attachment_chk",
      sql`((${table.status} = 'ready' and ${table.attachmentId} is not null) or (${table.status} <> 'ready'))`
    )
  ]
);

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    documentType: text("document_type").notNull(),
    status: text("status").notNull(),
    currentVersionId: text("current_version_id"),
    sourceMeetingId: text("source_meeting_id"),
    approvalStatus: text("approval_status").notNull(),
    approvalRequestedByUserId: text("approval_requested_by_user_id"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "knowledge_documents_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "knowledge_documents_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "knowledge_documents_meeting_fk",
      columns: [table.tenantId, table.sourceMeetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "knowledge_documents_approval_user_fk",
      columns: [table.tenantId, table.approvalRequestedByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "knowledge_documents_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("knowledge_documents_tenant_project_updated_idx").on(
      table.tenantId,
      table.projectId,
      table.updatedAt
    ),
    check(
      "knowledge_documents_type_chk",
      sql`${table.documentType} in ('project_brief', 'meeting_minutes', 'specification', 'decision_record', 'general')`
    ),
    check("knowledge_documents_status_chk", sql`${table.status} in ('draft', 'active', 'archived')`),
    check(
      "knowledge_documents_approval_status_chk",
      sql`${table.approvalStatus} in ('none', 'pending', 'approved', 'rejected')`
    )
  ]
);

export const knowledgeDocumentVersions = pgTable(
  "knowledge_document_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: text("document_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    summary: text("summary"),
    changeReason: text("change_reason"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "knowledge_document_versions_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "knowledge_document_versions_document_fk",
      columns: [table.tenantId, table.documentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "knowledge_document_versions_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    uniqueIndex("knowledge_document_versions_document_number_uidx").on(
      table.tenantId,
      table.documentId,
      table.versionNumber
    ),
    index("knowledge_document_versions_document_created_idx").on(
      table.tenantId,
      table.documentId,
      table.createdAt
    ),
    check("knowledge_document_versions_number_chk", sql`${table.versionNumber} > 0`)
  ]
);

export const decisionLogEntries = pgTable(
  "decision_log_entries",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    decision: text("decision").notNull(),
    rationale: text("rationale"),
    status: text("status").notNull(),
    sourceMeetingId: text("source_meeting_id"),
    documentId: text("document_id"),
    supersedesDecisionId: text("supersedes_decision_id"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "decision_log_entries_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "decision_log_entries_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "decision_log_entries_meeting_fk",
      columns: [table.tenantId, table.sourceMeetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "decision_log_entries_document_fk",
      columns: [table.tenantId, table.documentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "decision_log_entries_supersedes_fk",
      columns: [table.tenantId, table.supersedesDecisionId],
      foreignColumns: [table.tenantId, table.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "decision_log_entries_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("decision_log_entries_tenant_project_updated_idx").on(
      table.tenantId,
      table.projectId,
      table.updatedAt
    ),
    check(
      "decision_log_entries_status_chk",
      sql`${table.status} in ('proposed', 'accepted', 'superseded', 'rejected')`
    )
  ]
);

export const knowledgeActionItems = pgTable(
  "knowledge_action_items",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    ownerUserId: text("owner_user_id").notNull(),
    dueDate: text("due_date"),
    status: text("status").notNull(),
    sourceMeetingId: text("source_meeting_id"),
    documentId: text("document_id"),
    decisionId: text("decision_id"),
    targetEntityType: text("target_entity_type"),
    targetEntityId: text("target_entity_id"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({
      name: "knowledge_action_items_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "knowledge_action_items_project_fk",
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "knowledge_action_items_owner_fk",
      columns: [table.tenantId, table.ownerUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "knowledge_action_items_meeting_fk",
      columns: [table.tenantId, table.sourceMeetingId],
      foreignColumns: [meetings.tenantId, meetings.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "knowledge_action_items_document_fk",
      columns: [table.tenantId, table.documentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "knowledge_action_items_decision_fk",
      columns: [table.tenantId, table.decisionId],
      foreignColumns: [decisionLogEntries.tenantId, decisionLogEntries.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "knowledge_action_items_created_by_fk",
      columns: [table.tenantId, table.createdByUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("knowledge_action_items_tenant_project_updated_idx").on(
      table.tenantId,
      table.projectId,
      table.updatedAt
    ),
    check("knowledge_action_items_status_chk", sql`${table.status} in ('open', 'done', 'cancelled')`),
    check(
      "knowledge_action_items_target_type_chk",
      sql`${table.targetEntityType} is null or ${table.targetEntityType} in ('project', 'task', 'opportunity', 'corrective_action')`
    ),
    check(
      "knowledge_action_items_target_pair_chk",
      sql`(${table.targetEntityType} is null and ${table.targetEntityId} is null) or (${table.targetEntityType} is not null and ${table.targetEntityId} is not null)`
    )
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

export const crmActivities = pgTable(
  "crm_activities",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    type: text("type").notNull(),
    title: text("title"),
    body: text("body"),
    status: text("status"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    assigneeUserId: text("assignee_user_id"),
    authorUserId: text("author_user_id").notNull(),
    fileUrl: text("file_url"),
    fileSizeBytes: integer("file_size_bytes"),
    mimeType: text("mime_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "crm_activities_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "crm_activities_author_user_fk",
      columns: [table.tenantId, table.authorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "crm_activities_assignee_user_fk",
      columns: [table.tenantId, table.assigneeUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("crm_activities_tenant_entity_created_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    index("crm_activities_tenant_assignee_idx").on(
      table.tenantId,
      table.assigneeUserId
    ),
    check(
      "crm_activities_entity_type_chk",
      sql`${table.entityType} in ('opportunity', 'client', 'contact', 'product')`
    ),
    check(
      "crm_activities_type_chk",
      sql`${table.type} in ('comment', 'task', 'file')`
    ),
    check(
      "crm_activities_payload_chk",
      sql`(
        (${table.type} = 'comment' and ${table.status} is null and ${table.body} is not null)
        or
        (${table.type} = 'task' and ${table.status} in ('todo', 'done') and ${table.title} is not null)
        or
        (${table.type} = 'file' and ${table.status} is null and ${table.title} is not null and ${table.fileUrl} is not null)
      )`
    )
  ]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    actionType: text("action_type").notNull(),
    sourceSurfaceId: text("source_surface_id"),
    sourceWorkflow: text("source_workflow"),
    sourceEntity: jsonb("source_entity").$type<AuditSourceEntity>().notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    beforeState: jsonb("before_state").$type<Record<string, unknown> | null>(),
    afterState: jsonb("after_state").$type<Record<string, unknown> | null>(),
    permissionResult: jsonb("permission_result")
      .$type<Record<string, unknown>>()
      .notNull(),
    executionResult: jsonb("execution_result")
      .$type<Record<string, unknown>>()
      .notNull(),
    correlationId: text("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    index("audit_events_tenant_id_idx").on(table.tenantId),
    index("audit_events_correlation_id_idx").on(table.correlationId)
  ]
);

export type PersistenceTableName =
  | "tenants"
  | "access_profiles"
  | "positions"
  | "custom_field_definitions"
  | "project_templates"
  | "clients"
  | "contacts"
  | "products"
  | "project_types"
  | "deal_stages"
  | "opportunities"
  | "opportunity_demands"
  | "projects"
  | "project_position_demands"
  | "task_statuses"
  | "tasks"
  | "plan_versions"
  | "project_calendars"
  | "resource_calendars"
  | "calendar_exceptions"
  | "task_assignments"
  | "task_assignment_allocations"
  | "task_dependencies"
  | "project_baselines"
  | "project_baseline_tasks"
  | "project_baseline_assignments"
  | "resource_reservations"
  | "planning_scenario_runs"
  | "planning_solver_runs"
  | "planning_command_idempotency_keys"
  | "kpi_definitions"
  | "kpi_evaluations"
  | "control_signals"
  | "corrective_actions"
  | "action_executions"
  | "project_closure_snapshots"
  | "retrospective_lessons"
  | "template_improvement_actions"
  | "control_surface_definitions"
  | "control_surface_versions"
  | "tenant_production_calendars"
  | "tenant_production_calendar_exceptions"
  | "planning_saved_views"
  | "resource_absences"
  | "resource_personal_calendars"
  | "resource_calendar_events"
  | "tenant_org_nodes"
  | "tenant_user_org_placements"
  | "file_assets"
  | "external_references"
  | "entity_attachments"
  | "background_job_schedules"
  | "background_job_runs"
  | "background_job_events"
  | "communication_channels"
  | "communication_channel_members"
  | "conversations"
  | "discussion_messages"
  | "message_reactions"
  | "sticker_packs"
  | "sticker_assets"
  | "message_stickers"
  | "message_mentions"
  | "conversation_read_states"
  | "user_notifications"
  | "notification_preferences"
  | "meetings"
  | "meeting_participants"
  | "meeting_external_links"
  | "meeting_notes"
  | "meeting_action_items"
  | "call_rooms"
  | "call_sessions"
  | "call_participant_states"
  | "call_events"
  | "call_recordings"
  | "knowledge_documents"
  | "knowledge_document_versions"
  | "decision_log_entries"
  | "knowledge_action_items"
  | "task_participants"
  | "task_activities"
  | "crm_activities"
  | "tenant_users"
  | "user_credentials"
  | "user_sessions"
  | "audit_events";

export type TenantOwnedTableName = Exclude<PersistenceTableName, "tenants">;

export type AuditSourceEntity = {
  type: string;
  id: string;
};

export const persistenceTableNames: readonly PersistenceTableName[] = [
  "tenants",
  "access_profiles",
  "positions",
  "custom_field_definitions",
  "project_templates",
  "clients",
  "contacts",
  "products",
  "project_types",
  "deal_stages",
  "opportunities",
  "opportunity_demands",
  "projects",
  "project_position_demands",
  "task_statuses",
  "tasks",
  "plan_versions",
  "project_calendars",
  "resource_calendars",
  "calendar_exceptions",
  "task_assignments",
  "task_assignment_allocations",
  "task_dependencies",
  "project_baselines",
  "project_baseline_tasks",
  "project_baseline_assignments",
  "resource_reservations",
  "planning_scenario_runs",
  "planning_solver_runs",
  "planning_command_idempotency_keys",
  "kpi_definitions",
  "kpi_evaluations",
  "control_signals",
  "corrective_actions",
  "action_executions",
  "project_closure_snapshots",
  "retrospective_lessons",
  "template_improvement_actions",
  "control_surface_definitions",
  "control_surface_versions",
  "tenant_production_calendars",
  "tenant_production_calendar_exceptions",
  "planning_saved_views",
  "resource_absences",
  "resource_personal_calendars",
  "resource_calendar_events",
  "tenant_org_nodes",
  "tenant_user_org_placements",
  "file_assets",
  "external_references",
  "entity_attachments",
  "background_job_schedules",
  "background_job_runs",
  "background_job_events",
  "communication_channels",
  "communication_channel_members",
  "conversations",
  "discussion_messages",
  "message_reactions",
  "sticker_packs",
  "sticker_assets",
  "message_stickers",
  "message_mentions",
  "conversation_read_states",
  "user_notifications",
  "notification_preferences",
  "meetings",
  "meeting_participants",
  "meeting_external_links",
  "meeting_notes",
  "meeting_action_items",
  "call_rooms",
  "call_sessions",
  "call_participant_states",
  "call_events",
  "call_recordings",
  "knowledge_documents",
  "knowledge_document_versions",
  "decision_log_entries",
  "knowledge_action_items",
  "task_participants",
  "task_activities",
  "crm_activities",
  "tenant_users",
  "user_credentials",
  "user_sessions",
  "audit_events"
];

export const tenantOwnedTableNames: readonly TenantOwnedTableName[] = [
  "access_profiles",
  "positions",
  "custom_field_definitions",
  "project_templates",
  "clients",
  "contacts",
  "products",
  "project_types",
  "deal_stages",
  "opportunities",
  "opportunity_demands",
  "projects",
  "project_position_demands",
  "task_statuses",
  "tasks",
  "plan_versions",
  "project_calendars",
  "resource_calendars",
  "calendar_exceptions",
  "task_assignments",
  "task_assignment_allocations",
  "task_dependencies",
  "project_baselines",
  "project_baseline_tasks",
  "project_baseline_assignments",
  "resource_reservations",
  "planning_scenario_runs",
  "planning_solver_runs",
  "planning_command_idempotency_keys",
  "kpi_definitions",
  "kpi_evaluations",
  "control_signals",
  "corrective_actions",
  "action_executions",
  "project_closure_snapshots",
  "retrospective_lessons",
  "template_improvement_actions",
  "control_surface_definitions",
  "control_surface_versions",
  "tenant_production_calendars",
  "tenant_production_calendar_exceptions",
  "planning_saved_views",
  "resource_absences",
  "resource_personal_calendars",
  "resource_calendar_events",
  "tenant_org_nodes",
  "tenant_user_org_placements",
  "file_assets",
  "external_references",
  "entity_attachments",
  "background_job_schedules",
  "background_job_runs",
  "background_job_events",
  "communication_channels",
  "communication_channel_members",
  "conversations",
  "discussion_messages",
  "message_reactions",
  "sticker_packs",
  "sticker_assets",
  "message_stickers",
  "message_mentions",
  "conversation_read_states",
  "user_notifications",
  "notification_preferences",
  "meetings",
  "meeting_participants",
  "meeting_external_links",
  "meeting_notes",
  "meeting_action_items",
  "call_rooms",
  "call_sessions",
  "call_participant_states",
  "call_events",
  "call_recordings",
  "knowledge_documents",
  "knowledge_document_versions",
  "decision_log_entries",
  "knowledge_action_items",
  "task_participants",
  "task_activities",
  "crm_activities",
  "tenant_users",
  "user_credentials",
  "user_sessions",
  "audit_events"
];

const tableColumns = {
  tenants: ["id", "name", "created_at"],
  access_profiles: ["id", "tenant_id", "name", "permissions", "created_at"],
  positions: ["id", "tenant_id", "name", "description", "created_at"],
  custom_field_definitions: [
    "id",
    "tenant_id",
    "system_key",
    "tenant_label",
    "target_entity",
    "field_type",
    "required",
    "status",
    "created_at",
    "updated_at"
  ],
  project_templates: [
    "id",
    "tenant_id",
    "system_key",
    "tenant_label",
    "description",
    "status",
    "created_at",
    "updated_at"
  ],
  clients: [
    "id",
    "tenant_id",
    "name",
    "description",
    "status",
    "created_at",
    "updated_at"
  ],
  contacts: [
    "id",
    "tenant_id",
    "client_id",
    "name",
    "email",
    "phone",
    "telegram",
    "role",
    "status",
    "created_at",
    "updated_at"
  ],
  products: [
    "id",
    "tenant_id",
    "name",
    "sku",
    "type",
    "unit",
    "price",
    "description",
    "status",
    "created_at",
    "updated_at"
  ],
  project_types: [
    "id",
    "tenant_id",
    "name",
    "description",
    "status",
    "created_at",
    "updated_at"
  ],
  deal_stages: [
    "id",
    "tenant_id",
    "name",
    "sort_order",
    "status",
    "created_at",
    "updated_at"
  ],
  opportunities: [
    "id",
    "tenant_id",
    "client_id",
    "primary_contact_id",
    "owner_user_id",
    "project_type_id",
    "stage_id",
    "client_name",
    "contact_name",
    "title",
    "project_type",
    "description",
    "planned_start",
    "planned_finish",
    "contract_value",
    "planned_hourly_rate",
    "planned_hours",
    "probability",
    "status",
    "template_id",
    "feasibility_status",
    "feasibility_result",
    "feasibility_checked_at",
    "custom_field_values",
    "created_at",
    "updated_at"
  ],
  opportunity_demands: [
    "tenant_id",
    "opportunity_id",
    "position_id",
    "required_hours"
  ],
  projects: [
    "id",
    "tenant_id",
    "source_type",
    "source_opportunity_id",
    "client_id",
    "project_type_id",
    "title",
    "client_name",
    "status",
    "planned_start",
    "planned_finish",
    "deadline",
    "calendar_id",
    "contract_value",
    "planned_hours",
    "template_id",
    "created_at",
    "activated_at",
    "closed_at"
  ],
  project_position_demands: [
    "tenant_id",
    "project_id",
    "position_id",
    "required_hours"
  ],
  task_statuses: [
    "id",
    "tenant_id",
    "name",
    "category",
    "sort_order",
    "status",
    "is_system",
    "created_at",
    "updated_at"
  ],
  tasks: [
    "id",
    "tenant_id",
    "project_id",
    "stage_id",
    "title",
    "description",
    "status",
    "status_id",
    "priority",
    "requester_user_id",
    "owner_user_id",
    "planned_start",
    "planned_finish",
    "planned_start_minute",
    "planned_finish_minute",
    "parent_task_id",
    "wbs_code",
    "scheduling_mode",
    "task_type",
    "effort_driven",
    "duration_minutes",
    "work_minutes",
    "constraint_type",
    "constraint_date",
    "duration_working_days",
    "planned_work",
    "actual_work",
    "progress",
    "requires_acceptance",
    "source",
    "custom_fields",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  plan_versions: ["tenant_id", "project_id", "version", "updated_at"],
  project_calendars: [
    "id",
    "tenant_id",
    "project_id",
    "working_weekdays",
    "working_minutes_per_day",
    "created_at",
    "updated_at"
  ],
  resource_calendars: [
    "id",
    "tenant_id",
    "resource_id",
    "working_weekdays",
    "working_minutes_per_day",
    "created_at",
    "updated_at"
  ],
  calendar_exceptions: [
    "id",
    "tenant_id",
    "project_id",
    "calendar_id",
    "resource_id",
    "date",
    "working_minutes",
    "reason",
    "created_at",
    "updated_at"
  ],
  task_assignments: [
    "id",
    "tenant_id",
    "project_id",
    "task_id",
    "resource_id",
    "role",
    "units_permille",
    "work_minutes",
    "calendar_id"
  ],
  task_assignment_allocations: [
    "id",
    "tenant_id",
    "project_id",
    "assignment_id",
    "task_id",
    "resource_id",
    "date",
    "work_minutes",
    "created_at",
    "updated_at"
  ],
  task_dependencies: [
    "id",
    "tenant_id",
    "project_id",
    "predecessor_task_id",
    "successor_task_id",
    "type",
    "lag_minutes"
  ],
  project_baselines: ["id", "tenant_id", "project_id", "label", "captured_at"],
  project_baseline_tasks: [
    "tenant_id",
    "project_id",
    "baseline_id",
    "task_id",
    "planned_start",
    "planned_finish",
    "work_minutes"
  ],
  project_baseline_assignments: [
    "tenant_id",
    "project_id",
    "baseline_id",
    "assignment_id",
    "task_id",
    "resource_id",
    "work_minutes"
  ],
  resource_reservations: [
    "id",
    "tenant_id",
    "project_id",
    "resource_id",
    "start",
    "finish",
    "work_minutes",
    "reason"
  ],
  planning_scenario_runs: [
    "id",
    "tenant_id",
    "project_id",
    "plan_version",
    "engine_version",
    "target_conflict",
    "proposal_payload",
    "proposal_payload_hash",
    "actor_user_id",
    "expires_at",
    "applied_at",
    "created_at"
  ],
  planning_solver_runs: [
    "id",
    "tenant_id",
    "project_id",
    "mode",
    "client_plan_version",
    "engine_version",
    "input_snapshot_metadata",
    "target_deadline",
    "proposals",
    "proposal_payload_hash",
    "actor_user_id",
    "expires_at",
    "applied_proposal_id",
    "applied_at",
    "created_at"
  ],
  planning_command_idempotency_keys: [
    "tenant_id",
    "project_id",
    "idempotency_key",
    "request_hash",
    "response_payload",
    "actor_user_id",
    "created_at"
  ],
  kpi_definitions: [
    "id",
    "tenant_id",
    "entity_type",
    "code",
    "label",
    "formula",
    "unit",
    "period",
    "threshold_rules",
    "owner_role",
    "allowed_actions",
    "version",
    "status",
    "created_at",
    "updated_at"
  ],
  kpi_evaluations: [
    "id",
    "tenant_id",
    "project_id",
    "definition_id",
    "definition_version",
    "formula_version",
    "source_data",
    "period_start",
    "period_end",
    "threshold",
    "calculated_value",
    "severity",
    "evaluated_at"
  ],
  control_signals: [
    "id",
    "tenant_id",
    "project_id",
    "evaluation_id",
    "source_entity",
    "source_metric",
    "severity",
    "explanation",
    "owner_user_id",
    "allowed_actions",
    "scenario_proposals",
    "status",
    "created_at",
    "updated_at",
    "resolved_at"
  ],
  corrective_actions: [
    "id",
    "tenant_id",
    "project_id",
    "control_signal_id",
    "title",
    "description",
    "responsible_user_id",
    "due_date",
    "status",
    "result",
    "created_at",
    "updated_at"
  ],
  action_executions: [
    "id",
    "tenant_id",
    "project_id",
    "action_type",
    "target_entity",
    "actor_user_id",
    "input",
    "preview_payload",
    "result_payload",
    "status",
    "audit_event_id",
    "created_at"
  ],
  project_closure_snapshots: [
    "id",
    "tenant_id",
    "project_id",
    "project_status_before",
    "plan_version",
    "snapshot_payload",
    "plan_fact_summary",
    "closed_by_user_id",
    "closed_at",
    "close_reason",
    "audit_event_id"
  ],
  retrospective_lessons: [
    "id",
    "tenant_id",
    "project_id",
    "snapshot_id",
    "category",
    "title",
    "body",
    "impact",
    "created_by_user_id",
    "created_at"
  ],
  template_improvement_actions: [
    "id",
    "tenant_id",
    "project_id",
    "snapshot_id",
    "template_id",
    "status",
    "title",
    "description",
    "impact",
    "created_by_user_id",
    "applied_by_user_id",
    "created_at",
    "applied_at",
    "audit_event_id"
  ],
  control_surface_definitions: [
    "id",
    "tenant_id",
    "code",
    "name",
    "description",
    "owner_user_id",
    "status",
    "current_version",
    "draft_version",
    "draft_definition",
    "published_definition",
    "created_by_user_id",
    "updated_by_user_id",
    "created_at",
    "updated_at",
    "published_at",
    "archived_at"
  ],
  control_surface_versions: [
    "tenant_id",
    "surface_id",
    "version",
    "definition",
    "published_by_user_id",
    "audit_event_id",
    "created_at"
  ],
  tenant_production_calendars: [
    "tenant_id",
    "calendar_id",
    "working_weekdays",
    "working_minutes_per_day",
    "updated_at"
  ],
  tenant_production_calendar_exceptions: [
    "id",
    "tenant_id",
    "calendar_id",
    "resource_id",
    "date",
    "working_minutes",
    "reason",
    "created_at",
    "updated_at"
  ],
  planning_saved_views: [
    "id",
    "tenant_id",
    "project_id",
    "owner_user_id",
    "scope",
    "name",
    "payload",
    "created_at"
  ],
  resource_absences: [
    "id",
    "tenant_id",
    "user_id",
    "type",
    "date_from",
    "date_to",
    "status",
    "reason",
    "created_by",
    "approved_by",
    "created_at",
    "updated_at"
  ],
  resource_personal_calendars: [
    "id",
    "tenant_id",
    "user_id",
    "name",
    "timezone",
    "source_provider",
    "sync_status",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  resource_calendar_events: [
    "id",
    "tenant_id",
    "calendar_id",
    "user_id",
    "source_provider",
    "external_id",
    "title",
    "starts_at",
    "finishes_at",
    "work_minutes",
    "capacity_impact",
    "visibility",
    "metadata",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  tenant_org_nodes: [
    "id",
    "tenant_id",
    "track",
    "node_type",
    "name",
    "parent_id",
    "sort_order"
  ],
  tenant_user_org_placements: [
    "tenant_id",
    "user_id",
    "track",
    "direction_id",
    "department_id",
    "team_id",
    "position_id"
  ],
  file_assets: [
    "id",
    "tenant_id",
    "provider",
    "storage_key",
    "original_name",
    "safe_display_name",
    "mime_type",
    "size_bytes",
    "checksum_sha256",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at",
    "purged_at"
  ],
  external_references: [
    "id",
    "tenant_id",
    "connector_type",
    "external_id",
    "url",
    "title",
    "metadata",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  entity_attachments: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "asset_id",
    "external_reference_id",
    "relation_type",
    "source_activity_type",
    "source_activity_id",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  background_job_schedules: [
    "id",
    "tenant_id",
    "kind",
    "schedule_key",
    "payload",
    "interval_seconds",
    "enabled",
    "next_run_at",
    "last_enqueued_at",
    "created_at",
    "updated_at"
  ],
  background_job_runs: [
    "id",
    "tenant_id",
    "kind",
    "status",
    "priority",
    "payload",
    "idempotency_key",
    "attempt",
    "max_attempts",
    "run_after",
    "locked_by",
    "locked_at",
    "started_at",
    "finished_at",
    "last_error",
    "created_at",
    "updated_at"
  ],
  background_job_events: [
    "id",
    "tenant_id",
    "job_id",
    "event_type",
    "message",
    "metadata",
    "created_at"
  ],
  communication_channels: [
    "id",
    "tenant_id",
    "channel_type",
    "title",
    "description",
    "scope_entity_type",
    "scope_entity_id",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  communication_channel_members: [
    "tenant_id",
    "channel_id",
    "user_id",
    "role",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  conversations: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "conversation_type",
    "title",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  discussion_messages: [
    "id",
    "tenant_id",
    "conversation_id",
    "author_user_id",
    "body",
    "metadata",
    "created_at",
    "edited_at",
    "archived_at",
    "pinned_at",
    "pinned_by_user_id"
  ],
  message_reactions: [
    "id",
    "tenant_id",
    "message_id",
    "user_id",
    "emoji",
    "created_at",
    "archived_at"
  ],
  sticker_packs: [
    "id",
    "tenant_id",
    "title",
    "description",
    "source",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  sticker_assets: [
    "id",
    "tenant_id",
    "pack_id",
    "file_asset_id",
    "emoji",
    "title",
    "tags",
    "mime_type",
    "width",
    "height",
    "size_bytes",
    "checksum_sha256",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  message_stickers: [
    "tenant_id",
    "message_id",
    "sticker_asset_id",
    "created_by_user_id",
    "created_at"
  ],
  message_mentions: [
    "tenant_id",
    "message_id",
    "mentioned_user_id",
    "created_at"
  ],
  conversation_read_states: [
    "tenant_id",
    "conversation_id",
    "user_id",
    "last_read_message_id",
    "last_read_at",
    "unread_count"
  ],
  user_notifications: [
    "id",
    "tenant_id",
    "user_id",
    "notification_type",
    "source_entity_type",
    "source_entity_id",
    "title",
    "body",
    "route",
    "created_at",
    "read_at",
    "archived_at"
  ],
  notification_preferences: [
    "tenant_id",
    "user_id",
    "channel",
    "notification_type",
    "enabled",
    "digest_frequency"
  ],
  meetings: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "title",
    "agenda",
    "scheduled_start",
    "scheduled_finish",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  meeting_participants: [
    "tenant_id",
    "meeting_id",
    "user_id",
    "role",
    "response",
    "created_at"
  ],
  meeting_external_links: [
    "id",
    "tenant_id",
    "meeting_id",
    "provider",
    "url",
    "title",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  meeting_notes: [
    "id",
    "tenant_id",
    "meeting_id",
    "author_user_id",
    "body",
    "created_at",
    "edited_at",
    "archived_at"
  ],
  meeting_action_items: [
    "id",
    "tenant_id",
    "meeting_id",
    "title",
    "owner_user_id",
    "due_date",
    "target_entity_type",
    "target_entity_id",
    "status",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  call_rooms: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "meeting_id",
    "title",
    "media_kind",
    "provider",
    "provider_room_id",
    "status",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  call_sessions: [
    "id",
    "tenant_id",
    "room_id",
    "provider_session_id",
    "status",
    "started_by_user_id",
    "started_at",
    "ended_by_user_id",
    "ended_at",
    "failure_reason"
  ],
  call_participant_states: [
    "tenant_id",
    "room_id",
    "session_id",
    "user_id",
    "state",
    "joined_at",
    "left_at",
    "last_seen_at"
  ],
  call_events: [
    "id",
    "tenant_id",
    "room_id",
    "session_id",
    "event_type",
    "actor_user_id",
    "payload",
    "created_at"
  ],
  call_recordings: [
    "id",
    "tenant_id",
    "room_id",
    "session_id",
    "attachment_id",
    "title",
    "created_by_user_id",
    "created_at",
    "archived_at"
  ],
  knowledge_documents: [
    "id",
    "tenant_id",
    "project_id",
    "title",
    "summary",
    "document_type",
    "status",
    "current_version_id",
    "source_meeting_id",
    "approval_status",
    "approval_requested_by_user_id",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  knowledge_document_versions: [
    "id",
    "tenant_id",
    "document_id",
    "version_number",
    "title",
    "body",
    "summary",
    "change_reason",
    "created_by_user_id",
    "created_at"
  ],
  decision_log_entries: [
    "id",
    "tenant_id",
    "project_id",
    "title",
    "decision",
    "rationale",
    "status",
    "source_meeting_id",
    "document_id",
    "supersedes_decision_id",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  knowledge_action_items: [
    "id",
    "tenant_id",
    "project_id",
    "title",
    "description",
    "owner_user_id",
    "due_date",
    "status",
    "source_meeting_id",
    "document_id",
    "decision_id",
    "target_entity_type",
    "target_entity_id",
    "created_by_user_id",
    "created_at",
    "updated_at",
    "archived_at"
  ],
  task_participants: ["tenant_id", "task_id", "user_id", "role"],
  task_activities: [
    "id",
    "tenant_id",
    "task_id",
    "type",
    "body",
    "title",
    "file_url",
    "file_size_bytes",
    "mime_type",
    "author_user_id",
    "created_at",
    "updated_at"
  ],
  crm_activities: [
    "id",
    "tenant_id",
    "entity_type",
    "entity_id",
    "type",
    "title",
    "body",
    "status",
    "due_date",
    "assignee_user_id",
    "author_user_id",
    "file_url",
    "file_size_bytes",
    "mime_type",
    "created_at",
    "updated_at"
  ],
  tenant_users: [
    "id",
    "tenant_id",
    "access_profile_id",
    "position_id",
    "email",
    "name",
    "phone",
    "telegram",
    "status",
    "theme",
    "accent_color",
    "created_at"
  ],
  user_credentials: [
    "user_id",
    "tenant_id",
    "email",
    "password_hash",
    "password_salt",
    "created_at"
  ],
  user_sessions: [
    "id",
    "tenant_id",
    "user_id",
    "token_hash",
    "expires_at",
    "created_at"
  ],
  audit_events: [
    "id",
    "tenant_id",
    "actor_user_id",
    "action_type",
    "source_surface_id",
    "source_workflow",
    "source_entity",
    "input",
    "before_state",
    "after_state",
    "permission_result",
    "execution_result",
    "correlation_id",
    "created_at"
  ]
} as const satisfies Record<PersistenceTableName, readonly string[]>;

export function getPersistenceTableColumns(
  tableName: PersistenceTableName
): readonly string[] {
  return tableColumns[tableName];
}
