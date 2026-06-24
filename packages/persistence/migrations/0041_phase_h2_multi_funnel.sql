CREATE TABLE "pipelines" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "sort_order" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "pipelines_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "pipelines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "pipelines_tenant_id_idx" ON "pipelines" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "pipelines_tenant_id_name_uidx" ON "pipelines" USING btree ("tenant_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "pipelines_tenant_id_sort_order_uidx" ON "pipelines" USING btree ("tenant_id","sort_order");
--> statement-breakpoint
ALTER TABLE "deal_stages" ADD COLUMN "pipeline_id" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "pipeline_id" text;
--> statement-breakpoint
CREATE TABLE "stage_transitions" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "pipeline_id" text NOT NULL,
  "from_stage_id" text NOT NULL,
  "to_stage_id" text NOT NULL,
  "require_feasibility_ok" boolean DEFAULT false NOT NULL,
  "min_probability" integer,
  "guard_note" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "stage_transitions_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "stage_transitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO "pipelines" ("id","tenant_id","name","description","is_default","sort_order","status","created_at","updated_at")
  SELECT DISTINCT "tenant_id" || '-pipeline-default', "tenant_id", 'Основная воронка', NULL, true, 1, 'active', now(), now() FROM "deal_stages";
--> statement-breakpoint
UPDATE "deal_stages" SET "pipeline_id" = "tenant_id" || '-pipeline-default' WHERE "pipeline_id" IS NULL;
--> statement-breakpoint
UPDATE "opportunities" SET "pipeline_id" = "tenant_id" || '-pipeline-default' WHERE "pipeline_id" IS NULL AND "stage_id" IS NOT NULL;
--> statement-breakpoint
DROP INDEX "deal_stages_tenant_id_sort_order_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX "deal_stages_tenant_id_sort_order_uidx" ON "deal_stages" USING btree ("tenant_id","pipeline_id","sort_order");
--> statement-breakpoint
DROP INDEX "deal_stages_tenant_id_name_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX "deal_stages_tenant_id_name_uidx" ON "deal_stages" USING btree ("tenant_id","pipeline_id","name");
--> statement-breakpoint
ALTER TABLE "deal_stages" ADD CONSTRAINT "deal_stages_pipeline_fk" FOREIGN KEY ("tenant_id","pipeline_id") REFERENCES "public"."pipelines"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_pipeline_fk" FOREIGN KEY ("tenant_id","pipeline_id") REFERENCES "public"."pipelines"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_pipeline_fk" FOREIGN KEY ("tenant_id","pipeline_id") REFERENCES "public"."pipelines"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_from_stage_fk" FOREIGN KEY ("tenant_id","from_stage_id") REFERENCES "public"."deal_stages"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_to_stage_fk" FOREIGN KEY ("tenant_id","to_stage_id") REFERENCES "public"."deal_stages"("tenant_id","id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "opportunities_pipeline_id_idx" ON "opportunities" USING btree ("tenant_id","pipeline_id");
--> statement-breakpoint
CREATE INDEX "stage_transitions_tenant_id_idx" ON "stage_transitions" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "stage_transitions_pipeline_id_idx" ON "stage_transitions" USING btree ("tenant_id","pipeline_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "stage_transitions_unique_uidx" ON "stage_transitions" USING btree ("tenant_id","pipeline_id","from_stage_id","to_stage_id");
