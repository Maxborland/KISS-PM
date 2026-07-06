import {
  foreignKey,
  index,
  integer,
  check,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { positions, tenants } from "./core";
import { clients, opportunities, projectTypes } from "./crm";

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
