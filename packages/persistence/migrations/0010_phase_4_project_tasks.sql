CREATE TABLE "tasks" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "stage_id" text,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'todo',
  "priority" text NOT NULL DEFAULT 'normal',
  "planned_start" timestamptz NOT NULL,
  "planned_finish" timestamptz NOT NULL,
  "planned_work" integer NOT NULL,
  "actual_work" integer NOT NULL DEFAULT 0,
  "progress" integer NOT NULL DEFAULT 0,
  "source" text NOT NULL DEFAULT 'manual',
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "tasks_project_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "task_participants" (
  "tenant_id" text NOT NULL,
  "task_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  CONSTRAINT "task_participants_pkey" PRIMARY KEY("tenant_id","task_id","user_id","role"),
  CONSTRAINT "task_participants_task_fk" FOREIGN KEY ("tenant_id","task_id") REFERENCES "public"."tasks"("tenant_id","id") ON DELETE cascade,
  CONSTRAINT "task_participants_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX "tasks_tenant_project_id_idx" ON "tasks" USING btree ("tenant_id","project_id");
--> statement-breakpoint
CREATE INDEX "tasks_tenant_status_idx" ON "tasks" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX "task_participants_tenant_user_id_idx" ON "task_participants" USING btree ("tenant_id","user_id");
