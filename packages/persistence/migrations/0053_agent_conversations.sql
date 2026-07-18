ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_entity_type_chk";
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_entity_type_chk" CHECK ("entity_type" in ('project', 'task', 'opportunity', 'client', 'contact', 'product', 'communication_channel', 'direct', 'agent'));
--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_type_chk";
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_type_chk" CHECK ("conversation_type" in ('default', 'meeting_followup', 'direct', 'agent'));
