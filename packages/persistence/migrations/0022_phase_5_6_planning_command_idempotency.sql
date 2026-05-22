CREATE TABLE IF NOT EXISTS "planning_command_idempotency_keys" (
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "response_payload" jsonb NOT NULL,
  "actor_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "planning_command_idempotency_keys_pkey"
    PRIMARY KEY("tenant_id", "project_id", "idempotency_key"),
  CONSTRAINT "planning_command_idempotency_keys_project_fk"
    FOREIGN KEY ("tenant_id", "project_id")
    REFERENCES "public"."projects"("tenant_id", "id")
    ON DELETE cascade,
  CONSTRAINT "planning_command_idempotency_keys_actor_fk"
    FOREIGN KEY ("tenant_id", "actor_user_id")
    REFERENCES "public"."tenant_users"("tenant_id", "id")
    ON DELETE restrict
);

CREATE INDEX IF NOT EXISTS "planning_command_idempotency_keys_tenant_project_created_idx"
  ON "planning_command_idempotency_keys" ("tenant_id", "project_id", "created_at");
