import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp
} from "drizzle-orm/pg-core";
import { tenants } from "./core";
import type { AuditSourceEntity } from "./table-registry";

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
