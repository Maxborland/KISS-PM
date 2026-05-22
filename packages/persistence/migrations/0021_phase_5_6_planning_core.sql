ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "source_type" text NOT NULL DEFAULT 'opportunity';
ALTER TABLE "projects" ALTER COLUMN "source_opportunity_id" DROP NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "deadline" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "calendar_id" text;

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_source_type_chk";
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_source_type_chk"
  CHECK ("source_type" in ('opportunity', 'workspace_inbox', 'manual'));

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_source_opportunity_chk";
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_source_opportunity_chk"
  CHECK (
    ("source_type" = 'opportunity' and "source_opportunity_id" is not null)
    or
    ("source_type" <> 'opportunity' and "source_opportunity_id" is null)
  );

CREATE UNIQUE INDEX IF NOT EXISTS "projects_tenant_workspace_inbox_uidx"
  ON "projects" ("tenant_id", "source_type")
  WHERE "source_type" = 'workspace_inbox' and "status" in ('draft', 'active', 'paused');

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "planned_start_minute" integer NOT NULL DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "planned_finish_minute" integer NOT NULL DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "wbs_code" text NOT NULL DEFAULT '1';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scheduling_mode" text NOT NULL DEFAULT 'auto';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "task_type" text NOT NULL DEFAULT 'fixed_units';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "effort_driven" boolean NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "duration_minutes" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "work_minutes" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "constraint_type" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "constraint_date" timestamp with time zone;

UPDATE "tasks"
SET
  "duration_minutes" = coalesce("duration_minutes", greatest("duration_working_days", 1) * 480),
  "work_minutes" = coalesce("work_minutes", greatest("planned_work", 0) * 60);

CREATE UNIQUE INDEX IF NOT EXISTS "tasks_tenant_project_id_id_uidx"
  ON "tasks" ("tenant_id", "project_id", "id");

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_scheduling_mode_chk";
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_scheduling_mode_chk"
  CHECK ("scheduling_mode" in ('auto', 'manual'));

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_task_type_chk";
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_task_type_chk"
  CHECK ("task_type" in ('fixed_units', 'fixed_work', 'fixed_duration'));

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_constraint_type_chk";
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_constraint_type_chk"
  CHECK (
    "constraint_type" is null
    or "constraint_type" in (
      'as_soon_as_possible',
      'start_no_earlier_than',
      'finish_no_later_than',
      'must_start_on',
      'must_finish_on'
    )
  );

CREATE TABLE IF NOT EXISTS "plan_versions" (
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "plan_versions_pkey" PRIMARY KEY("tenant_id", "project_id"),
  CONSTRAINT "plan_versions_project_fk"
    FOREIGN KEY ("tenant_id", "project_id")
    REFERENCES "public"."projects"("tenant_id", "id")
    ON DELETE cascade,
  CONSTRAINT "plan_versions_version_chk" CHECK ("version" > 0)
);

CREATE TABLE IF NOT EXISTS "project_calendars" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "working_weekdays" jsonb NOT NULL,
  "working_minutes_per_day" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "project_calendars_pkey" PRIMARY KEY("tenant_id", "project_id", "id"),
  CONSTRAINT "project_calendars_project_fk"
    FOREIGN KEY ("tenant_id", "project_id")
    REFERENCES "public"."projects"("tenant_id", "id")
    ON DELETE cascade,
  CONSTRAINT "project_calendars_minutes_chk" CHECK ("working_minutes_per_day" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_calendars_tenant_id_id_uidx"
  ON "project_calendars" ("tenant_id", "id");

CREATE TABLE IF NOT EXISTS "resource_calendars" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "resource_id" text NOT NULL,
  "working_weekdays" jsonb NOT NULL,
  "working_minutes_per_day" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "resource_calendars_pkey" PRIMARY KEY("tenant_id", "resource_id", "id"),
  CONSTRAINT "resource_calendars_resource_fk"
    FOREIGN KEY ("tenant_id", "resource_id")
    REFERENCES "public"."tenant_users"("tenant_id", "id")
    ON DELETE cascade,
  CONSTRAINT "resource_calendars_minutes_chk" CHECK ("working_minutes_per_day" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "resource_calendars_tenant_id_id_uidx"
  ON "resource_calendars" ("tenant_id", "id");

CREATE TABLE IF NOT EXISTS "calendar_exceptions" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "calendar_id" text NOT NULL,
  "resource_id" text,
  "date" text NOT NULL,
  "working_minutes" integer NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "calendar_exceptions_pkey" PRIMARY KEY("tenant_id", "project_id", "id"),
  CONSTRAINT "calendar_exceptions_project_fk"
    FOREIGN KEY ("tenant_id", "project_id")
    REFERENCES "public"."projects"("tenant_id", "id")
    ON DELETE cascade,
  CONSTRAINT "calendar_exceptions_minutes_chk" CHECK ("working_minutes" >= 0)
);

CREATE INDEX IF NOT EXISTS "calendar_exceptions_tenant_calendar_date_idx"
  ON "calendar_exceptions" ("tenant_id", "calendar_id", "date");

CREATE TABLE IF NOT EXISTS "task_assignments" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "task_id" text NOT NULL,
  "resource_id" text NOT NULL,
  "role" text NOT NULL,
  "units_permille" integer NOT NULL,
  "work_minutes" integer,
  "calendar_id" text,
  CONSTRAINT "task_assignments_pkey" PRIMARY KEY("tenant_id", "project_id", "id"),
  CONSTRAINT "task_assignments_task_fk"
    FOREIGN KEY ("tenant_id", "project_id", "task_id")
    REFERENCES "public"."tasks"("tenant_id", "project_id", "id")
    ON DELETE cascade,
  CONSTRAINT "task_assignments_resource_fk"
    FOREIGN KEY ("tenant_id", "resource_id")
    REFERENCES "public"."tenant_users"("tenant_id", "id")
    ON DELETE restrict,
  CONSTRAINT "task_assignments_role_chk"
    CHECK ("role" in ('executor', 'co_executor', 'controller', 'approver', 'observer')),
  CONSTRAINT "task_assignments_units_chk" CHECK ("units_permille" > 0)
);

CREATE INDEX IF NOT EXISTS "task_assignments_tenant_project_task_idx"
  ON "task_assignments" ("tenant_id", "project_id", "task_id");

CREATE TABLE IF NOT EXISTS "task_dependencies" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "predecessor_task_id" text NOT NULL,
  "successor_task_id" text NOT NULL,
  "type" text NOT NULL,
  "lag_minutes" integer NOT NULL DEFAULT 0,
  CONSTRAINT "task_dependencies_pkey" PRIMARY KEY("tenant_id", "project_id", "id"),
  CONSTRAINT "task_dependencies_predecessor_fk"
    FOREIGN KEY ("tenant_id", "project_id", "predecessor_task_id")
    REFERENCES "public"."tasks"("tenant_id", "project_id", "id")
    ON DELETE cascade,
  CONSTRAINT "task_dependencies_successor_fk"
    FOREIGN KEY ("tenant_id", "project_id", "successor_task_id")
    REFERENCES "public"."tasks"("tenant_id", "project_id", "id")
    ON DELETE cascade,
  CONSTRAINT "task_dependencies_type_chk" CHECK ("type" in ('FS', 'SS', 'FF', 'SF')),
  CONSTRAINT "task_dependencies_not_self_chk" CHECK ("predecessor_task_id" <> "successor_task_id")
);

CREATE INDEX IF NOT EXISTS "task_dependencies_tenant_project_successor_idx"
  ON "task_dependencies" ("tenant_id", "project_id", "successor_task_id");

CREATE TABLE IF NOT EXISTS "project_baselines" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "label" text NOT NULL,
  "captured_at" timestamp with time zone NOT NULL,
  CONSTRAINT "project_baselines_pkey" PRIMARY KEY("tenant_id", "project_id", "id"),
  CONSTRAINT "project_baselines_project_fk"
    FOREIGN KEY ("tenant_id", "project_id")
    REFERENCES "public"."projects"("tenant_id", "id")
    ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "project_baseline_tasks" (
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "baseline_id" text NOT NULL,
  "task_id" text NOT NULL,
  "planned_start" text,
  "planned_finish" text,
  "work_minutes" integer NOT NULL,
  CONSTRAINT "project_baseline_tasks_pkey"
    PRIMARY KEY("tenant_id", "project_id", "baseline_id", "task_id"),
  CONSTRAINT "project_baseline_tasks_baseline_fk"
    FOREIGN KEY ("tenant_id", "project_id", "baseline_id")
    REFERENCES "public"."project_baselines"("tenant_id", "project_id", "id")
    ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "project_baseline_assignments" (
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "baseline_id" text NOT NULL,
  "assignment_id" text NOT NULL,
  "task_id" text NOT NULL,
  "resource_id" text NOT NULL,
  "work_minutes" integer,
  CONSTRAINT "project_baseline_assignments_pkey"
    PRIMARY KEY("tenant_id", "project_id", "baseline_id", "assignment_id"),
  CONSTRAINT "project_baseline_assignments_baseline_fk"
    FOREIGN KEY ("tenant_id", "project_id", "baseline_id")
    REFERENCES "public"."project_baselines"("tenant_id", "project_id", "id")
    ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "resource_reservations" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "resource_id" text NOT NULL,
  "start" text NOT NULL,
  "finish" text NOT NULL,
  "work_minutes" integer NOT NULL,
  "reason" text,
  CONSTRAINT "resource_reservations_pkey" PRIMARY KEY("tenant_id", "project_id", "id"),
  CONSTRAINT "resource_reservations_project_fk"
    FOREIGN KEY ("tenant_id", "project_id")
    REFERENCES "public"."projects"("tenant_id", "id")
    ON DELETE cascade,
  CONSTRAINT "resource_reservations_resource_fk"
    FOREIGN KEY ("tenant_id", "resource_id")
    REFERENCES "public"."tenant_users"("tenant_id", "id")
    ON DELETE restrict,
  CONSTRAINT "resource_reservations_work_chk" CHECK ("work_minutes" >= 0)
);

CREATE TABLE IF NOT EXISTS "planning_scenario_runs" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "plan_version" integer NOT NULL,
  "engine_version" text NOT NULL,
  "target_conflict" jsonb NOT NULL,
  "proposal_payload" jsonb NOT NULL,
  "proposal_payload_hash" text NOT NULL,
  "actor_user_id" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "applied_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "planning_scenario_runs_pkey" PRIMARY KEY("tenant_id", "project_id", "id"),
  CONSTRAINT "planning_scenario_runs_project_fk"
    FOREIGN KEY ("tenant_id", "project_id")
    REFERENCES "public"."projects"("tenant_id", "id")
    ON DELETE cascade,
  CONSTRAINT "planning_scenario_runs_actor_fk"
    FOREIGN KEY ("tenant_id", "actor_user_id")
    REFERENCES "public"."tenant_users"("tenant_id", "id")
    ON DELETE restrict
);

CREATE INDEX IF NOT EXISTS "planning_scenario_runs_tenant_project_expires_idx"
  ON "planning_scenario_runs" ("tenant_id", "project_id", "expires_at");
