ALTER TABLE "opportunity_activities"
  DROP CONSTRAINT IF EXISTS "opportunity_activities_opportunity_fk";
--> statement-breakpoint
ALTER TABLE "opportunity_activities"
  DROP CONSTRAINT IF EXISTS "opportunity_activities_type_chk";
--> statement-breakpoint
ALTER TABLE "opportunity_activities"
  DROP CONSTRAINT IF EXISTS "opportunity_activities_status_chk";
--> statement-breakpoint
ALTER TABLE "opportunity_activities"
  ADD CONSTRAINT "opportunity_activities_opportunity_fk"
  FOREIGN KEY ("tenant_id","opportunity_id")
  REFERENCES "public"."opportunities"("tenant_id","id")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "opportunity_activities"
  ADD CONSTRAINT "opportunity_activities_type_chk"
  CHECK ("type" in ('comment', 'task')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "opportunity_activities"
  ADD CONSTRAINT "opportunity_activities_status_chk"
  CHECK (
    ("type" = 'comment' and "status" is null)
    or
    ("type" = 'task' and "status" in ('todo', 'done') and "title" is not null)
  ) NOT VALID;
