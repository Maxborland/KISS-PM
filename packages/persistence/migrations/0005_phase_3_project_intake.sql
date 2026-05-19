CREATE TABLE "opportunities" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"client_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"title" text NOT NULL,
	"project_type" text NOT NULL,
	"description" text,
	"planned_start" timestamp with time zone NOT NULL,
	"planned_finish" timestamp with time zone NOT NULL,
	"contract_value" integer NOT NULL,
	"planned_hourly_rate" integer NOT NULL,
	"planned_hours" integer NOT NULL,
	"probability" integer NOT NULL,
	"status" text NOT NULL,
	"template_id" text,
	"feasibility_status" text,
	"feasibility_result" jsonb,
	"feasibility_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "opportunities_pkey" PRIMARY KEY ("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "opportunity_demands" (
	"tenant_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"position_id" text NOT NULL,
	"required_hours" integer NOT NULL,
	CONSTRAINT "opportunity_demands_pkey" PRIMARY KEY ("tenant_id","opportunity_id","position_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"source_opportunity_id" text NOT NULL,
	"title" text NOT NULL,
	"client_name" text NOT NULL,
	"status" text NOT NULL,
	"planned_start" timestamp with time zone NOT NULL,
	"planned_finish" timestamp with time zone NOT NULL,
	"contract_value" integer NOT NULL,
	"planned_hours" integer NOT NULL,
	"template_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "projects_pkey" PRIMARY KEY ("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_position_demands" (
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"position_id" text NOT NULL,
	"required_hours" integer NOT NULL,
	CONSTRAINT "project_position_demands_pkey" PRIMARY KEY ("tenant_id","project_id","position_id")
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_demands" ADD CONSTRAINT "opportunity_demands_opportunity_fk" FOREIGN KEY ("tenant_id","opportunity_id") REFERENCES "public"."opportunities"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_demands" ADD CONSTRAINT "opportunity_demands_position_fk" FOREIGN KEY ("tenant_id","position_id") REFERENCES "public"."positions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_source_opportunity_fk" FOREIGN KEY ("tenant_id","source_opportunity_id") REFERENCES "public"."opportunities"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_position_demands" ADD CONSTRAINT "project_position_demands_project_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_position_demands" ADD CONSTRAINT "project_position_demands_position_fk" FOREIGN KEY ("tenant_id","position_id") REFERENCES "public"."positions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunities_tenant_id_idx" ON "opportunities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opportunity_demands_tenant_id_idx" ON "opportunity_demands" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "projects_tenant_id_idx" ON "projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_position_demands_tenant_id_idx" ON "project_position_demands" USING btree ("tenant_id");
