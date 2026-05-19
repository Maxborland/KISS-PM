import { describe, expect, it } from "vitest";

import {
  getPersistenceTableColumns,
  persistenceTableNames,
  tenantOwnedTableNames
} from "./index";

describe("PostgreSQL persistence schema", () => {
  it("defines the persistence tables through Phase 3", () => {
    expect(persistenceTableNames).toEqual([
      "tenants",
      "access_profiles",
      "positions",
      "custom_field_definitions",
      "project_templates",
      "opportunities",
      "opportunity_demands",
      "projects",
      "project_position_demands",
      "tenant_users",
      "user_credentials",
      "user_sessions",
      "audit_events"
    ]);
  });

  it("keeps every tenant-owned table tenant-scoped", () => {
    expect(tenantOwnedTableNames).toEqual([
      "access_profiles",
      "positions",
      "custom_field_definitions",
      "project_templates",
      "opportunities",
      "opportunity_demands",
      "projects",
      "project_position_demands",
      "tenant_users",
      "user_credentials",
      "user_sessions",
      "audit_events"
    ]);

    for (const tableName of tenantOwnedTableNames) {
      expect(getPersistenceTableColumns(tableName)).toContain("tenant_id");
    }
  });
});
