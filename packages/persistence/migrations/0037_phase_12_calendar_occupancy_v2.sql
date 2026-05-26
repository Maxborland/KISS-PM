CREATE TABLE "resource_personal_calendars" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "timezone" text NOT NULL,
  "source_provider" text NOT NULL,
  "sync_status" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "resource_personal_calendars_pkey" PRIMARY KEY ("tenant_id","id"),
  CONSTRAINT "resource_personal_calendars_provider_chk" CHECK ("source_provider" IN ('manual', 'google', 'microsoft', 'caldav')),
  CONSTRAINT "resource_personal_calendars_sync_status_chk" CHECK ("sync_status" IN ('manual', 'connected', 'sync_failed', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "resource_calendar_events" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "calendar_id" text NOT NULL,
  "user_id" text NOT NULL,
  "source_provider" text NOT NULL,
  "external_id" text,
  "title" text,
  "starts_at" timestamp with time zone NOT NULL,
  "finishes_at" timestamp with time zone NOT NULL,
  "work_minutes" integer,
  "capacity_impact" text NOT NULL,
  "visibility" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "resource_calendar_events_pkey" PRIMARY KEY ("tenant_id","id"),
  CONSTRAINT "resource_calendar_events_provider_chk" CHECK ("source_provider" IN ('manual', 'google', 'microsoft', 'caldav')),
  CONSTRAINT "resource_calendar_events_capacity_impact_chk" CHECK ("capacity_impact" IN ('busy', 'unavailable', 'tentative')),
  CONSTRAINT "resource_calendar_events_visibility_chk" CHECK ("visibility" IN ('public', 'busy_only', 'private')),
  CONSTRAINT "resource_calendar_events_time_range_chk" CHECK ("finishes_at" > "starts_at"),
  CONSTRAINT "resource_calendar_events_work_minutes_chk" CHECK ("work_minutes" IS NULL OR "work_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "resource_personal_calendars"
  ADD CONSTRAINT "resource_personal_calendars_tenant_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "resource_personal_calendars"
  ADD CONSTRAINT "resource_personal_calendars_user_fk"
  FOREIGN KEY ("tenant_id","user_id") REFERENCES "tenant_users"("tenant_id","id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "resource_personal_calendars"
  ADD CONSTRAINT "resource_personal_calendars_created_by_fk"
  FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "tenant_users"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "resource_calendar_events"
  ADD CONSTRAINT "resource_calendar_events_tenant_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "resource_calendar_events"
  ADD CONSTRAINT "resource_calendar_events_calendar_fk"
  FOREIGN KEY ("tenant_id","calendar_id") REFERENCES "resource_personal_calendars"("tenant_id","id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "resource_calendar_events"
  ADD CONSTRAINT "resource_calendar_events_user_fk"
  FOREIGN KEY ("tenant_id","user_id") REFERENCES "tenant_users"("tenant_id","id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "resource_calendar_events"
  ADD CONSTRAINT "resource_calendar_events_created_by_fk"
  FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "tenant_users"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "resource_personal_calendars_tenant_user_idx"
  ON "resource_personal_calendars" ("tenant_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_personal_calendars_tenant_user_provider_uidx"
  ON "resource_personal_calendars" ("tenant_id","user_id","source_provider")
  WHERE "archived_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "resource_calendar_events_tenant_user_start_idx"
  ON "resource_calendar_events" ("tenant_id","user_id","starts_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "resource_calendar_events_external_uidx"
  ON "resource_calendar_events" ("tenant_id","calendar_id","source_provider","external_id")
  WHERE "external_id" IS NOT NULL AND "archived_at" IS NULL;
