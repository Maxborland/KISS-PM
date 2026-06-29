ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_entity_type_chk";
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_entity_type_chk" CHECK ("entity_type" in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel', 'direct'));
--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_type_chk";
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_type_chk" CHECK ("conversation_type" in ('default', 'meeting_followup', 'direct'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_members" (
  "tenant_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("tenant_id", "conversation_id", "user_id"),
  CONSTRAINT "conversation_members_conversation_fk" FOREIGN KEY ("tenant_id", "conversation_id") REFERENCES "conversations"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "conversation_members_user_fk" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "tenant_users"("tenant_id", "id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_members_user_idx" ON "conversation_members" ("tenant_id", "user_id");
