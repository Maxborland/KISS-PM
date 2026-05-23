ALTER TABLE "tenant_user_org_placements" DROP CONSTRAINT IF EXISTS "tenant_user_org_placements_direction_fk";
--> statement-breakpoint
ALTER TABLE "tenant_user_org_placements" DROP CONSTRAINT IF EXISTS "tenant_user_org_placements_department_fk";
--> statement-breakpoint
ALTER TABLE "tenant_user_org_placements" DROP CONSTRAINT IF EXISTS "tenant_user_org_placements_team_fk";
--> statement-breakpoint
ALTER TABLE "tenant_org_nodes" DROP CONSTRAINT IF EXISTS "tenant_org_nodes_parent_fk";
--> statement-breakpoint
ALTER TABLE "tenant_org_nodes" DROP CONSTRAINT "tenant_org_nodes_pkey";
--> statement-breakpoint
ALTER TABLE "tenant_org_nodes" ADD CONSTRAINT "tenant_org_nodes_pkey" PRIMARY KEY ("tenant_id", "id");
--> statement-breakpoint
ALTER TABLE "tenant_org_nodes" ADD CONSTRAINT "tenant_org_nodes_parent_fk"
  FOREIGN KEY ("tenant_id", "parent_id") REFERENCES "public"."tenant_org_nodes"("tenant_id", "id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "tenant_user_org_placements" ADD CONSTRAINT "tenant_user_org_placements_direction_fk"
  FOREIGN KEY ("tenant_id", "direction_id") REFERENCES "public"."tenant_org_nodes"("tenant_id", "id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "tenant_user_org_placements" ADD CONSTRAINT "tenant_user_org_placements_department_fk"
  FOREIGN KEY ("tenant_id", "department_id") REFERENCES "public"."tenant_org_nodes"("tenant_id", "id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "tenant_user_org_placements" ADD CONSTRAINT "tenant_user_org_placements_team_fk"
  FOREIGN KEY ("tenant_id", "team_id") REFERENCES "public"."tenant_org_nodes"("tenant_id", "id") ON DELETE restrict;
