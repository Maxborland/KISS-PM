import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ControlSignal, KpiDefinition, KpiEvaluation } from "@kiss-pm/domain";

import {
  createDatabase,
  createPostgresClient,
  seedTenantDataset,
  type PostgresClient,
  type SeedTenantDataset
} from "./index";
import { createControlRepository } from "./controlRepository";
import { projects } from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

const controlSeed: SeedTenantDataset = {
  tenants: [
    { id: "tenant-alpha", name: "Альфа Проект" },
    { id: "tenant-beta", name: "Бета Проект" }
  ],
  accessProfiles: [
    {
      id: "access-profile-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Администратор",
      permissions: [
        "tenant.kpi_definitions.read",
        "tenant.kpi_definitions.manage",
        "tenant.control_signals.read",
        "tenant.control_signals.manage",
        "tenant.management_actions.execute",
        "tenant.corrective_actions.manage"
      ]
    },
    {
      id: "access-profile-beta-admin",
      tenantId: "tenant-beta",
      name: "Администратор",
      permissions: ["tenant.control_signals.read"]
    }
  ],
  users: [
    {
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      email: "admin@alpha.local",
      name: "Анна Администратор",
      accessProfileId: "access-profile-alpha-admin",
      password: "admin12345"
    },
    {
      id: "user-beta-admin",
      tenantId: "tenant-beta",
      email: "admin@beta.local",
      name: "Борис Администратор",
      accessProfileId: "access-profile-beta-admin",
      password: "admin12345"
    }
  ]
};

describe("control repository", () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = createPostgresClient(databaseUrl);
  });

  beforeEach(async () => {
    await truncateControlDb(client);
    const db = createDatabase(client);
    await seedTenantDataset(db, controlSeed, new Date("2026-05-24T00:00:00.000Z"));
    await db.insert(projects).values([
      createProjectRow("tenant-alpha", "project-alpha"),
      createProjectRow("tenant-beta", "project-beta")
    ]);
  });

  afterAll(async () => {
    await truncateControlDb(client);
    await client.end();
  });

  it("persists KPI evaluations, signals, corrective actions and executions per project", async () => {
    const repository = createControlRepository(createDatabase(client));
    const definition = await repository.upsertKpiDefinition(createDefinition("tenant-alpha"));
    const updatedDefinition = await repository.upsertKpiDefinition({
      ...definition,
      id: "kpi-deadline-new-request-id",
      label: "Сдвиг срока проекта, обновлено"
    });
    await repository.upsertKpiDefinition({
      ...createDefinition("tenant-beta"),
      id: "kpi-beta",
      code: "project.beta"
    });

    const evaluation = await repository.createKpiEvaluation(createEvaluation(updatedDefinition));
    const signal = await repository.upsertControlSignal(createSignal(evaluation));
    const correctiveAction = await repository.createCorrectiveAction({
      id: "corrective-alpha",
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      controlSignalId: signal.id,
      title: "Уточнить план восстановления срока",
      description: null,
      responsibleUserId: null,
      dueDate: "2026-05-26",
      status: "open",
      result: null
    });
    const completedAction = await repository.updateCorrectiveAction({
      ...correctiveAction,
      status: "done",
      result: "План восстановлен"
    });
    const execution = await repository.createActionExecution({
      id: "action-exec-alpha",
      tenantId: "tenant-alpha",
      projectId: "project-alpha",
      actionType: "apply_planning_delta",
      targetEntity: { type: "ControlSignal", id: signal.id },
      actorUserId: "user-alpha-admin",
      input: { actionId: "action-alpha" },
      previewPayload: { status: "previewed" },
      resultPayload: { newPlanVersion: 8 },
      status: "succeeded",
      auditEventId: "audit-alpha",
      createdAt: new Date("2026-05-24T10:00:00.000Z")
    });

    expect(updatedDefinition).toEqual({
      ...definition,
      label: "Сдвиг срока проекта, обновлено"
    });
    expect(await repository.listKpiDefinitions("tenant-alpha")).toEqual([updatedDefinition]);
    expect(await repository.listKpiDefinitions("tenant-beta")).toHaveLength(1);
    expect(await repository.listKpiEvaluations("tenant-alpha", "project-alpha")).toEqual([
      { ...evaluation, calculatedValue: 2.5 }
    ]);
    expect(await repository.listKpiEvaluations("tenant-alpha", "project-beta")).toEqual([]);
    expect(await repository.listControlSignals("tenant-alpha", "project-alpha")).toEqual([signal]);
    expect(await repository.listCorrectiveActions("tenant-alpha", "project-alpha")).toEqual([completedAction]);
    expect(await repository.listActionExecutions("tenant-alpha", "project-alpha")).toEqual([execution]);
  });
});

async function truncateControlDb(client: PostgresClient) {
  await client`TRUNCATE action_executions, corrective_actions, control_signals, kpi_evaluations, kpi_definitions, projects, task_statuses, user_sessions, user_credentials, tenant_user_org_placements, tenant_org_nodes, tenant_users, access_profiles, tenants RESTART IDENTITY CASCADE`;
}

function createProjectRow(tenantId: string, id: string): typeof projects.$inferInsert {
  return {
    id,
    tenantId,
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: null,
    projectTypeId: null,
    title: id,
    clientName: "Internal",
    status: "active",
    plannedStart: new Date("2026-05-24T00:00:00.000Z"),
    plannedFinish: new Date("2026-05-31T00:00:00.000Z"),
    deadline: new Date("2026-05-30T00:00:00.000Z"),
    calendarId: null,
    contractValue: 0,
    plannedHours: 40,
    templateId: null,
    createdAt: new Date("2026-05-24T00:00:00.000Z"),
    activatedAt: new Date("2026-05-24T00:00:00.000Z")
  };
}

function createDefinition(tenantId: string): KpiDefinition {
  return {
    id: "kpi-deadline",
    tenantId,
    entityType: "project",
    code: "project.deadline_delta_days",
    label: "Сдвиг срока проекта",
    formula: { type: "builtin", key: "deadline_delta_days" },
    unit: "days",
    period: "snapshot",
    thresholdRules: [{ severity: "critical", operator: "gt", value: 0 }],
    ownerRole: "project_manager",
    allowedActions: ["apply_planning_delta"],
    version: 1,
    status: "active"
  };
}

function createEvaluation(definition: KpiDefinition): KpiEvaluation {
  return {
    id: "eval-alpha",
    tenantId: definition.tenantId,
    projectId: "project-alpha",
    definitionId: definition.id,
    definitionVersion: definition.version,
    formulaVersion: definition.version,
    sourceData: { planVersion: 7 },
    periodStart: null,
    periodEnd: null,
    threshold: { severity: "critical", operator: "gt", value: 0 },
    calculatedValue: 2.5,
    severity: "critical",
    evaluatedAt: "2026-05-24T09:00:00.000Z"
  };
}

function createSignal(evaluation: KpiEvaluation): ControlSignal {
  return {
    id: "signal-alpha",
    tenantId: evaluation.tenantId,
    projectId: evaluation.projectId,
    sourceEntity: { type: "Project", id: evaluation.projectId },
    sourceMetric: "deadline_delta_days",
    evaluationId: evaluation.id,
    severity: "critical",
    explanation: "Срок проекта сдвинут",
    ownerUserId: null,
    allowedActions: ["apply_planning_delta"],
    scenarioProposals: [
      {
        id: "action-alpha",
        type: "apply_planning_delta",
        label: "Применить корректировку",
        targetEntity: { type: "ControlSignal", id: "signal-alpha" },
        requiredPermissions: ["tenant.project_plan.manage"],
        planDelta: {
          commands: [],
          changedTaskIds: [],
          changedAssignmentIds: [],
          changedDependencyIds: [],
          acceptedRiskIds: []
        },
        input: {},
        explainability: {
          reason: "DB roundtrip",
          deadlineDeltaDays: 0,
          overloadMinutes: 0,
          changedTaskIds: [],
          changedAssignmentIds: [],
          riskScore: 0,
          cost: 0
        }
      }
    ],
    status: "open",
    createdAt: "2026-05-24T09:05:00.000Z",
    updatedAt: "2026-05-24T09:05:00.000Z"
  };
}
