import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabase,
  createPostgresClient,
  createPostgresTenantDataSource,
  createTenantAdminSeedProfile,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

import { createApp } from "./app";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const dataset: SeedTenantDataset = {
  tenants: [{ id: "tenant-alpha", name: "Alpha" }],
  accessProfiles: [
    createTenantAdminSeedProfile({ id: "access-profile-admin", tenantId: "tenant-alpha" })
  ],
  clients: [{ id: "client-alpha", tenantId: "tenant-alpha", name: "Alpha Client" }],
  projectTypes: [{ id: "project-type-alpha", tenantId: "tenant-alpha", name: "Implementation" }],
  users: [
    {
      id: "user-admin",
      tenantId: "tenant-alpha",
      email: "admin@kiss-pm.local",
      name: "Admin",
      accessProfileId: "access-profile-admin",
      password: "admin12345"
    }
  ]
};

describe("operational control queue API DB", () => {
  let client: PostgresClient;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
    app = createApp({ dataSource: createPostgresTenantDataSource(createDatabase(client)) });
  });

  beforeEach(async () => {
    await truncateDatabase(client);
    await seedTenantDataset(createDatabase(client), dataset, new Date("2026-06-01T00:00:00.000Z"));
    const dataSource = createPostgresTenantDataSource(createDatabase(client));
    await createActiveProject(dataSource);
    await dataSource.upsertControlSignal({
      id: "signal-critical",
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      sourceEntity: { type: "Project", id: "project-alpha" },
      sourceMetric: "resource_overload_minutes",
      evaluationId: null,
      severity: "critical",
      explanation: "Persisted critical signal",
      ownerUserId: "user-admin",
      allowedActions: ["create_corrective_action"],
      scenarioProposals: [],
      status: "open",
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z"
    });
    await dataSource.upsertControlSignal({
      id: "signal-resolved",
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      sourceEntity: { type: "Project", id: "project-alpha" },
      sourceMetric: "baseline_finish_slip_days",
      evaluationId: null,
      severity: "critical",
      explanation: "Resolved signal",
      ownerUserId: null,
      allowedActions: [],
      scenarioProposals: [],
      status: "resolved",
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z"
    });
    await dataSource.createCorrectiveAction({
      id: "action-overdue",
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      controlSignalId: "signal-critical",
      title: "Persisted overdue action",
      description: null,
      responsibleUserId: "user-admin",
      dueDate: "2026-06-07",
      status: "open",
      result: null
    });
    await dataSource.appendAuditEvent({
      id: "audit-denied",
      tenantId: "tenant-alpha",
      actorUserId: "user-admin",
      actionType: "management_action.denied",
      sourceSurfaceId: null,
      sourceWorkflow: "control",
      sourceEntity: { type: "Project", id: "project-alpha" },
      input: { projectId: "project-alpha" },
      beforeState: null,
      afterState: null,
      permissionResult: { allowed: false, reason: "permission_missing" },
      executionResult: { status: "denied" },
      correlationId: "correlation-denied",
      createdAt: new Date("2026-06-08T10:00:00.000Z")
    });
  });

  afterAll(async () => {
    await truncateDatabase(client);
    await client.end();
  });

  it("reads persisted tenant control records through the route", async () => {
    const cookie = await loginAs("admin@kiss-pm.local", "admin12345");

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=10",
      { headers: { cookie } }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string }> };
    expect(body.items.map((item) => item.id)).toEqual([
      "corrective-action:project-alpha:action-overdue",
      "project-overdue:project-alpha",
      "control-signal:project-alpha:signal-critical",
      "audit-event:project-alpha:audit-denied"
    ]);
    expect(body.items.some((item) => item.id.includes("signal-resolved"))).toBe(false);
  });

  async function loginAs(email: string, password: string) {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie") ?? "";
  }
});

async function createActiveProject(dataSource: ReturnType<typeof createPostgresTenantDataSource>) {
  const opportunity = await dataSource.createOpportunity({
    id: "opportunity-alpha",
    tenantId: "tenant-alpha",
    clientId: "client-alpha",
    primaryContactId: null,
    projectTypeId: "project-type-alpha",
    stageId: null,
    clientName: "Alpha Client",
    contactName: "Owner",
    title: "Operational project",
    projectType: "Implementation",
    description: null,
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-08T00:00:00.000Z"),
    contractValue: 100000,
    plannedHourlyRate: 5000,
    plannedHours: 80,
    probability: 80,
    status: "ready_to_activate",
    templateId: null,
    demand: []
  });
  const draft = await dataSource.createProjectDraftFromOpportunity({
    id: "project-alpha",
    tenantId: "tenant-alpha",
    sourceOpportunityId: opportunity.id,
    clientId: opportunity.clientId,
    projectTypeId: opportunity.projectTypeId,
    title: opportunity.title,
    clientName: opportunity.clientName,
    status: "draft",
    plannedStart: opportunity.plannedStart,
    plannedFinish: opportunity.plannedFinish,
    contractValue: opportunity.contractValue,
    plannedHours: opportunity.plannedHours,
    templateId: null,
    demand: []
  });
  await dataSource.activateProjectDraft({ tenantId: "tenant-alpha", projectId: draft.id });
}

async function truncateDatabase(client: PostgresClient) {
  await client`
    TRUNCATE
      audit_events,
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
      resource_calendar_events,
      resource_personal_calendars,
      tenant_production_calendar_exceptions,
      tenant_production_calendars,
      calendar_exceptions,
      resource_calendars,
      project_calendars,
      plan_versions,
      tasks,
      task_statuses,
      user_sessions,
      user_credentials,
      tenant_user_org_placements,
      tenant_org_nodes,
      tenant_users,
      project_position_demands,
      projects,
      opportunity_demands,
      opportunities,
      contacts,
      clients,
      project_types,
      positions,
      access_profiles,
      tenants
    RESTART IDENTITY CASCADE
  `;
}
