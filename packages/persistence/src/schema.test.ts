import { describe, expect, it } from "vitest";

import {
  getPersistenceTableColumns,
  persistenceTableNames,
  tenantOwnedTableNames
} from "./index";

describe("PostgreSQL persistence schema", () => {
  it("defines the persistence tables through Phase 4 starter", () => {
    expect(persistenceTableNames).toEqual([
      "tenants",
      "access_profiles",
      "positions",
      "custom_field_definitions",
      "project_templates",
      "clients",
      "contacts",
      "products",
      "project_types",
      "deal_stages",
      "opportunities",
      "opportunity_demands",
      "projects",
      "project_position_demands",
      "tasks",
      "task_participants",
      "crm_activities",
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
      "clients",
      "contacts",
      "products",
      "project_types",
      "deal_stages",
      "opportunities",
      "opportunity_demands",
      "projects",
      "project_position_demands",
      "tasks",
      "task_participants",
      "crm_activities",
      "tenant_users",
      "user_credentials",
      "user_sessions",
      "audit_events"
    ]);

    for (const tableName of tenantOwnedTableNames) {
      expect(getPersistenceTableColumns(tableName)).toContain("tenant_id");
    }
  });

  it("keeps deals linked to tenant-scoped CRM entities", () => {
    expect(getPersistenceTableColumns("opportunities")).toEqual(
      expect.arrayContaining([
        "client_id",
        "owner_user_id",
        "primary_contact_id",
        "project_type_id",
        "stage_id"
      ])
    );
    expect(getPersistenceTableColumns("contacts")).toEqual(
      expect.arrayContaining(["client_id", "email", "phone", "telegram", "role"])
    );
    expect(getPersistenceTableColumns("deal_stages")).toEqual(
      expect.arrayContaining(["sort_order"])
    );
    expect(getPersistenceTableColumns("products")).toEqual(
      expect.arrayContaining(["sku", "type", "unit", "price", "status"])
    );
  });

  it("stores CRM activity on the shared CRM entity contract", () => {
    expect(getPersistenceTableColumns("crm_activities")).toEqual(
      expect.arrayContaining([
        "entity_type",
        "entity_id",
        "type",
        "title",
        "body",
        "status",
        "due_date",
        "assignee_user_id",
        "author_user_id",
        "file_url",
        "file_size_bytes",
        "mime_type"
      ])
    );
  });
});
