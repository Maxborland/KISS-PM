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
import { positions, tenantUsers, tenants } from "./core";

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

export const tenantSecurityPolicies = pgTable(
  "tenant_security_policies",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    twoFactorRequired: boolean("two_factor_required").notNull().default(false),
    sessionTimeoutHours: integer("session_timeout_hours").notNull().default(24),
    ssoSamlEnabled: boolean("sso_saml_enabled").notNull().default(false),
    domainAllowlist: jsonb("domain_allowlist").$type<string[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      name: "tenant_security_policies_pkey",
      columns: [table.tenantId]
    }),
    check(
      "tenant_security_policies_timeout_chk",
      sql`${table.sessionTimeoutHours} >= 1`
    )
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
