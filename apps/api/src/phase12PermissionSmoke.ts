export type Phase12SmokeStatus = "not_run" | "passed" | "failed";

export type Phase12SmokeScenarioResult = {
  id: string;
  category: "permission" | "tenant_isolation";
  actorId: string;
  method: string;
  path: string;
  expectedStatus: number;
  actualStatus: number;
  status: "passed" | "failed";
  expected: string;
  actual: string;
  leakedForbiddenTerms: string[];
};

export type Phase12SmokeRun = {
  id: string;
  tenantId: string;
  status: Exclude<Phase12SmokeStatus, "not_run">;
  checkedAt: string;
  auditEventId: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  results: Phase12SmokeScenarioResult[];
};

export type Phase12SmokeReadModel = {
  tenantId: string;
  status: Phase12SmokeStatus;
  latestRun: Phase12SmokeRun | null;
};

type SmokeScenario = {
  id: string;
  category: "permission" | "tenant_isolation";
  actorId: string;
  method?: string;
  path: string;
  body?: unknown;
  expectedStatus: number;
  expected: string;
  forbiddenTerms?: string[];
};

type SmokeRequester = (path: string, init?: RequestInit) => Promise<Response>;

const PERMISSION_SMOKE_PROJECT_ID = "project-p12-permission-smoke";
const PERMISSION_SMOKE_DRAFT_ID = "project-draft-opportunity-seed-ready";

const permissionSmokeScenarios: SmokeScenario[] = [
  {
    id: "crm.read.allowed.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    path: "/api/crm/opportunities",
    expectedStatus: 200,
    expected: "Read-only observer can read CRM intake but not mutate it."
  },
  {
    id: "crm.write.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    method: "POST",
    path: "/api/crm/opportunities",
    body: {},
    expectedStatus: 403,
    expected: "Read-only observer is denied direct CRM opportunity writes."
  },
  {
    id: "project.task.write.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    method: "POST",
    path: `/api/projects/${PERMISSION_SMOKE_PROJECT_ID}/tasks`,
    body: {
      id: "task-p12-smoke-denied",
      title: "P12 smoke denied task",
      dueDate: "2026-06-12",
      plannedWorkHours: 4
    },
    expectedStatus: 403,
    expected: "Read-only observer is denied project task creation through Phase 4 work API."
  },
  {
    id: "schedule.task.write.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    method: "POST",
    path: `/api/projects/${PERMISSION_SMOKE_PROJECT_ID}/schedule/tasks`,
    body: {
      id: "task-p12-smoke-schedule-denied",
      title: "P12 smoke denied schedule task",
      plannedStartDate: "2026-06-08",
      plannedFinishDate: "2026-06-10",
      plannedWorkHours: 8,
      progressPercent: 0
    },
    expectedStatus: 403,
    expected: "Read-only observer is denied schedule task creation through Phase 5 Gantt API."
  },
  {
    id: "resource.write.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    method: "POST",
    path: "/api/resources/reservations",
    body: {},
    expectedStatus: 403,
    expected: "Read-only observer is denied resource reservation writes."
  },
  {
    id: "resource.preview.allowed.manager",
    category: "permission",
    actorId: "resource-manager-a",
    method: "POST",
    path: "/api/resources/overloads/overload:resource-architect-a:2026-06-01:2026-06-05/preview",
    body: {
      actionKey: "shift_work",
      assignmentId: "assignment-design-architect-a",
      shiftDays: 7,
      reason: "P12 permission smoke dry-run"
    },
    expectedStatus: 200,
    expected: "Resource manager can perform non-mutating resource resolution preview."
  },
  {
    id: "kpi.evaluate.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    method: "POST",
    path: "/api/kpi/evaluations/run",
    body: {},
    expectedStatus: 403,
    expected: "Read-only observer is denied KPI evaluation execution."
  },
  {
    id: "control.action.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    method: "POST",
    path: "/api/control/actions/action-accept-risk/preview",
    body: {
      target: {
        surfaceId: "portfolio-control",
        surfaceKey: "portfolio.control",
        rowId: "row-kpi-signal-kpi-schedule-variance-a",
        entityType: "kpi_signal",
        entityId: "signal-kpi-schedule-variance-a"
      },
      input: { reason: "P12 smoke denial" }
    },
    expectedStatus: 403,
    expected: "Read-only observer is denied governed control action preview."
  },
  {
    id: "retrospective.read.allowed.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    path: "/api/retrospectives/snapshots",
    expectedStatus: 200,
    expected: "Read-only observer can read retrospective snapshots without mutation capabilities."
  },
  {
    id: "tenant.config.export.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    path: "/api/tenant/configuration/export",
    expectedStatus: 403,
    expected: "Read-only observer is denied tenant configuration export."
  },
  {
    id: "integration.preview.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    method: "POST",
    path: "/api/integrations/import/preview",
    body: {},
    expectedStatus: 403,
    expected: "Read-only observer is denied integration import preview."
  },
  {
    id: "ops.recovery.execute.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    method: "POST",
    path: "/api/ops/recovery-smoke/run",
    body: { scenarioKey: "release-readiness-state" },
    expectedStatus: 403,
    expected: "Read-only observer is denied governed recovery smoke execution."
  },
  {
    id: "ops.readiness.read.denied.readonly",
    category: "permission",
    actorId: "readonly-observer-a",
    path: "/api/ops/release-readiness",
    expectedStatus: 403,
    expected: "Read-only observer is denied operator release-readiness read model."
  }
];

const tenantIsolationSmokeScenarios: SmokeScenario[] = [
  {
    id: "tenant-b.cannot-read-tenant-a-crm-opportunity",
    category: "tenant_isolation",
    actorId: "tenant-admin-b",
    path: "/api/crm/opportunities/opportunity-seed-ready",
    expectedStatus: 404,
    expected: "Tenant B cannot read Tenant A CRM opportunity.",
    forbiddenTerms: ["opportunity-seed-ready", "Seed ready opportunity", "project-draft-opportunity-seed-ready"]
  },
  {
    id: "tenant-b.cannot-read-tenant-a-resource-bucket",
    category: "tenant_isolation",
    actorId: "tenant-admin-b",
    path: "/api/resources/load/load:resource-architect-a:2026-06-01:2026-06-05",
    expectedStatus: 404,
    expected: "Tenant B cannot read Tenant A resource load bucket.",
    forbiddenTerms: ["resource-architect-a", "assignment-design-architect-a", "project-alpha-a"]
  },
  {
    id: "tenant-b.cannot-read-tenant-a-kpi-definition",
    category: "tenant_isolation",
    actorId: "tenant-admin-b",
    path: "/api/kpi/definitions/kpi-schedule-variance-a",
    expectedStatus: 404,
    expected: "Tenant B cannot read Tenant A KPI definition.",
    forbiddenTerms: ["kpi-schedule-variance-a", "schedule-variance-a"]
  },
  {
    id: "tenant-b.portfolio-view-excludes-tenant-a-rows",
    category: "tenant_isolation",
    actorId: "tenant-admin-b",
    path: "/api/control/surfaces/portfolio-control/view",
    expectedStatus: 200,
    expected: "Tenant B portfolio view returns only Tenant B rows and excludes Tenant A signals.",
    forbiddenTerms: ["project-alpha-a", "signal-kpi-schedule-variance-a", "resource-architect-a"]
  },
  {
    id: "tenant-b.cannot-read-tenant-a-project",
    category: "tenant_isolation",
    actorId: "tenant-admin-b",
    path: `/api/projects/${PERMISSION_SMOKE_PROJECT_ID}`,
    expectedStatus: 404,
    expected: "Tenant B cannot read Tenant A project identifier through project API.",
    forbiddenTerms: [PERMISSION_SMOKE_PROJECT_ID, "Seed ready opportunity"]
  },
  {
    id: "tenant-b.cannot-read-tenant-a-isolation-probe",
    category: "tenant_isolation",
    actorId: "tenant-admin-b",
    path: "/tenant-isolation-probes/probe-a-private",
    expectedStatus: 404,
    expected: "Tenant B cannot read Tenant A synthetic isolation probe.",
    forbiddenTerms: ["Закрытые данные Tenant A", "probe-a-private"]
  }
];

function withTestUser(path: string, actorId: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testUser=${encodeURIComponent(actorId)}`;
}

function createRequestInit(scenario: SmokeScenario): RequestInit | undefined {
  if (scenario.method === undefined || scenario.method === "GET") return undefined;

  return {
    method: scenario.method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(scenario.body ?? {})
  };
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

async function ensurePermissionSmokeProject(requester: SmokeRequester): Promise<void> {
  const existingProject = await requester(withTestUser(`/api/projects/${PERMISSION_SMOKE_PROJECT_ID}`, "project-manager-a"));
  if (existingProject.status === 200) {
    return;
  }
  if (existingProject.status !== 404) {
    throw Object.assign(new Error(`permission smoke setup readback failed with ${existingProject.status}`), {
      code: "permission_smoke_setup_failed"
    });
  }

  const draft = await requester(
    withTestUser("/api/crm/opportunities/opportunity-seed-ready/project-draft", "project-manager-a"),
    jsonRequest({})
  );
  if (draft.status !== 201 && draft.status !== 409) {
    throw Object.assign(new Error(`permission smoke setup draft failed with ${draft.status}`), {
      code: "permission_smoke_setup_failed"
    });
  }

  const project = await requester(
    withTestUser("/api/projects/from-template", "project-manager-a"),
    jsonRequest({ projectDraftId: PERMISSION_SMOKE_DRAFT_ID, projectId: PERMISSION_SMOKE_PROJECT_ID })
  );
  if (project.status !== 201 && project.status !== 409) {
    throw Object.assign(new Error(`permission smoke setup project failed with ${project.status}`), {
      code: "permission_smoke_setup_failed"
    });
  }
}

async function runScenario(requester: SmokeRequester, scenario: SmokeScenario): Promise<Phase12SmokeScenarioResult> {
  const response = await requester(withTestUser(scenario.path, scenario.actorId), createRequestInit(scenario));
  const responseText = await response.text();
  const leakedForbiddenTerms = (scenario.forbiddenTerms ?? []).filter((term) => responseText.includes(term));
  const passed = response.status === scenario.expectedStatus && leakedForbiddenTerms.length === 0;

  return {
    id: scenario.id,
    category: scenario.category,
    actorId: scenario.actorId,
    method: scenario.method ?? "GET",
    path: scenario.path,
    expectedStatus: scenario.expectedStatus,
    actualStatus: response.status,
    status: passed ? "passed" : "failed",
    expected: scenario.expected,
    actual:
      leakedForbiddenTerms.length > 0
        ? `status ${response.status}; leaked forbidden terms: ${leakedForbiddenTerms.join(", ")}`
        : `status ${response.status}`,
    leakedForbiddenTerms
  };
}

async function runScenarios(input: {
  idPrefix: "permission" | "tenant-isolation";
  tenantId: string;
  now: string;
  requester: SmokeRequester;
  scenarios: SmokeScenario[];
  runNumber: number;
}): Promise<Phase12SmokeRun> {
  const results = [];
  for (const scenario of input.scenarios) {
    results.push(await runScenario(input.requester, scenario));
  }
  const passed = results.filter((result) => result.status === "passed").length;
  const failed = results.length - passed;
  const id = `p12-${input.idPrefix}-smoke-${input.runNumber.toString().padStart(4, "0")}`;

  return {
    id,
    tenantId: input.tenantId,
    status: failed === 0 ? "passed" : "failed",
    checkedAt: input.now,
    auditEventId: `audit-${id}`,
    summary: {
      total: results.length,
      passed,
      failed
    },
    results
  };
}

function cloneRun(run: Phase12SmokeRun): Phase12SmokeRun {
  return {
    ...run,
    summary: { ...run.summary },
    results: run.results.map((result) => ({
      ...result,
      leakedForbiddenTerms: [...result.leakedForbiddenTerms]
    }))
  };
}

export function createPhase12PermissionIsolationSmokeRuntimeState() {
  const permissionRuns = new Map<string, Phase12SmokeRun>();
  const tenantIsolationRuns = new Map<string, Phase12SmokeRun>();
  let permissionCounter = 0;
  let tenantIsolationCounter = 0;

  return {
    readPermissionSmoke(tenantId: string): Phase12SmokeReadModel {
      const latestRun = permissionRuns.get(tenantId);
      return {
        tenantId,
        status: latestRun?.status ?? "not_run",
        latestRun: latestRun ? cloneRun(latestRun) : null
      };
    },

    async runPermissionSmoke(input: { tenantId: string; now: string; requester: SmokeRequester }): Promise<Phase12SmokeRun> {
      permissionCounter += 1;
      await ensurePermissionSmokeProject(input.requester);
      const run = await runScenarios({
        idPrefix: "permission",
        tenantId: input.tenantId,
        now: input.now,
        requester: input.requester,
        scenarios: permissionSmokeScenarios,
        runNumber: permissionCounter
      });
      permissionRuns.set(input.tenantId, cloneRun(run));
      return cloneRun(run);
    },

    readTenantIsolationSmoke(tenantId: string): Phase12SmokeReadModel {
      const latestRun = tenantIsolationRuns.get(tenantId);
      return {
        tenantId,
        status: latestRun?.status ?? "not_run",
        latestRun: latestRun ? cloneRun(latestRun) : null
      };
    },

    async runTenantIsolationSmoke(input: { tenantId: string; now: string; requester: SmokeRequester }): Promise<Phase12SmokeRun> {
      tenantIsolationCounter += 1;
      await ensurePermissionSmokeProject(input.requester);
      const run = await runScenarios({
        idPrefix: "tenant-isolation",
        tenantId: input.tenantId,
        now: input.now,
        requester: input.requester,
        scenarios: tenantIsolationSmokeScenarios,
        runNumber: tenantIsolationCounter
      });
      tenantIsolationRuns.set(input.tenantId, cloneRun(run));
      return cloneRun(run);
    }
  };
}
