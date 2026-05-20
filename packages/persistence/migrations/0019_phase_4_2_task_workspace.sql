CREATE TABLE IF NOT EXISTS "task_statuses" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "sort_order" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "task_statuses_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "task_statuses_category_chk" CHECK ("category" in ('new', 'waiting', 'in_progress', 'review', 'done')),
  CONSTRAINT "task_statuses_status_chk" CHECK ("status" in ('active', 'archived'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_statuses_tenant_id_idx" ON "task_statuses" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_statuses_tenant_sort_order_uidx" ON "task_statuses" USING btree ("tenant_id","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_statuses_tenant_name_uidx" ON "task_statuses" USING btree ("tenant_id","name");
--> statement-breakpoint
INSERT INTO "task_statuses" ("id","tenant_id","name","category","sort_order","status","is_system","created_at","updated_at")
SELECT 'task-status-new', "id", 'Новая', 'new', 10, 'active', true, now(), now() FROM "tenants"
ON CONFLICT ("tenant_id","id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "task_statuses" ("id","tenant_id","name","category","sort_order","status","is_system","created_at","updated_at")
SELECT 'task-status-waiting', "id", 'Ожидает', 'waiting', 20, 'active', false, now(), now() FROM "tenants"
ON CONFLICT ("tenant_id","id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "task_statuses" ("id","tenant_id","name","category","sort_order","status","is_system","created_at","updated_at")
SELECT 'task-status-in-progress', "id", 'В работе', 'in_progress', 30, 'active', false, now(), now() FROM "tenants"
ON CONFLICT ("tenant_id","id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "task_statuses" ("id","tenant_id","name","category","sort_order","status","is_system","created_at","updated_at")
SELECT 'task-status-review', "id", 'На контроле', 'review', 40, 'active', false, now(), now() FROM "tenants"
ON CONFLICT ("tenant_id","id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "task_statuses" ("id","tenant_id","name","category","sort_order","status","is_system","created_at","updated_at")
SELECT 'task-status-done', "id", 'Выполнено', 'done', 50, 'active', true, now(), now() FROM "tenants"
ON CONFLICT ("tenant_id","id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "status_id" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "requester_user_id" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "owner_user_id" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "duration_working_days" integer;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "requires_acceptance" boolean;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "tasks"
SET
  "status" = CASE
    WHEN "status" = 'todo' THEN 'new'
    WHEN "status" = 'blocked' THEN 'waiting'
    WHEN "status" = 'in_progress' THEN 'in_progress'
    WHEN "status" = 'done' THEN 'done'
    ELSE "status"
  END,
  "status_id" = CASE
    WHEN "status" = 'todo' THEN 'task-status-new'
    WHEN "status" = 'blocked' THEN 'task-status-waiting'
    WHEN "status" = 'in_progress' THEN 'task-status-in-progress'
    WHEN "status" = 'done' THEN 'task-status-done'
    ELSE COALESCE("status_id", 'task-status-new')
  END,
  "requester_user_id" = COALESCE(
    "requester_user_id",
    (
      SELECT "user_id"
      FROM "task_participants"
      WHERE "task_participants"."tenant_id" = "tasks"."tenant_id"
        AND "task_participants"."task_id" = "tasks"."id"
        AND "task_participants"."role" = 'requester'
      LIMIT 1
    ),
    (
      SELECT "user_id"
      FROM "task_participants"
      WHERE "task_participants"."tenant_id" = "tasks"."tenant_id"
        AND "task_participants"."task_id" = "tasks"."id"
      LIMIT 1
    )
  ),
  "owner_user_id" = COALESCE(
    "owner_user_id",
    (
      SELECT "user_id"
      FROM "task_participants"
      WHERE "task_participants"."tenant_id" = "tasks"."tenant_id"
        AND "task_participants"."task_id" = "tasks"."id"
        AND "task_participants"."role" = 'executor'
      LIMIT 1
    ),
    (
      SELECT "user_id"
      FROM "task_participants"
      WHERE "task_participants"."tenant_id" = "tasks"."tenant_id"
        AND "task_participants"."task_id" = "tasks"."id"
      LIMIT 1
    )
  ),
  "duration_working_days" = COALESCE("duration_working_days", 1),
  "requires_acceptance" = COALESCE("requires_acceptance", false);
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'new';
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status_id" SET DEFAULT 'task-status-new';
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "duration_working_days" SET DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "requires_acceptance" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "requester_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "owner_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "duration_working_days" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "requires_acceptance" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_fk" FOREIGN KEY ("tenant_id","status_id") REFERENCES "public"."task_statuses"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_requester_user_fk" FOREIGN KEY ("tenant_id","requester_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_user_fk" FOREIGN KEY ("tenant_id","owner_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_tenant_status_id_idx" ON "tasks" USING btree ("tenant_id","status_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_tenant_owner_idx" ON "tasks" USING btree ("tenant_id","owner_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_activities" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "task_id" text NOT NULL,
  "type" text NOT NULL,
  "body" text,
  "title" text,
  "file_url" text,
  "file_size_bytes" integer,
  "mime_type" text,
  "author_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "task_activities_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "task_activities_type_chk" CHECK ("type" in ('comment', 'file')),
  CONSTRAINT "task_activities_payload_chk" CHECK (
    ("type" = 'comment' and "body" is not null)
    or
    ("type" = 'file' and "title" is not null and "file_url" is not null)
  )
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_fk" FOREIGN KEY ("tenant_id","task_id") REFERENCES "public"."tasks"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_author_user_fk" FOREIGN KEY ("tenant_id","author_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_activities_tenant_task_created_idx" ON "task_activities" USING btree ("tenant_id","task_id","created_at");
