import {
  createDatabase,
  createPostgresTenantDataSource,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "@kiss-pm/persistence";

import type { createApp } from "./app";
import { createTenantScenarioDataset } from "./scenarioTestFixtures";

type TestApp = ReturnType<typeof createApp>;

export const planningRouteTestDataset: SeedTenantDataset = createTenantScenarioDataset({
  accessProfiles: [
    {
      id: "access-profile-reader",
      tenantId: "tenant-alpha",
      name: "Наблюдатель планирования",
      permissions: ["tenant.projects.read", "tenant.project_plan.read", "tenant.project_resources.read"]
    },
    {
      id: "access-profile-plan-reader-no-resources",
      tenantId: "tenant-alpha",
      name: "Наблюдатель плана без ресурсов",
      permissions: ["tenant.projects.read", "tenant.project_plan.read"]
    },
    {
      id: "access-profile-plan-manager-no-read",
      tenantId: "tenant-alpha",
      name: "Менеджер плана без чтения",
      permissions: ["tenant.project_plan.manage"]
    },
    {
      id: "access-profile-plan-resource-manager-no-read",
      tenantId: "tenant-alpha",
      name: "Менеджер плана и ресурсов без чтения",
      permissions: ["tenant.project_plan.manage", "tenant.project_resources.manage"]
    },
    {
      id: "access-profile-plan-manager-reader-no-resource-manage",
      tenantId: "tenant-alpha",
      name: "Менеджер плана без управления ресурсами",
      permissions: [
        "tenant.projects.read",
        "tenant.project_plan.read",
        "tenant.project_resources.read",
        "tenant.project_plan.manage"
      ]
    },
    {
      id: "access-profile-scenario-operator-no-read",
      tenantId: "tenant-alpha",
      name: "Оператор сценариев без чтения",
      permissions: ["tenant.planning_scenarios.preview", "tenant.planning_scenarios.apply"]
    }
  ],
  users: [
    {
      id: "user-alpha-executor",
      tenantId: "tenant-alpha",
      email: "executor@kiss-pm.local",
      name: "Егор Исполнитель",
      accessProfileId: "access-profile-reader",
      positionId: "position-engineer",
      password: "local-executor-password"
    },
    {
      id: "user-alpha-plan-reader-no-resources",
      tenantId: "tenant-alpha",
      email: "plan-reader-no-resources@kiss-pm.local",
      name: "Никита Без Ресурсов",
      accessProfileId: "access-profile-plan-reader-no-resources",
      positionId: "position-engineer",
      password: "local-reader-password"
    },
    {
      id: "user-alpha-plan-manager-no-read",
      tenantId: "tenant-alpha",
      email: "plan-manager-no-read@kiss-pm.local",
      name: "Марина Без Чтения",
      accessProfileId: "access-profile-plan-manager-no-read",
      positionId: "position-manager",
      password: "local-manager-password"
    },
    {
      id: "user-alpha-plan-resource-manager-no-read",
      tenantId: "tenant-alpha",
      email: "plan-resource-manager-no-read@kiss-pm.local",
      name: "Марина Ресурсы Без Чтения",
      accessProfileId: "access-profile-plan-resource-manager-no-read",
      positionId: "position-manager",
      password: "local-manager-password"
    },
    {
      id: "user-alpha-plan-manager-reader-no-resource-manage",
      tenantId: "tenant-alpha",
      email: "plan-manager-reader-no-resource-manage@kiss-pm.local",
      name: "Павел План Без Ресурсов",
      accessProfileId: "access-profile-plan-manager-reader-no-resource-manage",
      positionId: "position-manager",
      password: "local-manager-password"
    },
    {
      id: "user-alpha-scenario-no-read",
      tenantId: "tenant-alpha",
      email: "scenario-no-read@kiss-pm.local",
      name: "Семен Без Чтения",
      accessProfileId: "access-profile-scenario-operator-no-read",
      positionId: "position-manager",
      password: "scenario12345"
    }
  ]
});

export async function resetPlanningRouteTestData(client: PostgresClient): Promise<void> {
  await client`TRUNCATE audit_events, planning_command_idempotency_keys, planning_solver_runs, planning_scenario_runs, resource_reservations, project_baseline_assignments, project_baseline_tasks, project_baselines, task_dependencies, task_assignment_allocations, task_assignments, calendar_exceptions, resource_calendars, project_calendars, plan_versions, task_activities, task_participants, tasks, user_sessions, user_credentials, tenant_users, project_position_demands, projects, opportunity_demands, opportunities, products, contacts, clients, project_types, deal_stages, custom_field_definitions, project_templates, positions, access_profiles, tenants RESTART IDENTITY CASCADE`;
}

export async function seedPlanningRouteTestData(client: PostgresClient): Promise<void> {
  await seedTenantDataset(
    createDatabase(client),
    planningRouteTestDataset,
    new Date("2026-05-21T00:00:00.000Z")
  );
  await createActivePlanningTestProject(client);
}

export async function loginPlanningTestUser(
  app: TestApp,
  email: string,
  password: string
): Promise<string> {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (response.status !== 200) {
    throw new Error(`planning_test_login_failed:${email}:${response.status}`);
  }
  return response.headers.get("set-cookie") ?? "";
}

export async function createActivePlanningTestProject(client: PostgresClient): Promise<void> {
  const dataSource = createPostgresTenantDataSource(createDatabase(client));
  const opportunity = await dataSource.createOpportunity({
    id: "opportunity-alpha",
    tenantId: "tenant-alpha",
    clientId: "client-romashka",
    primaryContactId: null,
    projectTypeId: "project-type-implementation",
    stageId: null,
    clientName: "ООО Ромашка",
    contactName: "Ирина Клиент",
    title: "Внедрение KISS PM",
    projectType: "Внедрение",
    description: null,
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 1_000_000,
    plannedHourlyRate: 5_000,
    plannedHours: 200,
    probability: 80,
    status: "ready_to_activate",
    templateId: null,
    demand: [{ positionId: "position-engineer", requiredHours: 80 }]
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
    demand: opportunity.demand
  });
  await dataSource.activateProjectDraft({
    tenantId: "tenant-alpha",
    projectId: draft.id
  });
}

export async function createPlanningTestTask(
  app: TestApp,
  cookie: string,
  input: {
    id: string;
    title: string;
    start: string;
    finish: string;
    plannedWork?: number;
  }
): Promise<void> {
  const response = await app.request("/api/workspace/projects/project-alpha/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin",
      cookie
    },
    body: JSON.stringify({
      id: input.id,
      title: input.title,
      plannedStart: input.start,
      plannedFinish: input.finish,
      plannedWork: input.plannedWork ?? 16,
      participants: [{ userId: "user-alpha-executor", role: "executor" }]
    })
  });
  if (response.status !== 201) {
    throw new Error(`planning_test_task_create_failed:${input.id}:${response.status}`);
  }
}
