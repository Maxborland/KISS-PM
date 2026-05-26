CREATE TABLE IF NOT EXISTS "task_assignment_allocations" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "assignment_id" text NOT NULL,
  "task_id" text NOT NULL,
  "resource_id" text NOT NULL,
  "date" text NOT NULL,
  "work_minutes" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "task_assignment_allocations_pkey"
    PRIMARY KEY("tenant_id", "project_id", "id"),
  CONSTRAINT "task_assignment_allocations_assignment_fk"
    FOREIGN KEY ("tenant_id", "project_id", "assignment_id")
    REFERENCES "public"."task_assignments"("tenant_id", "project_id", "id")
    ON DELETE cascade,
  CONSTRAINT "task_assignment_allocations_minutes_chk"
    CHECK ("work_minutes" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_assignment_allocations_assignment_date_uidx"
  ON "task_assignment_allocations" ("tenant_id", "project_id", "assignment_id", "date");

CREATE INDEX IF NOT EXISTS "task_assignment_allocations_tenant_project_task_idx"
  ON "task_assignment_allocations" ("tenant_id", "project_id", "task_id");

CREATE INDEX IF NOT EXISTS "task_assignment_allocations_tenant_project_resource_date_idx"
  ON "task_assignment_allocations" ("tenant_id", "project_id", "resource_id", "date");
