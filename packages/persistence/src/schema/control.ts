import {
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
import { tenantUsers, tenants } from "./core";
import { projects } from "./projects";
import { projectTemplates } from "./workspace-config";
import type { AuditSourceEntity } from "./table-registry";

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
