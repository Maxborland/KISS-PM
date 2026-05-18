import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const phase12Migration = readFileSync(
  new URL("../migrations/0000_phase_1_2_foundation.sql", import.meta.url),
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
