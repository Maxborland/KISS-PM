import {
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
    activatedAt: timestamp("activated_at", { withTimezone: true })
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
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: text("checksum_sha256"),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
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
      sql`${table.entityType} in ('opportunity', 'client', 'contact', 'product', 'project', 'task')`
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
  | "control_surface_definitions"
  | "control_surface_versions"
  | "tenant_production_calendars"
  | "tenant_production_calendar_exceptions"
  | "planning_saved_views"
  | "resource_absences"
  | "tenant_org_nodes"
  | "tenant_user_org_placements"
  | "file_assets"
  | "external_references"
  | "entity_attachments"
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
  "control_surface_definitions",
  "control_surface_versions",
  "tenant_production_calendars",
  "tenant_production_calendar_exceptions",
  "planning_saved_views",
  "resource_absences",
  "tenant_org_nodes",
  "tenant_user_org_placements",
  "file_assets",
  "external_references",
  "entity_attachments",
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
  "control_surface_definitions",
  "control_surface_versions",
  "tenant_production_calendars",
  "tenant_production_calendar_exceptions",
  "planning_saved_views",
  "resource_absences",
  "tenant_org_nodes",
  "tenant_user_org_placements",
  "file_assets",
  "external_references",
  "entity_attachments",
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
    "activated_at"
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
    "archived_at"
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
