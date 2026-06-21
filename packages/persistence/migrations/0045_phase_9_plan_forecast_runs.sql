CREATE TABLE IF NOT EXISTS "planning_forecast_runs" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "client_plan_version" integer NOT NULL,
  "engine_version" text NOT NULL,
  "health" text NOT NULL,
  "manager_summary" text NOT NULL,
  "risk_drivers" jsonb NOT NULL,
  "recommendations" jsonb NOT NULL,
  "engine_metadata" jsonb NOT NULL,
  "engine_debug" jsonb,
  "actor_user_id" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "planning_forecast_runs_pkey" PRIMARY KEY("tenant_id","project_id","id"),
  CONSTRAINT "planning_forecast_runs_project_fk"
    FOREIGN KEY("tenant_id","project_id")
    REFERENCES "projects"("tenant_id","id")
    ON DELETE CASCADE,
  CONSTRAINT "planning_forecast_runs_actor_fk"
    FOREIGN KEY("tenant_id","actor_user_id")
    REFERENCES "tenant_users"("tenant_id","id")
    ON DELETE RESTRICT,
  CONSTRAINT "planning_forecast_runs_health_chk"
    CHECK("health" in ('stable', 'watch', 'needs_decision', 'unstable', 'blocked')),
  CONSTRAINT "planning_forecast_runs_client_plan_version_chk"
    CHECK("client_plan_version" > 0)
);

CREATE INDEX IF NOT EXISTS "planning_forecast_runs_tenant_project_expires_idx"
  ON "planning_forecast_runs" ("tenant_id","project_id","expires_at");
