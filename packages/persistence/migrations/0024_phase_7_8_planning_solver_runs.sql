CREATE TABLE IF NOT EXISTS "planning_solver_runs" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "mode" text NOT NULL,
  "client_plan_version" integer NOT NULL,
  "engine_version" text NOT NULL,
  "input_snapshot_metadata" jsonb NOT NULL,
  "target_deadline" text,
  "proposals" jsonb NOT NULL,
  "proposal_payload_hash" text NOT NULL,
  "actor_user_id" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "applied_proposal_id" text,
  "applied_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "planning_solver_runs_pkey" PRIMARY KEY("tenant_id", "project_id", "id"),
  CONSTRAINT "planning_solver_runs_project_fk"
    FOREIGN KEY ("tenant_id", "project_id")
    REFERENCES "public"."projects"("tenant_id", "id")
    ON DELETE cascade,
  CONSTRAINT "planning_solver_runs_actor_fk"
    FOREIGN KEY ("tenant_id", "actor_user_id")
    REFERENCES "public"."tenant_users"("tenant_id", "id")
    ON DELETE restrict,
  CONSTRAINT "planning_solver_runs_mode_chk" CHECK ("mode" in ('schedule', 'repair'))
);

CREATE INDEX IF NOT EXISTS "planning_solver_runs_tenant_project_expires_idx"
  ON "planning_solver_runs" ("tenant_id", "project_id", "expires_at");
