CREATE TABLE IF NOT EXISTS "project_resource_pool_members" (
  "tenant_id" text NOT NULL,
  "project_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  CONSTRAINT "project_resource_pool_members_pkey" PRIMARY KEY("tenant_id","project_id","user_id"),
  CONSTRAINT "project_resource_pool_members_project_fk" FOREIGN KEY("tenant_id","project_id")
    REFERENCES "projects"("tenant_id","id") ON DELETE CASCADE,
  CONSTRAINT "project_resource_pool_members_user_fk" FOREIGN KEY("tenant_id","user_id")
    REFERENCES "tenant_users"("tenant_id","id") ON DELETE RESTRICT,
  CONSTRAINT "project_resource_pool_members_role_chk" CHECK("role" in ('project_manager', 'resource', 'observer'))
);

CREATE INDEX IF NOT EXISTS "project_resource_pool_members_tenant_user_idx"
  ON "project_resource_pool_members" ("tenant_id", "user_id");
