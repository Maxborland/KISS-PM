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
      "task_statuses",
      "tasks",
      "plan_versions",
      "project_calendars",
      "resource_calendars",
      "calendar_exceptions",
      "task_assignments",
      "task_dependencies",
      "project_baselines",
      "project_baseline_tasks",
      "project_baseline_assignments",
      "resource_reservations",
      "planning_scenario_runs",
      "planning_command_idempotency_keys",
      "tenant_production_calendars",
      "tenant_production_calendar_exceptions",
      "planning_saved_views",
      "resource_absences",
      "tenant_org_nodes",
      "tenant_user_org_placements",
      "task_participants",
      "task_activities",
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
      "task_statuses",
      "tasks",
      "plan_versions",
      "project_calendars",
      "resource_calendars",
      "calendar_exceptions",
      "task_assignments",
      "task_dependencies",
      "project_baselines",
      "project_baseline_tasks",
      "project_baseline_assignments",
      "resource_reservations",
      "planning_scenario_runs",
      "planning_command_idempotency_keys",
      "tenant_production_calendars",
      "tenant_production_calendar_exceptions",
      "planning_saved_views",
      "resource_absences",
      "tenant_org_nodes",
      "tenant_user_org_placements",
      "task_participants",
      "task_activities",
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

  it("stores the Phase 4.2 task workspace contract", () => {
    expect(getPersistenceTableColumns("task_statuses")).toEqual(
      expect.arrayContaining([
        "id",
        "tenant_id",
        "name",
        "category",
        "sort_order",
        "status",
        "is_system"
      ])
    );
    expect(getPersistenceTableColumns("tasks")).toEqual(
      expect.arrayContaining([
        "status_id",
        "requester_user_id",
        "owner_user_id",
        "duration_working_days",
        "requires_acceptance",
        "archived_at"
      ])
    );
    expect(getPersistenceTableColumns("task_activities")).toEqual(
      expect.arrayContaining([
        "task_id",
        "type",
        "body",
        "file_url",
        "author_user_id"
      ])
    );
  });

  it("stores the Phase 5/6 planning persistence contract", () => {
    expect(getPersistenceTableColumns("projects")).toEqual(
      expect.arrayContaining(["source_type", "source_opportunity_id", "deadline", "calendar_id"])
    );
    expect(getPersistenceTableColumns("tasks")).toEqual(
      expect.arrayContaining([
        "parent_task_id",
        "wbs_code",
        "scheduling_mode",
        "task_type",
        "effort_driven",
        "duration_minutes",
        "work_minutes",
        "constraint_type",
        "constraint_date",
        "custom_fields"
      ])
    );
    expect(getPersistenceTableColumns("plan_versions")).toEqual(
      expect.arrayContaining(["tenant_id", "project_id", "version"])
    );
    expect(getPersistenceTableColumns("task_assignments")).toEqual(
      expect.arrayContaining(["task_id", "resource_id", "role", "units_permille", "work_minutes"])
    );
    expect(getPersistenceTableColumns("task_dependencies")).toEqual(
      expect.arrayContaining([
        "predecessor_task_id",
        "successor_task_id",
        "type",
        "lag_minutes"
      ])
    );
    expect(getPersistenceTableColumns("planning_scenario_runs")).toEqual(
      expect.arrayContaining([
        "plan_version",
        "engine_version",
        "target_conflict",
        "proposal_payload",
        "proposal_payload_hash",
        "expires_at"
      ])
    );
    expect(getPersistenceTableColumns("planning_command_idempotency_keys")).toEqual(
      expect.arrayContaining([
        "idempotency_key",
        "request_hash",
        "response_payload",
        "actor_user_id",
        "created_at"
      ])
    );
  });
});
