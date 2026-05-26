ALTER TABLE "file_assets"
  ADD COLUMN IF NOT EXISTS "purged_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "file_assets_tenant_archived_purge_idx"
  ON "file_assets" ("tenant_id", "archived_at", "purged_at");

CREATE TABLE IF NOT EXISTS "background_job_schedules" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "kind" text NOT NULL,
  "schedule_key" text NOT NULL,
  "payload" jsonb NOT NULL,
  "interval_seconds" integer NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "next_run_at" timestamp with time zone NOT NULL,
  "last_enqueued_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "background_job_schedules_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "background_job_schedules_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE cascade,
  CONSTRAINT "background_job_schedules_kind_chk"
    CHECK ("kind" IN ('storage.asset_cleanup', 'notification.dispatch', 'connector.sync', 'search.projection_rebuild', 'capacity.cache_warmup')),
  CONSTRAINT "background_job_schedules_interval_chk"
    CHECK ("interval_seconds" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "background_job_schedules_tenant_key_uidx"
  ON "background_job_schedules" ("tenant_id", "schedule_key");
CREATE INDEX IF NOT EXISTS "background_job_schedules_due_idx"
  ON "background_job_schedules" ("tenant_id", "enabled", "next_run_at");

CREATE TABLE IF NOT EXISTS "background_job_runs" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "priority" integer NOT NULL DEFAULT 0,
  "payload" jsonb NOT NULL,
  "idempotency_key" text,
  "attempt" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "run_after" timestamp with time zone NOT NULL,
  "locked_by" text,
  "locked_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "background_job_runs_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "background_job_runs_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE cascade,
  CONSTRAINT "background_job_runs_kind_chk"
    CHECK ("kind" IN ('storage.asset_cleanup', 'notification.dispatch', 'connector.sync', 'search.projection_rebuild', 'capacity.cache_warmup')),
  CONSTRAINT "background_job_runs_status_chk"
    CHECK ("status" IN ('queued', 'running', 'succeeded', 'dead', 'cancelled')),
  CONSTRAINT "background_job_runs_attempt_chk" CHECK ("attempt" >= 0),
  CONSTRAINT "background_job_runs_max_attempts_chk"
    CHECK ("max_attempts" >= 1 AND "max_attempts" <= 25),
  CONSTRAINT "background_job_runs_priority_chk"
    CHECK ("priority" >= -100 AND "priority" <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS "background_job_runs_tenant_idempotency_uidx"
  ON "background_job_runs" ("tenant_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "background_job_runs_claim_idx"
  ON "background_job_runs" ("status", "run_after", "priority", "created_at");
CREATE INDEX IF NOT EXISTS "background_job_runs_tenant_status_idx"
  ON "background_job_runs" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "background_job_events" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "job_id" text NOT NULL,
  "event_type" text NOT NULL,
  "message" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "background_job_events_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "background_job_events_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE cascade,
  CONSTRAINT "background_job_events_job_fk"
    FOREIGN KEY ("tenant_id", "job_id") REFERENCES "background_job_runs" ("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "background_job_events_type_chk"
    CHECK ("event_type" IN ('enqueued', 'claimed', 'succeeded', 'failed', 'retry_scheduled', 'dead', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS "background_job_events_tenant_job_idx"
  ON "background_job_events" ("tenant_id", "job_id");
