CREATE TABLE IF NOT EXISTS "crm_activities" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "type" text NOT NULL,
  "title" text,
  "body" text,
  "status" text,
  "due_date" timestamp with time zone,
  "assignee_user_id" text,
  "author_user_id" text NOT NULL,
  "file_url" text,
  "file_size_bytes" integer,
  "mime_type" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "crm_activities_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "crm_activities_entity_type_chk" CHECK ("entity_type" in ('opportunity', 'client', 'contact', 'product')),
  CONSTRAINT "crm_activities_type_chk" CHECK ("type" in ('comment', 'task', 'file')),
  CONSTRAINT "crm_activities_payload_chk" CHECK (
    ("type" = 'comment' and "status" is null and "body" is not null)
    or
    ("type" = 'task' and "status" in ('todo', 'done') and "title" is not null)
    or
    ("type" = 'file' and "status" is null and "title" is not null and "file_url" is not null)
  )
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_author_user_fk" FOREIGN KEY ("tenant_id","author_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_assignee_user_fk" FOREIGN KEY ("tenant_id","assignee_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_tenant_entity_created_idx" ON "crm_activities" USING btree ("tenant_id","entity_type","entity_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_tenant_assignee_idx" ON "crm_activities" USING btree ("tenant_id","assignee_user_id");
--> statement-breakpoint
INSERT INTO "crm_activities" (
  "id",
  "tenant_id",
  "entity_type",
  "entity_id",
  "type",
  "title",
  "body",
  "status",
  "due_date",
  "assignee_user_id",
  "author_user_id",
  "file_url",
  "file_size_bytes",
  "mime_type",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "tenant_id",
  'opportunity',
  "opportunity_id",
  "type",
  "title",
  "body",
  "status",
  "due_date",
  "assignee_user_id",
  "author_user_id",
  null,
  null,
  null,
  "created_at",
  "updated_at"
FROM "opportunity_activities"
ON CONFLICT ("tenant_id","id") DO NOTHING;
--> statement-breakpoint
DROP TABLE IF EXISTS "opportunity_activities";
