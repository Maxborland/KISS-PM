CREATE TABLE IF NOT EXISTS "write_flow_idempotency_keys" (
  "tenant_id" text NOT NULL,
  "surface" text NOT NULL,
  "actor_user_id" text NOT NULL,
  "client_request_id" text NOT NULL,
  "resource_id" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  CONSTRAINT "write_flow_idempotency_keys_pkey" PRIMARY KEY ("tenant_id", "surface", "actor_user_id", "client_request_id"),
  CONSTRAINT "write_flow_idempotency_keys_actor_fk" FOREIGN KEY ("tenant_id", "actor_user_id") REFERENCES "tenant_users" ("tenant_id", "id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "write_flow_idempotency_keys_tenant_created_idx"
  ON "write_flow_idempotency_keys" ("tenant_id", "created_at");