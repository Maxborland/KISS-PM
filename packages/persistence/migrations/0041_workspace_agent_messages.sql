CREATE TABLE IF NOT EXISTS "workspace_agent_messages" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "author_user_id" text NOT NULL,
  "focus_type" text,
  "focus_id" text,
  "body" text NOT NULL,
  "context" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "workspace_agent_messages_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "workspace_agent_messages_author_fk"
    FOREIGN KEY ("tenant_id", "author_user_id")
    REFERENCES "tenant_users"("tenant_id", "id")
    ON DELETE restrict,
  CONSTRAINT "workspace_agent_messages_focus_type_chk"
    CHECK ("focus_type" IS NULL OR "focus_type" IN ('project', 'task', 'deal')),
  CONSTRAINT "workspace_agent_messages_focus_pair_chk"
    CHECK (
      ("focus_type" IS NULL AND "focus_id" IS NULL)
      OR
      ("focus_type" IS NOT NULL AND "focus_id" IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS "workspace_agent_messages_context_created_idx"
  ON "workspace_agent_messages" (
    "tenant_id",
    "focus_type",
    "focus_id",
    "created_at",
    "id"
  );
