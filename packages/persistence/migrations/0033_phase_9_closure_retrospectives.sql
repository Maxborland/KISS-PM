ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS project_closure_snapshots (
  id text NOT NULL,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  project_status_before text NOT NULL,
  plan_version integer NOT NULL,
  snapshot_payload jsonb NOT NULL,
  plan_fact_summary jsonb NOT NULL,
  closed_by_user_id text NOT NULL,
  closed_at timestamp with time zone NOT NULL,
  close_reason text NOT NULL,
  audit_event_id text,
  CONSTRAINT project_closure_snapshots_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT project_closure_snapshots_project_fk
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES projects(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT project_closure_snapshots_closed_by_fk
    FOREIGN KEY (tenant_id, closed_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT project_closure_snapshots_plan_version_chk CHECK (plan_version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS project_closure_snapshots_tenant_project_uidx
  ON project_closure_snapshots(tenant_id, project_id);

CREATE INDEX IF NOT EXISTS project_closure_snapshots_tenant_closed_idx
  ON project_closure_snapshots(tenant_id, closed_at);

CREATE TABLE IF NOT EXISTS retrospective_lessons (
  id text NOT NULL,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  snapshot_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  impact text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT retrospective_lessons_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT retrospective_lessons_snapshot_fk
    FOREIGN KEY (tenant_id, snapshot_id)
    REFERENCES project_closure_snapshots(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT retrospective_lessons_project_fk
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES projects(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT retrospective_lessons_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT retrospective_lessons_category_chk
    CHECK (category IN ('schedule', 'scope', 'resource', 'quality', 'communication', 'commercial', 'process')),
  CONSTRAINT retrospective_lessons_impact_chk
    CHECK (impact IN ('positive', 'negative', 'neutral'))
);

CREATE INDEX IF NOT EXISTS retrospective_lessons_tenant_project_created_idx
  ON retrospective_lessons(tenant_id, project_id, created_at);

CREATE TABLE IF NOT EXISTS template_improvement_actions (
  id text NOT NULL,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  snapshot_id text NOT NULL,
  template_id text NOT NULL,
  status text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  impact jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  applied_by_user_id text,
  created_at timestamp with time zone NOT NULL,
  applied_at timestamp with time zone,
  audit_event_id text,
  CONSTRAINT template_improvement_actions_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT template_improvement_actions_snapshot_fk
    FOREIGN KEY (tenant_id, snapshot_id)
    REFERENCES project_closure_snapshots(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT template_improvement_actions_project_fk
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES projects(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT template_improvement_actions_template_fk
    FOREIGN KEY (tenant_id, template_id)
    REFERENCES project_templates(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT template_improvement_actions_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT template_improvement_actions_applied_by_fk
    FOREIGN KEY (tenant_id, applied_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT template_improvement_actions_status_chk
    CHECK (status IN ('proposed', 'applied', 'rejected'))
);

CREATE INDEX IF NOT EXISTS template_improvement_actions_tenant_template_status_idx
  ON template_improvement_actions(tenant_id, template_id, status);
