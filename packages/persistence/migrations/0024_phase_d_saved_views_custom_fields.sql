ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "custom_fields" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "planning_saved_views" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "scope" text NOT NULL DEFAULT 'user',
  "name" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "planning_saved_views_pkey" PRIMARY KEY ("tenant_id", "project_id", "id"),
  CONSTRAINT "planning_saved_views_project_fk"
    FOREIGN KEY ("tenant_id", "project_id")
    REFERENCES "public"."projects"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "planning_saved_views_scope_chk" CHECK ("scope" in ('user', 'project'))
);

CREATE INDEX IF NOT EXISTS "planning_saved_views_owner_idx"
  ON "planning_saved_views" ("tenant_id", "project_id", "owner_user_id");
