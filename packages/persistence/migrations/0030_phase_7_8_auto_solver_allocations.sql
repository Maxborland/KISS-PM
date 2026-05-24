CREATE TABLE IF NOT EXISTS task_assignment_allocations (
  id text NOT NULL,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  assignment_id text NOT NULL,
  task_id text NOT NULL,
  resource_id text NOT NULL,
  date text NOT NULL,
  work_minutes integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT task_assignment_allocations_pkey PRIMARY KEY (tenant_id, project_id, id),
  CONSTRAINT task_assignment_allocations_assignment_fk
    FOREIGN KEY (tenant_id, project_id, assignment_id)
    REFERENCES task_assignments (tenant_id, project_id, id)
    ON DELETE CASCADE,
  CONSTRAINT task_assignment_allocations_task_fk
    FOREIGN KEY (tenant_id, project_id, task_id)
    REFERENCES tasks (tenant_id, project_id, id)
    ON DELETE CASCADE,
  CONSTRAINT task_assignment_allocations_resource_fk
    FOREIGN KEY (tenant_id, resource_id)
    REFERENCES tenant_users (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT task_assignment_allocations_work_chk CHECK (work_minutes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS task_assignment_allocations_assignment_date_uidx
  ON task_assignment_allocations (tenant_id, project_id, assignment_id, date);

CREATE INDEX IF NOT EXISTS task_assignment_allocations_resource_date_idx
  ON task_assignment_allocations (tenant_id, resource_id, date);

CREATE TABLE IF NOT EXISTS planning_solver_runs (
  id text NOT NULL,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  mode text NOT NULL,
  client_plan_version integer NOT NULL,
  engine_version text NOT NULL,
  input_snapshot_metadata jsonb NOT NULL,
  target_deadline text,
  proposals jsonb NOT NULL,
  proposal_payload_hash text NOT NULL,
  actor_user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  applied_proposal_id text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL,
  CONSTRAINT planning_solver_runs_pkey PRIMARY KEY (tenant_id, project_id, id),
  CONSTRAINT planning_solver_runs_project_fk
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES projects (tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT planning_solver_runs_actor_fk
    FOREIGN KEY (tenant_id, actor_user_id)
    REFERENCES tenant_users (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT planning_solver_runs_mode_chk CHECK (mode IN ('schedule', 'repair')),
  CONSTRAINT planning_solver_runs_client_plan_version_chk CHECK (client_plan_version > 0)
);

CREATE INDEX IF NOT EXISTS planning_solver_runs_tenant_project_expires_idx
  ON planning_solver_runs (tenant_id, project_id, expires_at);
