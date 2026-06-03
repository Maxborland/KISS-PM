import { createPostgresClient } from "@kiss-pm/persistence";
import { pathToFileURL } from "node:url";

export const defaultDevDatabaseUrl =
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";
export const resetDevDatabaseConfirmation = "truncate-local-dev-database";

if (isDirectRun()) {
  const databaseUrl = process.env.DATABASE_URL ?? defaultDevDatabaseUrl;

  assertLocalDevDatabase(databaseUrl, process.env.KISS_PM_RESET_DEV_DB_CONFIRM);

  const client = createPostgresClient(databaseUrl);

  try {
    await client`
      TRUNCATE
        workspace_agent_proposals,
        workspace_agent_messages,
        audit_events,
        crm_activities,
        task_activities,
        task_participants,
        action_executions,
        corrective_actions,
        control_signals,
        kpi_evaluations,
        kpi_definitions,
        planning_command_idempotency_keys,
        planning_solver_runs,
        planning_scenario_runs,
        resource_reservations,
        project_baseline_assignments,
        project_baseline_tasks,
        project_baselines,
        task_dependencies,
        task_assignment_allocations,
        task_assignments,
        resource_absences,
        tenant_user_org_placements,
        tenant_org_nodes,
        planning_saved_views,
        tenant_production_calendar_exceptions,
        tenant_production_calendars,
        calendar_exceptions,
        resource_calendars,
        project_calendars,
        plan_versions,
        tasks,
        user_sessions,
        user_credentials,
        tenant_users,
        project_position_demands,
        projects,
        opportunity_demands,
        opportunities,
        deal_stages,
        project_types,
        products,
        contacts,
        clients,
        project_templates,
        custom_field_definitions,
        positions,
        access_profiles,
        tenants
      RESTART IDENTITY CASCADE
    `;
    console.log("[db:reset:dev] Local dev database reset complete");
  } finally {
    await client.end();
  }
}

export function assertLocalDevDatabase(value: string, confirmation?: string): void {
  const parsed = new URL(value);
  if (isDocumentedComposeDevDatabase(parsed)) return;

  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!localHosts.has(parsed.hostname) || parsed.pathname !== "/kiss_pm") {
    throw new Error(
      `[db:reset:dev] Refusing to reset non-local dev database: ${parsed.hostname}${parsed.pathname}`
    );
  }
  if (confirmation !== resetDevDatabaseConfirmation) {
    throw new Error(
      `[db:reset:dev] Refusing to reset ${parsed.host}${parsed.pathname}. ` +
        `Use DATABASE_URL=${defaultDevDatabaseUrl} or set ` +
        `KISS_PM_RESET_DEV_DB_CONFIRM=${resetDevDatabaseConfirmation} for an intentional local reset.`
    );
  }
}

function isDocumentedComposeDevDatabase(parsed: URL): boolean {
  return (
    parsed.protocol === "postgres:" &&
    parsed.hostname === "127.0.0.1" &&
    parsed.port === "55432" &&
    parsed.pathname === "/kiss_pm" &&
    decodeURIComponent(parsed.username) === "kiss_pm" &&
    decodeURIComponent(parsed.password) === "kiss_pm_dev_password"
  );
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}
