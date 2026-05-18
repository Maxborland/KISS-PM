CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "position_id" text;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "email" text;--> statement-breakpoint
UPDATE "tenant_users"
SET "email" = concat("id", '@kiss-pm.local')
WHERE "email" IS NULL;--> statement-breakpoint
ALTER TABLE "tenant_users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "telegram" text;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "theme" text DEFAULT 'light' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "accent_color" text DEFAULT '#0f766e' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_users_tenant_id_id_uidx" ON "tenant_users" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "positions_tenant_id_idx" ON "positions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_tenant_id_id_uidx" ON "positions" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_tenant_id_name_uidx" ON "positions" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_credentials_email_uidx" ON "user_credentials" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_hash_uidx" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_position_same_tenant_fk" FOREIGN KEY ("tenant_id","position_id") REFERENCES "public"."positions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_users_tenant_id_email_uidx" ON "tenant_users" USING btree ("tenant_id","email");
