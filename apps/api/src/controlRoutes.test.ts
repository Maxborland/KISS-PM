import { describe, expect, it } from "vitest";

import type { Permission } from "@kiss-pm/access-control";
import type {
  ControlSignal,
  CorrectiveAction,
  KpiDefinition,
  ManagementActionCandidate,
  PlanSnapshot
} from "@kiss-pm/domain";

import { createApp } from "./app";
import type { ApiTenantDataSource } from "./apiTypes";

/* ============================================================
   Прицельные тесты для registerControlRoutes (controlRoutes.ts).
   Поверхность контроля: KPI-определения, read-model, evaluate,
   preview/apply управленческих действий, статус сигнала,
   корректирующие действия. Фикстура повторяет паттерн
   auditRoutes.test.ts / workspaceUserRoutes.test.ts: частичный
   in-memory data-source + createApp({ dataSource }); cookie-сессия.

   ПРИМЕЧАНИЕ О «поверхностях/publish/rollback»: версионные
   control-surfaces с publish→rollback живут в отдельном файле
   controlSurfaceRoutes.ts и уже покрыты controlSurfaceRoutes.test.ts.
   Здесь честный аналог «preview→publish меняет активную версию»
   — это preview→apply управленческого действия: apply инкрементит
   planVersion (активную версию плана), preview НЕ мутирует план.
   ============================================================ */

const TENANT = "tenant-alpha";
const PROJECT = "project-alpha";
const ACTOR_ID = "user-controller";
const SIGNAL_ID = "signal-alpha";
const ACTION_ID = "action-alpha";

const COOKIE =
  "kiss_pm_session=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const mutationHeaders = {
  cookie: COOKIE,
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin"
};

const FULL_PERMISSIONS: Permission[] = [
  "tenant.kpi_definitions.read",
  "tenant.kpi_definitions.manage",
  "tenant.control_signals.read",
  "tenant.control_signals.manage",
  "tenant.management_actions.execute",
  "tenant.corrective_actions.manage",
  "tenant.project_plan.read",
  "tenant.project_plan.manage",
  "tenant.project_resources.manage",
  "tenant.planning_scenarios.apply"
];

// Снапшот с двумя задачами (task-1 done, task-2 in-progress) — достаточно,
// чтобы прогнать реальный движок plan/evaluate без валидационных ошибок.
function createSnapshot(): PlanSnapshot {
  return {
    tenantId: TENANT,
    projectId: PROJECT,
    planVersion: 7,
    project: {
      id: PROJECT,
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-05-01",
      plannedFinish: "2026-05-10",
      deadline: "2026-05-10",
      calendarId: null
    },
    tasks: [
      {
        id: "task-1",
        parentTaskId: null,
        wbsCode: "1",
        title: "Discovery",
        statusId: "done",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-05-01",
        plannedFinish: "2026-05-04",
        plannedStartInstant: { date: "2026-05-01", minuteOfDay: 540 },
        plannedFinishInstant: { date: "2026-05-04", minuteOfDay: 1080 },
        durationMinutes: 960,
        workMinutes: 480,
        percentComplete: 100,
        calendarId: null,
        customFields: {},
        constraint: null
      },
      {
        id: "task-2",
        parentTaskId: null,
        wbsCode: "2",
        title: "Build",
        statusId: "in-progress",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-05-05",
        plannedFinish: "2026-05-10",
        plannedStartInstant: { date: "2026-05-05", minuteOfDay: 540 },
        plannedFinishInstant: { date: "2026-05-10", minuteOfDay: 1080 },
        durationMinutes: 1440,
        workMinutes: 240,
        percentComplete: 50,
        calendarId: null,
        customFields: {},
        constraint: null
      }
    ],
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-11T10:00:00.000Z"
  };
}

function actionCandidate(options: { withPlanDelta: boolean }): ManagementActionCandidate {
  const command = {
    type: "task.update_status" as const,
    payload: { taskId: "task-1", statusId: "done" }
  };
  return {
    id: ACTION_ID,
    type: "apply_planning_delta",
    label: "Пересчитать план",
    targetEntity: { type: "ControlSignal", id: SIGNAL_ID },
    requiredPermissions: options.withPlanDelta ? ["tenant.project_plan.manage"] : [],
    planDelta: options.withPlanDelta
      ? {
          commands: [command],
          changedTaskIds: ["task-1"],
          changedAssignmentIds: [],
          changedDependencyIds: [],
          acceptedRiskIds: []
        }
      : null,
    input: {},
    explainability: {
      reason: "Срок проекта под угрозой",
      deadlineDeltaDays: 2,
      overloadMinutes: 0,
      changedTaskIds: ["task-1"],
      changedAssignmentIds: [],
      riskScore: 0.4,
      cost: 0
    }
  };
}

function seedSignal(options: { withPlanDelta: boolean }): ControlSignal {
  return {
    id: SIGNAL_ID,
    tenantId: TENANT,
    projectId: PROJECT,
    sourceEntity: { type: "KpiDefinition", id: "kpi-project-deadline-delta" },
    sourceMetric: "deadline_delta_days",
    evaluationId: "evaluation-alpha",
    severity: "warning",
    explanation: "Сдвиг срока проекта",
    ownerUserId: null,
    allowedActions: ["apply_planning_delta"],
    scenarioProposals: [actionCandidate(options)],
    status: "open",
    createdAt: "2026-05-11T10:00:00.000Z",
    updatedAt: "2026-05-11T10:00:00.000Z"
  };
}

function seedCorrectiveAction(): CorrectiveAction {
  return {
    id: "corrective-alpha",
    tenantId: TENANT,
    projectId: PROJECT,
    controlSignalId: SIGNAL_ID,
    title: "Перераспределить нагрузку",
    description: null,
    responsibleUserId: null,
    dueDate: null,
    status: "open",
    result: null
  };
}

type HarnessOptions = {
  permissions?: Permission[];
  planSnapshot?: PlanSnapshot | null;
  signals?: ControlSignal[];
  correctiveActions?: CorrectiveAction[];
  kpiDefinitions?: KpiDefinition[];
};

function createHarness(options: HarnessOptions = {}) {
  const permissions = options.permissions ?? FULL_PERMISSIONS;
  const planSnapshot =
    options.planSnapshot === undefined ? createSnapshot() : options.planSnapshot;
  const signals = options.signals ?? [seedSignal({ withPlanDelta: true })];
  const correctiveActions = options.correctiveActions ?? [];
  const kpiDefinitions = options.kpiDefinitions ?? [];

  const state = {
    kpiDefinitions: [...kpiDefinitions],
    evaluations: [] as Array<{ id: string }>,
    signals: [...signals],
    correctiveActions: [...correctiveActions],
    actionExecutions: [] as Array<Record<string, unknown>>,
    auditEvents: [] as Array<{ actionType: string; executionResult: Record<string, unknown> }>,
    appliedCommands: [] as unknown[],
    planVersion: planSnapshot?.planVersion ?? 0
  };

  const dataSource: Partial<ApiTenantDataSource> = {
    async findSessionByTokenHash() {
      return {
        id: "session-controller",
        tenantId: TENANT,
        userId: ACTOR_ID,
        tokenHash: "ignored",
        expiresAt: new Date("2099-01-01T00:00:00.000Z")
      };
    },
    async findUserById(userId) {
      return userId === ACTOR_ID
        ? { id: ACTOR_ID, tenantId: TENANT, name: "Контролёр", accessProfileId: "profile-1" }
        : undefined;
    },
    async findAccessProfileById() {
      return { id: "profile-1", permissions };
    },
    async withTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    },
    async appendAuditEvent(input) {
      state.auditEvents.push(input as unknown as (typeof state.auditEvents)[number]);
    },
    async listKpiDefinitions() {
      return state.kpiDefinitions;
    },
    async upsertKpiDefinition(definition) {
      state.kpiDefinitions = state.kpiDefinitions
        .filter((candidate) => candidate.id !== definition.id)
        .concat(definition);
      return definition;
    },
    async listKpiEvaluations() {
      return [];
    },
    async createKpiEvaluation(evaluation) {
      state.evaluations.push(evaluation);
      return evaluation;
    },
    async listControlSignals() {
      return state.signals;
    },
    async upsertControlSignal(signal) {
      state.signals = state.signals
        .filter((candidate) => candidate.id !== signal.id)
        .concat(signal);
      return signal;
    },
    async listCorrectiveActions() {
      return state.correctiveActions;
    },
    async createCorrectiveAction(action) {
      state.correctiveActions.push(action);
      return action;
    },
    async updateCorrectiveAction(action) {
      state.correctiveActions = state.correctiveActions
        .filter((candidate) => candidate.id !== action.id)
        .concat(action);
      return action;
    },
    async listActionExecutions() {
      return [];
    },
    async createActionExecution(execution) {
      const record = { ...execution, createdAt: execution.createdAt ?? new Date() };
      state.actionExecutions.push(record as Record<string, unknown>);
      return record;
    },
    async listAuditEventsByTenantId() {
      return [];
    }
  };

  if (planSnapshot !== null) {
    dataSource.getPlanSnapshot = async () => planSnapshot ?? undefined;
    dataSource.lockTenantResourcePlanning = async () => {};
    dataSource.applyPlanningCommand = async ({ command }) => {
      state.appliedCommands.push(command);
    };
    dataSource.incrementPlanVersion = async () => {
      state.planVersion += 1;
      return state.planVersion;
    };
  } else {
    dataSource.getPlanSnapshot = async () => undefined;
  }

  return { app: createApp({ dataSource: dataSource as ApiTenantDataSource }), state };
}

describe("GET /api/tenant/current/kpi-definitions", () => {
  it("возвращает дефолтные определения актору с правом чтения", async () => {
    const { app } = createHarness();
    const response = await app.request("/api/tenant/current/kpi-definitions", {
      headers: { cookie: COOKIE }
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { definitions: KpiDefinition[] };
    expect(payload.definitions.length).toBeGreaterThan(0);
  });

  it("401 без сессии, 403 без tenant.kpi_definitions.read", async () => {
    const anonymous = await createHarness().app.request("/api/tenant/current/kpi-definitions");
    expect(anonymous.status).toBe(401);

    const denied = await createHarness({ permissions: ["tenant.projects.read"] }).app.request(
      "/api/tenant/current/kpi-definitions",
      { headers: { cookie: COOKIE } }
    );
    expect(denied.status).toBe(403);
  });
});

describe("POST /api/tenant/current/kpi-definitions", () => {
  const body = {
    code: "project.custom_kpi",
    label: "Кастомный KPI",
    formula: { type: "builtin", key: "deadline_delta_days" },
    unit: "days",
    period: "snapshot",
    status: "active",
    version: 1,
    thresholdRules: [{ severity: "warning", operator: "gt", value: 0 }],
    allowedActions: ["create_corrective_action"]
  };

  it("сохраняет определение и возвращает auditEventId (happy-path)", async () => {
    const { app, state } = createHarness();
    const response = await app.request("/api/tenant/current/kpi-definitions", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify(body)
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      definition: KpiDefinition;
      auditEventId: string;
    };
    expect(payload.definition.code).toBe("project.custom_kpi");
    expect(payload.auditEventId).toBeTruthy();
    expect(state.kpiDefinitions.some((d) => d.code === "project.custom_kpi")).toBe(true);
  });

  it("400 на некорректное тело", async () => {
    const { app } = createHarness();
    const response = await app.request("/api/tenant/current/kpi-definitions", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({ label: "нет кода" })
    });
    expect(response.status).toBe(400);
  });

  it("403 без tenant.kpi_definitions.manage и пишет denied-аудит", async () => {
    const { app, state } = createHarness({ permissions: ["tenant.kpi_definitions.read"] });
    const response = await app.request("/api/tenant/current/kpi-definitions", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify(body)
    });
    expect(response.status).toBe(403);
    expect(
      state.auditEvents.some((event) => event.actionType === "kpi.definition.upsert_denied")
    ).toBe(true);
  });
});

describe("GET /api/workspace/projects/:projectId/control/read-model", () => {
  it("отдаёт агрегированную read-model актору с правами чтения", async () => {
    const { app } = createHarness();
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/read-model`,
      { headers: { cookie: COOKIE } }
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      definitions: unknown[];
      signals: ControlSignal[];
    };
    expect(payload.signals.map((signal) => signal.id)).toContain(SIGNAL_ID);
    expect(payload.definitions.length).toBeGreaterThan(0);
  });

  it("403 без tenant.control_signals.read", async () => {
    const { app } = createHarness({
      permissions: ["tenant.project_plan.read", "tenant.kpi_definitions.read"]
    });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/read-model`,
      { headers: { cookie: COOKIE } }
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /api/workspace/projects/:projectId/control/evaluate", () => {
  it("прогоняет KPI-движок и персистит оценки (happy-path)", async () => {
    const { app, state } = createHarness();
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/evaluate`,
      { method: "POST", headers: mutationHeaders, body: JSON.stringify({}) }
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { evaluations: unknown[] };
    expect(payload.evaluations.length).toBeGreaterThan(0);
    expect(state.evaluations.length).toBeGreaterThan(0);
  });

  it("404 для неизвестного проекта (нет снапшота плана)", async () => {
    const { app } = createHarness({ planSnapshot: null });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/evaluate`,
      { method: "POST", headers: mutationHeaders, body: JSON.stringify({}) }
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "project_not_found" });
  });

  it("403 без tenant.control_signals.manage", async () => {
    const { app } = createHarness({
      permissions: ["tenant.project_plan.read", "tenant.control_signals.read"]
    });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/evaluate`,
      { method: "POST", headers: mutationHeaders, body: JSON.stringify({}) }
    );
    expect(response.status).toBe(403);
  });
});

describe("preview→apply управленческого действия (честность активной версии)", () => {
  it("preview записывает previewed-исполнение и НЕ меняет активную версию плана", async () => {
    const { app, state } = createHarness();
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/actions/${ACTION_ID}/preview`,
      { method: "POST", headers: mutationHeaders, body: JSON.stringify({}) }
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { execution: { status: string } };
    expect(payload.execution.status).toBe("previewed");
    // Честность: preview не инкрементит planVersion и не применяет команды.
    expect(state.planVersion).toBe(7);
    expect(state.appliedCommands).toHaveLength(0);
  });

  it("apply применяет planDelta и инкрементит активную версию плана 7→8", async () => {
    const { app, state } = createHarness();
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/actions/${ACTION_ID}/apply`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ clientPlanVersion: 7 })
      }
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { newPlanVersion: number };
    expect(payload.newPlanVersion).toBe(8);
    expect(state.planVersion).toBe(8);
    expect(state.appliedCommands).toHaveLength(1);
  });

  it("apply отклоняет предложение без planDelta (400) — preview-only не публикуется", async () => {
    const { app } = createHarness({ signals: [seedSignal({ withPlanDelta: false })] });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/actions/${ACTION_ID}/apply`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ clientPlanVersion: 7 })
      }
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "action_candidate_has_no_plan_delta"
    });
  });

  it("apply возвращает 409 plan_version_conflict при устаревшем clientPlanVersion", async () => {
    const { app } = createHarness();
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/actions/${ACTION_ID}/apply`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ clientPlanVersion: 3 })
      }
    );
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string; currentPlanVersion: number };
    expect(payload.error).toBe("plan_version_conflict");
    expect(payload.currentPlanVersion).toBe(7);
  });

  it("404 для неизвестного действия в сигнале", async () => {
    const { app } = createHarness();
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/actions/action-ghost/preview`,
      { method: "POST", headers: mutationHeaders, body: JSON.stringify({}) }
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "action_candidate_not_found" });
  });

  it("403 без tenant.management_actions.execute + denied-аудит", async () => {
    const { app, state } = createHarness({
      permissions: ["tenant.control_signals.read", "tenant.project_plan.manage"]
    });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/actions/${ACTION_ID}/preview`,
      { method: "POST", headers: mutationHeaders, body: JSON.stringify({}) }
    );
    expect(response.status).toBe(403);
    expect(
      state.auditEvents.some((event) => event.actionType === "management_action.denied")
    ).toBe(true);
  });
});

describe("POST /api/workspace/projects/:projectId/control/signals/:signalId/status", () => {
  it("меняет статус сигнала open→acknowledged (happy-path)", async () => {
    const { app } = createHarness();
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/status`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ status: "acknowledged" })
      }
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { signal: ControlSignal };
    expect(payload.signal.status).toBe("acknowledged");
  });

  it("404 для неизвестного сигнала", async () => {
    const { app } = createHarness({ signals: [] });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/status`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ status: "acknowledged" })
      }
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "control_signal_not_found" });
  });

  it("403 без tenant.control_signals.manage", async () => {
    const { app } = createHarness({ permissions: ["tenant.control_signals.read"] });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/status`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ status: "acknowledged" })
      }
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /api/workspace/projects/:projectId/control/signals/:signalId/corrective-actions", () => {
  it("создаёт корректирующее действие для сигнала (happy-path)", async () => {
    const { app, state } = createHarness();
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/corrective-actions`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ title: "Добавить ресурс" })
      }
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { correctiveAction: CorrectiveAction };
    expect(payload.correctiveAction.title).toBe("Добавить ресурс");
    expect(state.correctiveActions).toHaveLength(1);
  });

  it("404 для неизвестного сигнала", async () => {
    const { app } = createHarness({ signals: [] });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/corrective-actions`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ title: "Добавить ресурс" })
      }
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "control_signal_not_found" });
  });

  it("403 без tenant.corrective_actions.manage", async () => {
    const { app } = createHarness({ permissions: ["tenant.control_signals.read"] });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/signals/${SIGNAL_ID}/corrective-actions`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ title: "Добавить ресурс" })
      }
    );
    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/workspace/projects/:projectId/control/corrective-actions/:correctiveActionId", () => {
  it("обновляет статус корректирующего действия (happy-path)", async () => {
    const { app } = createHarness({ correctiveActions: [seedCorrectiveAction()] });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/corrective-actions/corrective-alpha`,
      {
        method: "PATCH",
        headers: mutationHeaders,
        body: JSON.stringify({ status: "in_progress" })
      }
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { correctiveAction: CorrectiveAction };
    expect(payload.correctiveAction.status).toBe("in_progress");
  });

  it("404 для неизвестного корректирующего действия", async () => {
    const { app } = createHarness({ correctiveActions: [] });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/corrective-actions/corrective-alpha`,
      {
        method: "PATCH",
        headers: mutationHeaders,
        body: JSON.stringify({ status: "in_progress" })
      }
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "corrective_action_not_found" });
  });

  it("403 без tenant.corrective_actions.manage", async () => {
    const { app } = createHarness({
      permissions: ["tenant.control_signals.read"],
      correctiveActions: [seedCorrectiveAction()]
    });
    const response = await app.request(
      `/api/workspace/projects/${PROJECT}/control/corrective-actions/corrective-alpha`,
      {
        method: "PATCH",
        headers: mutationHeaders,
        body: JSON.stringify({ status: "in_progress" })
      }
    );
    expect(response.status).toBe(403);
  });
});
