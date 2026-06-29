ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "user_agent" text;
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "ip_address" text;
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz;
--> statement-breakpoint
UPDATE "user_sessions" SET "last_seen_at" = "created_at" WHERE "last_seen_at" IS NULL;
