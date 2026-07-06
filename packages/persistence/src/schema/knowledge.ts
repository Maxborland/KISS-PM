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
import { meetings } from "./communications";
import { tenantUsers, tenants } from "./core";
import { projects } from "./projects";

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
