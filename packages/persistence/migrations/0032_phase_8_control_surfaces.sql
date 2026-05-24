CREATE TABLE IF NOT EXISTS control_surface_definitions (
  id text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE cascade,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  owner_user_id text,
  status text NOT NULL DEFAULT 'draft',
  current_version integer NOT NULL DEFAULT 0,
  draft_version integer NOT NULL DEFAULT 1,
  draft_definition jsonb NOT NULL,
  published_definition jsonb,
  created_by_user_id text NOT NULL,
  updated_by_user_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  published_at timestamp with time zone,
  archived_at timestamp with time zone,
  CONSTRAINT control_surface_definitions_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT control_surface_definitions_owner_user_fk
    FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT control_surface_definitions_created_by_fk
    FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT control_surface_definitions_updated_by_fk
    FOREIGN KEY (tenant_id, updated_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT control_surface_definitions_status_chk
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT control_surface_definitions_current_version_chk CHECK (current_version >= 0),
  CONSTRAINT control_surface_definitions_draft_version_chk CHECK (draft_version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS control_surface_definitions_tenant_code_uidx
  ON control_surface_definitions(tenant_id, code);

CREATE INDEX IF NOT EXISTS control_surface_definitions_tenant_status_idx
  ON control_surface_definitions(tenant_id, status);

CREATE TABLE IF NOT EXISTS control_surface_versions (
  tenant_id text NOT NULL,
  surface_id text NOT NULL,
  version integer NOT NULL,
  definition jsonb NOT NULL,
  published_by_user_id text NOT NULL,
  audit_event_id text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT control_surface_versions_pkey PRIMARY KEY (tenant_id, surface_id, version),
  CONSTRAINT control_surface_versions_surface_fk
    FOREIGN KEY (tenant_id, surface_id)
    REFERENCES control_surface_definitions(tenant_id, id)
    ON DELETE cascade,
  CONSTRAINT control_surface_versions_published_by_fk
    FOREIGN KEY (tenant_id, published_by_user_id)
    REFERENCES tenant_users(tenant_id, id)
    ON DELETE restrict,
  CONSTRAINT control_surface_versions_version_chk CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS control_surface_versions_tenant_surface_created_idx
  ON control_surface_versions(tenant_id, surface_id, created_at);
