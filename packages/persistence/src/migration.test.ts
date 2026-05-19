import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const phase12Migration = readFileSync(
  new URL("../migrations/0000_phase_1_2_foundation.sql", import.meta.url),
  "utf8"
);
const phase23Migration = readFileSync(
  new URL("../migrations/0002_phase_2_3_workspace_config.sql", import.meta.url),
  "utf8"
);
const phase23ScopedIdsMigration = readFileSync(
  new URL(
    "../migrations/0003_phase_2_3_workspace_config_scoped_ids.sql",
    import.meta.url
  ),
  "utf8"
);
const phase23AccessProfileScopedIdsMigration = readFileSync(
  new URL(
    "../migrations/0004_phase_2_3_access_profiles_scoped_ids.sql",
    import.meta.url
  ),
  "utf8"
);

describe("Phase 1.2 SQL migration", () => {
  it("prevents tenant users from referencing access profiles from another tenant", () => {
    const uniqueIndexPosition = phase12Migration.indexOf(
      'CREATE UNIQUE INDEX "access_profiles_tenant_id_id_uidx"'
    );
    const sameTenantForeignKeyPosition = phase12Migration.indexOf(
      'CONSTRAINT "tenant_users_access_profile_same_tenant_fk"'
    );

    expect(phase12Migration).toContain(
      'CONSTRAINT "tenant_users_access_profile_same_tenant_fk"'
    );
    expect(phase12Migration).toContain(
      'FOREIGN KEY ("tenant_id","access_profile_id")'
    );
    expect(phase12Migration).toContain(
      'CREATE UNIQUE INDEX "access_profiles_tenant_id_id_uidx"'
    );
    expect(uniqueIndexPosition).toBeGreaterThanOrEqual(0);
    expect(sameTenantForeignKeyPosition).toBeGreaterThan(uniqueIndexPosition);
  });
});

describe("Phase 2.3 SQL migration", () => {
  it("adds tenant-scoped workspace config tables with canonical keys", () => {
    expect(phase23Migration).toContain('CREATE TABLE "custom_field_definitions"');
    expect(phase23Migration).toContain('CREATE TABLE "project_templates"');
    expect(phase23Migration).toContain('"tenant_id" text NOT NULL');
    expect(phase23Migration).toContain('"system_key" text NOT NULL');
    expect(phase23Migration).toContain('"tenant_label" text NOT NULL');
    expect(phase23Migration).toContain(
      'CREATE UNIQUE INDEX "custom_field_definitions_tenant_id_system_key_uidx"'
    );
    expect(phase23Migration).toContain(
      'CREATE UNIQUE INDEX "project_templates_tenant_id_system_key_uidx"'
    );
    expect(phase23Migration).toContain(
      'CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY("tenant_id","id")'
    );
    expect(phase23Migration).toContain(
      'CONSTRAINT "project_templates_pkey" PRIMARY KEY("tenant_id","id")'
    );
    expect(phase23Migration).toContain(
      'FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade'
    );
  });

  it("repairs already-applied Phase 2.3 tables to tenant-scoped primary keys", () => {
    expect(phase23ScopedIdsMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "custom_field_definitions_pkey"'
    );
    expect(phase23ScopedIdsMigration).toContain(
      'PRIMARY KEY ("tenant_id","id")'
    );
    expect(phase23ScopedIdsMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "project_templates_pkey"'
    );
  });

  it("repairs access profiles to tenant-scoped primary keys", () => {
    expect(phase23AccessProfileScopedIdsMigration).toContain(
      'DROP CONSTRAINT IF EXISTS "access_profiles_pkey"'
    );
    expect(phase23AccessProfileScopedIdsMigration).toContain(
      'ADD CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("tenant_id","id")'
    );
  });
});
