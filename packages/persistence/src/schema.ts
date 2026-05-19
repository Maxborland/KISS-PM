import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

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

export const opportunities = pgTable(
  "opportunities",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "opportunities_pkey",
      columns: [table.tenantId, table.id]
    }),
    index("opportunities_tenant_id_idx").on(table.tenantId),
    index("opportunities_status_idx").on(table.status)
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
    title: text("title").notNull(),
    clientName: text("client_name").notNull(),
    status: text("status").notNull(),
    plannedStart: timestamp("planned_start", { withTimezone: true }).notNull(),
    plannedFinish: timestamp("planned_finish", { withTimezone: true }).notNull(),
    contractValue: integer("contract_value").notNull(),
    plannedHours: integer("planned_hours").notNull(),
    templateId: text("template_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }).notNull()
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
  | "opportunities"
  | "opportunity_demands"
  | "projects"
  | "project_position_demands"
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
  "opportunities",
  "opportunity_demands",
  "projects",
  "project_position_demands",
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
  "opportunities",
  "opportunity_demands",
  "projects",
  "project_position_demands",
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
  opportunities: [
    "id",
    "tenant_id",
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
