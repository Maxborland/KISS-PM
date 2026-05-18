ALTER TABLE "custom_field_definitions" DROP CONSTRAINT IF EXISTS "custom_field_definitions_pkey";
--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("tenant_id","id");
--> statement-breakpoint
ALTER TABLE "project_templates" DROP CONSTRAINT IF EXISTS "project_templates_pkey";
--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_pkey" PRIMARY KEY ("tenant_id","id");
