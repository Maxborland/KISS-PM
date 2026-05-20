ALTER TABLE "opportunity_activities"
  DROP CONSTRAINT IF EXISTS "opportunity_activities_opportunity_fk";
--> statement-breakpoint
ALTER TABLE "opportunity_activities"
  ADD CONSTRAINT "opportunity_activities_opportunity_fk"
  FOREIGN KEY ("tenant_id","opportunity_id")
  REFERENCES "public"."opportunities"("tenant_id","id")
  ON DELETE restrict
  ON UPDATE no action;
