CREATE TABLE IF NOT EXISTS "plan_accepted_overloads" (
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "resource_id" text NOT NULL,
  "date" text NOT NULL,
  "reason" text,
  "accepted_by_user_id" text,
  "accepted_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "plan_accepted_overloads_pkey" PRIMARY KEY ("tenant_id", "project_id", "resource_id", "date")
);
--> statement-breakpoint
ALTER TABLE "plan_accepted_overloads" ADD CONSTRAINT "plan_accepted_overloads_project_fk" FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id") ON DELETE cascade ON UPDATE no action;
