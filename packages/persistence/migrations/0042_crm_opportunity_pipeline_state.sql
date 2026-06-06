ALTER TABLE opportunities
  ADD COLUMN crm_pipeline_id text,
  ADD COLUMN crm_pipeline_stage_id text,
  ADD COLUMN crm_pipeline_state_updated_at timestamptz;

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_crm_pipeline_fk
  FOREIGN KEY (tenant_id, crm_pipeline_id)
  REFERENCES crm_pipelines (tenant_id, id)
  ON DELETE RESTRICT;

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_crm_pipeline_stage_fk
  FOREIGN KEY (tenant_id, crm_pipeline_id, crm_pipeline_stage_id)
  REFERENCES crm_pipeline_stages (tenant_id, pipeline_id, id)
  ON DELETE RESTRICT;

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_crm_pipeline_state_pair_chk
  CHECK (
    (crm_pipeline_id IS NULL AND crm_pipeline_stage_id IS NULL AND crm_pipeline_state_updated_at IS NULL)
    OR (crm_pipeline_id IS NOT NULL AND crm_pipeline_stage_id IS NOT NULL AND crm_pipeline_state_updated_at IS NOT NULL)
  );

CREATE INDEX opportunities_crm_pipeline_idx
  ON opportunities (tenant_id, crm_pipeline_id, crm_pipeline_stage_id);
