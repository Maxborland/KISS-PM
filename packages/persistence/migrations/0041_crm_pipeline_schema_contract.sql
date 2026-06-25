CREATE TABLE IF NOT EXISTS "crm_pipelines" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "lifecycle_graph_metadata" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "crm_pipelines_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "crm_pipelines_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "crm_pipelines_status_chk" CHECK ("status" in ('active', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_pipelines_tenant_id_name_uidx"
  ON "crm_pipelines" ("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "crm_pipelines_tenant_id_idx"
  ON "crm_pipelines" ("tenant_id");

CREATE TABLE IF NOT EXISTS "crm_pipeline_stages" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "pipeline_id" text NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "lifecycle_state" text NOT NULL DEFAULT 'open',
  "is_final" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "crm_pipeline_stages_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "crm_pipeline_stages_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "crm_pipeline_stages_pipeline_fk"
    FOREIGN KEY ("tenant_id", "pipeline_id")
    REFERENCES "crm_pipelines"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "crm_pipeline_stages_status_chk" CHECK ("status" in ('active', 'archived')),
  CONSTRAINT "crm_pipeline_stages_lifecycle_state_chk"
    CHECK ("lifecycle_state" in ('open', 'won_closed', 'lost_rejected')),
  CONSTRAINT "crm_pipeline_stages_final_lifecycle_state_chk"
    CHECK (
      ("is_final" = false AND "lifecycle_state" = 'open')
      OR ("is_final" = true AND "lifecycle_state" in ('won_closed', 'lost_rejected'))
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_pipeline_stages_tenant_pipeline_id_uidx"
  ON "crm_pipeline_stages" ("tenant_id", "pipeline_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "crm_pipeline_stages_tenant_pipeline_sort_order_uidx"
  ON "crm_pipeline_stages" ("tenant_id", "pipeline_id", "sort_order");

CREATE UNIQUE INDEX IF NOT EXISTS "crm_pipeline_stages_tenant_pipeline_name_uidx"
  ON "crm_pipeline_stages" ("tenant_id", "pipeline_id", "name");

CREATE INDEX IF NOT EXISTS "crm_pipeline_stages_tenant_pipeline_idx"
  ON "crm_pipeline_stages" ("tenant_id", "pipeline_id");

CREATE TABLE IF NOT EXISTS "crm_pipeline_transition_rules" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "pipeline_id" text NOT NULL,
  "from_stage_id" text NOT NULL,
  "to_stage_id" text NOT NULL,
  "required_permission" text,
  "required_fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "require_reason" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "crm_pipeline_transition_rules_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "crm_pipeline_transition_rules_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "crm_pipeline_transition_rules_pipeline_fk"
    FOREIGN KEY ("tenant_id", "pipeline_id")
    REFERENCES "crm_pipelines"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "crm_pipeline_transition_rules_from_stage_fk"
    FOREIGN KEY ("tenant_id", "pipeline_id", "from_stage_id")
    REFERENCES "crm_pipeline_stages"("tenant_id", "pipeline_id", "id") ON DELETE cascade,
  CONSTRAINT "crm_pipeline_transition_rules_to_stage_fk"
    FOREIGN KEY ("tenant_id", "pipeline_id", "to_stage_id")
    REFERENCES "crm_pipeline_stages"("tenant_id", "pipeline_id", "id") ON DELETE cascade,
  CONSTRAINT "crm_pipeline_transition_rules_status_chk" CHECK ("status" in ('active', 'archived')),
  CONSTRAINT "crm_pipeline_transition_rules_not_self_chk" CHECK ("from_stage_id" <> "to_stage_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_pipeline_transition_rules_edge_uidx"
  ON "crm_pipeline_transition_rules" ("tenant_id", "pipeline_id", "from_stage_id", "to_stage_id");

CREATE INDEX IF NOT EXISTS "crm_pipeline_transition_rules_tenant_pipeline_idx"
  ON "crm_pipeline_transition_rules" ("tenant_id", "pipeline_id");

CREATE TABLE IF NOT EXISTS "crm_pipeline_stage_automation_definitions" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "pipeline_id" text NOT NULL,
  "stage_id" text NOT NULL,
  "trigger" text NOT NULL,
  "action_type" text NOT NULL,
  "action_config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "crm_pipeline_stage_automation_definitions_pkey" PRIMARY KEY ("tenant_id", "id"),
  CONSTRAINT "crm_pipeline_stage_automation_definitions_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
  CONSTRAINT "crm_pipeline_stage_automation_definitions_pipeline_fk"
    FOREIGN KEY ("tenant_id", "pipeline_id")
    REFERENCES "crm_pipelines"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "crm_pipeline_stage_automation_definitions_stage_fk"
    FOREIGN KEY ("tenant_id", "pipeline_id", "stage_id")
    REFERENCES "crm_pipeline_stages"("tenant_id", "pipeline_id", "id") ON DELETE cascade,
  CONSTRAINT "crm_pipeline_stage_automation_definitions_trigger_chk"
    CHECK ("trigger" in ('stage_entered', 'stage_left')),
  CONSTRAINT "crm_pipeline_stage_automation_definitions_status_chk"
    CHECK ("status" in ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS "crm_pipeline_stage_automation_definitions_tenant_stage_idx"
  ON "crm_pipeline_stage_automation_definitions" ("tenant_id", "pipeline_id", "stage_id");

-- Унификация мультиворонок: операционные поля воронки + runtime-гварды правил перехода
-- (first-class crm_pipeline_* становится единственной моделью; legacy deal_stages упраздняется).
ALTER TABLE "crm_pipelines" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "crm_pipelines" ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false;
ALTER TABLE "crm_pipelines" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "crm_pipelines_tenant_id_sort_order_idx"
  ON "crm_pipelines" ("tenant_id", "sort_order");

ALTER TABLE "crm_pipeline_transition_rules" ADD COLUMN IF NOT EXISTS "require_feasibility_ok" boolean NOT NULL DEFAULT false;
ALTER TABLE "crm_pipeline_transition_rules" ADD COLUMN IF NOT EXISTS "min_probability" integer;
ALTER TABLE "crm_pipeline_transition_rules" ADD COLUMN IF NOT EXISTS "guard_note" text;

-- Сделки получают воронку и переезжают со стадий legacy deal_stages на first-class crm_pipeline_stages.
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "pipeline_id" text;

-- Перенос данных из legacy deal_stages в crm_pipeline_stages (дефолтная воронка на тенант).
INSERT INTO "crm_pipelines" ("id", "tenant_id", "name", "description", "is_default", "sort_order", "status", "lifecycle_graph_metadata", "created_at", "updated_at")
  SELECT DISTINCT "tenant_id" || '-pipeline-default', "tenant_id", 'Основная воронка', NULL, true, 1, 'active',
    jsonb_build_object('pipelineId', "tenant_id" || '-pipeline-default', 'initialStageId', NULL, 'finalStageIds', '[]'::jsonb, 'stages', '[]'::jsonb, 'transitions', '[]'::jsonb),
    now(), now()
  FROM "deal_stages"
  ON CONFLICT DO NOTHING;

INSERT INTO "crm_pipeline_stages" ("id", "tenant_id", "pipeline_id", "name", "sort_order", "status", "lifecycle_state", "is_final", "created_at", "updated_at")
  SELECT "id", "tenant_id", "tenant_id" || '-pipeline-default', "name", "sort_order", COALESCE("status", 'active'), 'open', false, now(), now()
  FROM "deal_stages"
  ON CONFLICT DO NOTHING;

UPDATE "opportunities" SET "pipeline_id" = "tenant_id" || '-pipeline-default'
  WHERE "pipeline_id" IS NULL AND "stage_id" IS NOT NULL;

-- Перенацеливание FK стадии сделки с deal_stages на crm_pipeline_stages + FK воронки.
ALTER TABLE "opportunities" DROP CONSTRAINT IF EXISTS "opportunities_stage_fk";
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_stage_fk"
  FOREIGN KEY ("tenant_id", "stage_id") REFERENCES "crm_pipeline_stages"("tenant_id", "id") ON DELETE restrict;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_pipeline_fk"
  FOREIGN KEY ("tenant_id", "pipeline_id") REFERENCES "crm_pipelines"("tenant_id", "id") ON DELETE restrict;

CREATE INDEX IF NOT EXISTS "opportunities_pipeline_id_idx"
  ON "opportunities" ("tenant_id", "pipeline_id");

-- Legacy таблица стадий упразднена: единственная модель — first-class crm_pipeline_stages.
DROP TABLE IF EXISTS "deal_stages";
