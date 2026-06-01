CREATE TABLE IF NOT EXISTS "workspace_agent_proposals" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "actor_user_id" text NOT NULL,
  "message_id" text NOT NULL,
  "action_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "focus_type" text,
  "focus_id" text,
  "context" jsonb NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text NOT NULL,
  "audit_event_id" text,
  "created_at" timestamp with time zone NOT NULL,
  "resolved_at" timestamp with time zone,
  CONSTRAINT "workspace_agent_proposals_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "workspace_agent_proposals_actor_fk"
    FOREIGN KEY ("tenant_id", "actor_user_id")
    REFERENCES "tenant_users"("tenant_id", "id")
    ON DELETE restrict,
  CONSTRAINT "workspace_agent_proposals_message_fk"
    FOREIGN KEY ("tenant_id", "message_id")
    REFERENCES "workspace_agent_messages"("tenant_id", "id")
    ON DELETE cascade,
  CONSTRAINT "workspace_agent_proposals_focus_type_chk"
    CHECK ("focus_type" IS NULL OR "focus_type" IN ('project', 'task', 'deal')),
  CONSTRAINT "workspace_agent_proposals_focus_pair_chk"
    CHECK (
      ("focus_type" IS NULL AND "focus_id" IS NULL)
      OR
      ("focus_type" IS NOT NULL AND "focus_id" IS NOT NULL)
    ),
  CONSTRAINT "workspace_agent_proposals_status_chk"
    CHECK ("status" IN ('proposed', 'applied', 'rejected'))
);

CREATE INDEX IF NOT EXISTS "workspace_agent_proposals_context_created_idx"
  ON "workspace_agent_proposals" (
    "tenant_id",
    "focus_type",
    "focus_id",
    "created_at",
    "id"
  );
