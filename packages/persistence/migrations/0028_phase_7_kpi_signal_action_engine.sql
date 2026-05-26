CREATE TABLE "kpi_definitions" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "code" text NOT NULL,
  "label" text NOT NULL,
  "formula" jsonb NOT NULL,
  "unit" text NOT NULL,
  "period" text NOT NULL,
  "threshold_rules" jsonb NOT NULL,
  "owner_role" text,
  "allowed_actions" jsonb NOT NULL,
  "version" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("tenant_id","id"),
  CONSTRAINT "kpi_definitions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "kpi_definitions_entity_type_chk" CHECK ("entity_type" in ('project')),
  CONSTRAINT "kpi_definitions_version_chk" CHECK ("version" > 0),
  CONSTRAINT "kpi_definitions_status_chk" CHECK ("status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_definitions_tenant_code_uidx" ON "kpi_definitions" USING btree ("tenant_id","code");
--> statement-breakpoint
CREATE INDEX "kpi_definitions_tenant_status_idx" ON "kpi_definitions" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE TABLE "kpi_evaluations" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "definition_id" text NOT NULL,
  "definition_version" integer NOT NULL,
  "formula_version" integer NOT NULL,
  "source_data" jsonb NOT NULL,
  "period_start" text,
  "period_end" text,
  "threshold" jsonb,
  "calculated_value" integer NOT NULL,
  "severity" text NOT NULL,
  "evaluated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "kpi_evaluations_pkey" PRIMARY KEY ("tenant_id","project_id","id"),
  CONSTRAINT "kpi_evaluations_project_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE cascade,
  CONSTRAINT "kpi_evaluations_definition_fk" FOREIGN KEY ("tenant_id","definition_id") REFERENCES "public"."kpi_definitions"("tenant_id","id") ON DELETE restrict,
  CONSTRAINT "kpi_evaluations_severity_chk" CHECK ("severity" in ('ok', 'warning', 'critical'))
);
--> statement-breakpoint
CREATE INDEX "kpi_evaluations_tenant_project_evaluated_idx" ON "kpi_evaluations" USING btree ("tenant_id","project_id","evaluated_at");
--> statement-breakpoint
CREATE TABLE "control_signals" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "evaluation_id" text,
  "source_entity" jsonb NOT NULL,
  "source_metric" text NOT NULL,
  "severity" text NOT NULL,
  "explanation" text NOT NULL,
  "owner_user_id" text,
  "allowed_actions" jsonb NOT NULL,
  "scenario_proposals" jsonb NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "resolved_at" timestamp with time zone,
  CONSTRAINT "control_signals_pkey" PRIMARY KEY ("tenant_id","project_id","id"),
  CONSTRAINT "control_signals_project_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE cascade,
  CONSTRAINT "control_signals_owner_user_fk" FOREIGN KEY ("tenant_id","owner_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict,
  CONSTRAINT "control_signals_severity_chk" CHECK ("severity" in ('warning', 'critical')),
  CONSTRAINT "control_signals_status_chk" CHECK ("status" in ('open', 'acknowledged', 'resolved', 'accepted_risk'))
);
--> statement-breakpoint
CREATE INDEX "control_signals_tenant_project_status_idx" ON "control_signals" USING btree ("tenant_id","project_id","status");
--> statement-breakpoint
CREATE TABLE "corrective_actions" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "control_signal_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "responsible_user_id" text,
  "due_date" text,
  "status" text DEFAULT 'open' NOT NULL,
  "result" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("tenant_id","project_id","id"),
  CONSTRAINT "corrective_actions_signal_fk" FOREIGN KEY ("tenant_id","project_id","control_signal_id") REFERENCES "public"."control_signals"("tenant_id","project_id","id") ON DELETE cascade,
  CONSTRAINT "corrective_actions_responsible_user_fk" FOREIGN KEY ("tenant_id","responsible_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict,
  CONSTRAINT "corrective_actions_status_chk" CHECK ("status" in ('open', 'in_progress', 'done', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX "corrective_actions_tenant_project_status_idx" ON "corrective_actions" USING btree ("tenant_id","project_id","status");
--> statement-breakpoint
CREATE TABLE "action_executions" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "action_type" text NOT NULL,
  "target_entity" jsonb NOT NULL,
  "actor_user_id" text NOT NULL,
  "input" jsonb NOT NULL,
  "preview_payload" jsonb,
  "result_payload" jsonb,
  "status" text NOT NULL,
  "audit_event_id" text,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "action_executions_pkey" PRIMARY KEY ("tenant_id","project_id","id"),
  CONSTRAINT "action_executions_project_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE cascade,
  CONSTRAINT "action_executions_actor_fk" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict,
  CONSTRAINT "action_executions_status_chk" CHECK ("status" in ('previewed', 'succeeded', 'failed', 'denied'))
);
--> statement-breakpoint
CREATE INDEX "action_executions_tenant_project_created_idx" ON "action_executions" USING btree ("tenant_id","project_id","created_at");
