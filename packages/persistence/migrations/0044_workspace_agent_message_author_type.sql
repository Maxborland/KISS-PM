ALTER TABLE "workspace_agent_messages"
  ADD COLUMN IF NOT EXISTS "author_type" text NOT NULL DEFAULT 'user';

ALTER TABLE "workspace_agent_messages"
  DROP CONSTRAINT IF EXISTS "workspace_agent_messages_author_type_chk";

ALTER TABLE "workspace_agent_messages"
  ADD CONSTRAINT "workspace_agent_messages_author_type_chk"
  CHECK ("author_type" IN ('user', 'agent'));
