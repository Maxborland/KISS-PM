import {
  bigint,
  foreignKey,
  index,
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
