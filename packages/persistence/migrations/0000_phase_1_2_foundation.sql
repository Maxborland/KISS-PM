CREATE TABLE "access_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"action_type" text NOT NULL,
	"source_surface_id" text,
	"source_workflow" text,
	"source_entity" jsonb NOT NULL,
	"input" jsonb NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"permission_result" jsonb NOT NULL,
	"execution_result" jsonb NOT NULL,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"access_profile_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_profiles_tenant_id_idx" ON "access_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_profiles_tenant_id_id_uidx" ON "access_profiles" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_access_profile_same_tenant_fk" FOREIGN KEY ("tenant_id","access_profile_id") REFERENCES "public"."access_profiles"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_tenant_id_idx" ON "audit_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_events_correlation_id_idx" ON "audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "tenant_users_tenant_id_idx" ON "tenant_users" USING btree ("tenant_id");
