CREATE TABLE IF NOT EXISTS file_assets (
  id text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  provider text NOT NULL,
  storage_key text NOT NULL,
  original_name text NOT NULL,
  safe_display_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  checksum_sha256 text,
  status text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  archived_at timestamptz,
  CONSTRAINT file_assets_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT file_assets_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT file_assets_provider_chk CHECK (provider IN ('local', 's3')),
  CONSTRAINT file_assets_status_chk CHECK (status IN ('pending', 'ready', 'archived', 'failed')),
  CONSTRAINT file_assets_size_chk CHECK (size_bytes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS file_assets_tenant_storage_key_uidx
  ON file_assets (tenant_id, storage_key);

CREATE INDEX IF NOT EXISTS file_assets_tenant_status_idx
  ON file_assets (tenant_id, status);

CREATE TABLE IF NOT EXISTS external_references (
  id text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  connector_type text NOT NULL,
  external_id text,
  url text NOT NULL,
  title text NOT NULL,
  metadata jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  archived_at timestamptz,
  CONSTRAINT external_references_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT external_references_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT external_references_connector_type_chk
    CHECK (connector_type IN ('manual_link', 'bitrix24', 'amocrm', 'jira', 'slack', 'email', 's3', 'local', 'other'))
);

CREATE INDEX IF NOT EXISTS external_references_tenant_connector_idx
  ON external_references (tenant_id, connector_type);

CREATE TABLE IF NOT EXISTS entity_attachments (
  id text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  asset_id text,
  external_reference_id text,
  relation_type text NOT NULL,
  source_activity_type text,
  source_activity_id text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  archived_at timestamptz,
  CONSTRAINT entity_attachments_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT entity_attachments_asset_fk
    FOREIGN KEY (tenant_id, asset_id)
    REFERENCES file_assets (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT entity_attachments_external_reference_fk
    FOREIGN KEY (tenant_id, external_reference_id)
    REFERENCES external_references (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT entity_attachments_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT entity_attachments_entity_type_chk
    CHECK (entity_type IN ('opportunity', 'client', 'contact', 'product', 'project', 'task')),
  CONSTRAINT entity_attachments_source_activity_type_chk
    CHECK (source_activity_type IS NULL OR source_activity_type IN ('crm', 'task')),
  CONSTRAINT entity_attachments_target_chk
    CHECK (
      (asset_id IS NOT NULL AND external_reference_id IS NULL)
      OR
      (asset_id IS NULL AND external_reference_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS entity_attachments_tenant_entity_idx
  ON entity_attachments (tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS entity_attachments_tenant_source_activity_idx
  ON entity_attachments (tenant_id, source_activity_type, source_activity_id);

INSERT INTO external_references (
  id,
  tenant_id,
  connector_type,
  external_id,
  url,
  title,
  metadata,
  created_by_user_id,
  created_at,
  archived_at
)
SELECT
  'external-ref-' || id,
  tenant_id,
  'manual_link',
  NULL,
  file_url,
  title,
  jsonb_build_object('legacySource', 'crm_activity', 'legacyActivityId', id),
  author_user_id,
  created_at,
  NULL
FROM crm_activities
WHERE type = 'file'
  AND file_url ~* '^https?://'
  AND file_url !~* '^https?://[^/?#]+@'
  AND file_url !~* '^https?://(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|\[::1\]|169\.254\.)'
  AND file_url !~* '^https?://\[(fc|fd|fe[89ab])'
  AND file_url !~* '^https?://\[::ffff:'
ON CONFLICT DO NOTHING;

INSERT INTO entity_attachments (
  id,
  tenant_id,
  entity_type,
  entity_id,
  asset_id,
  external_reference_id,
  relation_type,
  source_activity_type,
  source_activity_id,
  created_by_user_id,
  created_at,
  archived_at
)
SELECT
  'attachment-' || id,
  tenant_id,
  entity_type,
  entity_id,
  NULL,
  'external-ref-' || id,
  'legacy_file',
  'crm',
  id,
  author_user_id,
  created_at,
  NULL
FROM crm_activities
WHERE type = 'file'
  AND file_url ~* '^https?://'
  AND file_url !~* '^https?://[^/?#]+@'
  AND file_url !~* '^https?://(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|\[::1\]|169\.254\.)'
  AND file_url !~* '^https?://\[(fc|fd|fe[89ab])'
  AND file_url !~* '^https?://\[::ffff:'
ON CONFLICT DO NOTHING;

INSERT INTO external_references (
  id,
  tenant_id,
  connector_type,
  external_id,
  url,
  title,
  metadata,
  created_by_user_id,
  created_at,
  archived_at
)
SELECT
  'external-ref-task-' || id,
  tenant_id,
  'manual_link',
  NULL,
  file_url,
  title,
  jsonb_build_object('legacySource', 'task_activity', 'legacyActivityId', id),
  author_user_id,
  created_at,
  NULL
FROM task_activities
WHERE type = 'file'
  AND file_url ~* '^https?://'
  AND file_url !~* '^https?://[^/?#]+@'
  AND file_url !~* '^https?://(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|\[::1\]|169\.254\.)'
  AND file_url !~* '^https?://\[(fc|fd|fe[89ab])'
  AND file_url !~* '^https?://\[::ffff:'
ON CONFLICT DO NOTHING;

INSERT INTO entity_attachments (
  id,
  tenant_id,
  entity_type,
  entity_id,
  asset_id,
  external_reference_id,
  relation_type,
  source_activity_type,
  source_activity_id,
  created_by_user_id,
  created_at,
  archived_at
)
SELECT
  'attachment-task-' || id,
  tenant_id,
  'task',
  task_id,
  NULL,
  'external-ref-task-' || id,
  'legacy_file',
  'task',
  id,
  author_user_id,
  created_at,
  NULL
FROM task_activities
WHERE type = 'file'
  AND file_url ~* '^https?://'
  AND file_url !~* '^https?://[^/?#]+@'
  AND file_url !~* '^https?://(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|\[::1\]|169\.254\.)'
  AND file_url !~* '^https?://\[(fc|fd|fe[89ab])'
  AND file_url !~* '^https?://\[::ffff:'
ON CONFLICT DO NOTHING;
