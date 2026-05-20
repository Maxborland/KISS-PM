CREATE TABLE IF NOT EXISTS "opportunity_activities" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "opportunity_id" text NOT NULL,
  "type" text NOT NULL,
  "title" text,
  "body" text,
  "status" text,
  "due_date" timestamp with time zone,
  "assignee_user_id" text,
  "author_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "opportunity_activities_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "opportunity_activities_type_chk" CHECK ("type" in ('comment', 'task')),
  CONSTRAINT "opportunity_activities_status_chk" CHECK (
    ("type" = 'comment' and "status" is null)
    or
    ("type" = 'task' and "status" in ('todo', 'done') and "title" is not null)
  )
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_opportunity_fk" FOREIGN KEY ("tenant_id","opportunity_id") REFERENCES "public"."opportunities"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_author_user_fk" FOREIGN KEY ("tenant_id","author_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_assignee_user_fk" FOREIGN KEY ("tenant_id","assignee_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunity_activities_tenant_opportunity_created_idx" ON "opportunity_activities" USING btree ("tenant_id","opportunity_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunity_activities_tenant_assignee_idx" ON "opportunity_activities" USING btree ("tenant_id","assignee_user_id");
