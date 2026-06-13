CREATE TABLE IF NOT EXISTS project_task_stages (
  id text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT project_task_stages_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT project_task_stages_status_chk CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS project_task_stages_tenant_id_idx
  ON project_task_stages (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_task_stages_tenant_sort_order_uidx
  ON project_task_stages (tenant_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS project_task_stages_tenant_name_uidx
  ON project_task_stages (tenant_id, name);

INSERT INTO project_task_stages (
  id,
  tenant_id,
  name,
  sort_order,
  status,
  is_system,
  created_at,
  updated_at
)
SELECT stage.id, tenants.id, stage.name, stage.sort_order, 'active', stage.is_system, now(), now()
FROM tenants
CROSS JOIN (
  VALUES
    ('project-stage-backlog', 'Бэклог', 10, true),
    ('project-stage-todo', 'К выполнению', 20, true),
    ('project-stage-in-work', 'В работе', 30, false),
    ('project-stage-review', 'На проверке', 40, false),
    ('project-stage-done', 'Готово', 50, true)
) AS stage(id, name, sort_order, is_system)
ON CONFLICT (tenant_id, id) DO NOTHING;

UPDATE access_profiles
SET permissions = permissions || '["tenant.project_stages.manage"]'::jsonb
WHERE permissions @> '["tenant.projects.manage"]'::jsonb
  AND NOT permissions @> '["tenant.project_stages.manage"]'::jsonb;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_stage_fk
  FOREIGN KEY (tenant_id, stage_id)
  REFERENCES project_task_stages (tenant_id, id)
  ON DELETE RESTRICT;
