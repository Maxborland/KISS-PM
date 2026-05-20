ALTER TABLE "opportunity_activities"
  DROP CONSTRAINT IF EXISTS "opportunity_activities_type_chk";
--> statement-breakpoint
ALTER TABLE "opportunity_activities"
  DROP CONSTRAINT IF EXISTS "opportunity_activities_status_chk";
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
