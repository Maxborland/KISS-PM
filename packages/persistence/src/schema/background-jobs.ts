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
import { tenants } from "./core";

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
