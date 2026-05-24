CREATE TABLE IF NOT EXISTS "tenant_production_calendars" (
  "tenant_id" text NOT NULL,
  "calendar_id" text NOT NULL DEFAULT 'tenant-default',
  "working_weekdays" jsonb NOT NULL DEFAULT '[1,2,3,4,5]',
  "working_minutes_per_day" integer NOT NULL DEFAULT 480,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "tenant_production_calendars_pkey" PRIMARY KEY ("tenant_id"),
  CONSTRAINT "tenant_production_calendars_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "tenant_production_calendars_minutes_chk" CHECK ("working_minutes_per_day" >= 0)
);

CREATE TABLE IF NOT EXISTS "tenant_production_calendar_exceptions" (
  "tenant_id" text NOT NULL,
  "id" text NOT NULL,
  "calendar_id" text NOT NULL DEFAULT 'tenant-default',
  "resource_id" text,
  "date" text NOT NULL,
  "working_minutes" integer NOT NULL DEFAULT 0,
  "reason" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "tenant_production_calendar_exceptions_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "tenant_production_calendar_exceptions_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "tenant_production_calendar_exceptions_minutes_chk" CHECK ("working_minutes" >= 0)
);

CREATE INDEX IF NOT EXISTS "tenant_production_calendar_exceptions_date_idx"
  ON "tenant_production_calendar_exceptions" ("tenant_id", "date");
