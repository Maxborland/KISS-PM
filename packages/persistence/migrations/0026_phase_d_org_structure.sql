CREATE TABLE IF NOT EXISTS "tenant_org_nodes" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "track" text NOT NULL,
  "node_type" text NOT NULL,
  "name" text NOT NULL,
  "parent_id" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "tenant_org_nodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_org_nodes_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "tenant_org_nodes_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "public"."tenant_org_nodes"("id") ON DELETE cascade,
  CONSTRAINT "tenant_org_nodes_track_chk" CHECK ("track" in ('functional', 'project')),
  CONSTRAINT "tenant_org_nodes_type_chk" CHECK ("node_type" in ('direction', 'department', 'team')),
  CONSTRAINT "tenant_org_nodes_direction_parent_chk" CHECK (
    ("node_type" = 'direction' AND "parent_id" IS NULL)
    OR ("node_type" in ('department', 'team') AND "parent_id" IS NOT NULL)
  ),
  CONSTRAINT "tenant_org_nodes_track_type_chk" CHECK (
    ("track" = 'functional' AND "node_type" in ('direction', 'department'))
    OR ("track" = 'project' AND "node_type" in ('direction', 'team'))
  )
);

CREATE INDEX IF NOT EXISTS "tenant_org_nodes_tenant_track_idx"
  ON "tenant_org_nodes" ("tenant_id", "track", "sort_order");

CREATE TABLE IF NOT EXISTS "tenant_user_org_placements" (
  "tenant_id" text NOT NULL,
  "user_id" text NOT NULL,
  "track" text NOT NULL,
  "direction_id" text NOT NULL,
  "department_id" text,
  "team_id" text,
  "position_id" text NOT NULL,
  CONSTRAINT "tenant_user_org_placements_pkey" PRIMARY KEY ("tenant_id", "user_id", "track"),
  CONSTRAINT "tenant_user_org_placements_tenant_user_fk"
    FOREIGN KEY ("tenant_id", "user_id") REFERENCES "public"."tenant_users"("tenant_id", "id") ON DELETE cascade,
  CONSTRAINT "tenant_user_org_placements_direction_fk"
    FOREIGN KEY ("direction_id") REFERENCES "public"."tenant_org_nodes"("id") ON DELETE restrict,
  CONSTRAINT "tenant_user_org_placements_department_fk"
    FOREIGN KEY ("department_id") REFERENCES "public"."tenant_org_nodes"("id") ON DELETE restrict,
  CONSTRAINT "tenant_user_org_placements_team_fk"
    FOREIGN KEY ("team_id") REFERENCES "public"."tenant_org_nodes"("id") ON DELETE restrict,
  CONSTRAINT "tenant_user_org_placements_position_fk"
    FOREIGN KEY ("tenant_id", "position_id") REFERENCES "public"."positions"("tenant_id", "id") ON DELETE restrict,
  CONSTRAINT "tenant_user_org_placements_track_chk" CHECK ("track" in ('functional', 'project')),
  CONSTRAINT "tenant_user_org_placements_unit_chk" CHECK (
    ("track" = 'functional' AND "department_id" IS NOT NULL AND "team_id" IS NULL)
    OR ("track" = 'project' AND "team_id" IS NOT NULL AND "department_id" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "tenant_user_org_placements_tenant_track_idx"
  ON "tenant_user_org_placements" ("tenant_id", "track");
