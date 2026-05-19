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
    sourceOpportunityId: text("source_opportunity_id").notNull(),
    clientId: text("client_id"),
    projectTypeId: text("project_type_id"),
    title: text("title").notNull(),
    clientName: text("client_name").notNull(),
    status: text("status").notNull(),
    plannedStart: timestamp("planned_start", { withTimezone: true }).notNull(),
    plannedFinish: timestamp("planned_finish", { withTimezone: true }).notNull(),
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
    index("projects_tenant_id_idx").on(table.tenantId),
    index("projects_status_idx").on(table.status)
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

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    stageId: text("stage_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("todo"),
    priority: text("priority").notNull().default("normal"),
    plannedStart: timestamp("planned_start", { withTimezone: true }).notNull(),
    plannedFinish: timestamp("planned_finish", { withTimezone: true }).notNull(),
    plannedWork: integer("planned_work").notNull(),
    actualWork: integer("actual_work").notNull().default(0),
    progress: integer("progress").notNull().default(0),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
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
    index("tasks_tenant_project_id_idx").on(table.tenantId, table.projectId),
    index("tasks_tenant_status_idx").on(table.tenantId, table.status)
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

export const opportunityActivities = pgTable(
  "opportunity_activities",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    type: text("type").notNull(),
    title: text("title"),
    body: text("body"),
    status: text("status"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    assigneeUserId: text("assignee_user_id"),
    authorUserId: text("author_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "opportunity_activities_pkey",
      columns: [table.tenantId, table.id]
    }),
    foreignKey({
      name: "opportunity_activities_opportunity_fk",
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [opportunities.tenantId, opportunities.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "opportunity_activities_author_user_fk",
      columns: [table.tenantId, table.authorUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "opportunity_activities_assignee_user_fk",
      columns: [table.tenantId, table.assigneeUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id]
    }).onDelete("restrict"),
    index("opportunity_activities_tenant_opportunity_created_idx").on(
      table.tenantId,
      table.opportunityId,
      table.createdAt
    ),
    index("opportunity_activities_tenant_assignee_idx").on(
      table.tenantId,
      table.assigneeUserId
    ),
    check(
      "opportunity_activities_type_chk",
      sql`${table.type} in ('comment', 'task')`
    ),
    check(
      "opportunity_activities_status_chk",
      sql`(
        (${table.type} = 'comment' and ${table.status} is null)
        or
        (${table.type} = 'task' and ${table.status} in ('todo', 'done') and ${table.title} is not null)
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
  | "project_types"
  | "deal_stages"
  | "opportunities"
  | "opportunity_demands"
  | "projects"
  | "project_position_demands"
  | "tasks"
  | "task_participants"
  | "opportunity_activities"
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
  "project_types",
  "deal_stages",
  "opportunities",
  "opportunity_demands",
  "projects",
  "project_position_demands",
  "tasks",
  "task_participants",
  "opportunity_activities",
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
  "project_types",
  "deal_stages",
  "opportunities",
  "opportunity_demands",
  "projects",
  "project_position_demands",
  "tasks",
  "task_participants",
  "opportunity_activities",
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
    "source_opportunity_id",
    "client_id",
    "project_type_id",
    "title",
    "client_name",
    "status",
    "planned_start",
    "planned_finish",
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
  tasks: [
    "id",
    "tenant_id",
    "project_id",
    "stage_id",
    "title",
    "description",
    "status",
    "priority",
    "planned_start",
    "planned_finish",
    "planned_work",
    "actual_work",
    "progress",
    "source",
    "created_at",
    "updated_at"
  ],
  task_participants: ["tenant_id", "task_id", "user_id", "role"],
  opportunity_activities: [
    "id",
    "tenant_id",
    "opportunity_id",
    "type",
    "title",
    "body",
    "status",
    "due_date",
    "assignee_user_id",
    "author_user_id",
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
