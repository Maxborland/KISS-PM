CREATE TABLE "custom_field_definitions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"system_key" text NOT NULL,
	"tenant_label" text NOT NULL,
	"target_entity" text NOT NULL,
	"field_type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"system_key" text NOT NULL,
	"tenant_label" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "project_templates_pkey" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "custom_field_definitions_tenant_id_idx" ON "custom_field_definitions" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_definitions_tenant_id_system_key_uidx" ON "custom_field_definitions" USING btree ("tenant_id","system_key");
--> statement-breakpoint
CREATE INDEX "project_templates_tenant_id_idx" ON "project_templates" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "project_templates_tenant_id_system_key_uidx" ON "project_templates" USING btree ("tenant_id","system_key");
