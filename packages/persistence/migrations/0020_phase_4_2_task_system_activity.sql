ALTER TABLE "task_activities" DROP CONSTRAINT IF EXISTS "task_activities_type_chk";
--> statement-breakpoint
ALTER TABLE "task_activities" DROP CONSTRAINT IF EXISTS "task_activities_payload_chk";
--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_type_chk" CHECK ("type" in ('comment', 'file', 'system'));
--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_payload_chk" CHECK (
  ("type" = 'comment' and "body" is not null)
  or
  ("type" = 'file' and "title" is not null and "file_url" is not null)
  or
  ("type" = 'system' and "title" is not null and "body" is not null)
);
