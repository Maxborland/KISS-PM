import { describe, expect, it } from "vitest";
import type { AccessProfile } from "@kiss-pm/access-control";
import type { PlanSnapshot, TenantUser } from "@kiss-pm/domain";
import type { PlanningForecastRunRecord } from "@kiss-pm/persistence";

import { createApp } from "./app";
import type { ApiTenantDataSource } from "./apiTypes";

const authHeaders = {
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin",
  cookie: "kiss_pm_session=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
};

describe("planning forecast API", () => {
  it("creates and reads a persisted manager-safe forecast run", async () => {
    const harness = createApiHarness();

    const createResponse = await harness.app.request(
      "/api/workspace/projects/project-forecast/planning/forecast-runs",
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ clientPlanVersion: 3 })
      }
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createBody).toMatchObject({
      projectId: "project-forecast",
      clientPlanVersion: 3,
      health: expect.any(String),
      managerSummary: expect.any(String),
      riskDrivers: expect.any(Array),
      recommendations: expect.any(Array),
      engineVersion: expect.any(String)
    });
    expect(createBody.runId).toMatch(/^planning-forecast-/);
    expect(createBody.engineDebug).toBeUndefined();
    expect(JSON.stringify(createBody).toLowerCase()).not.toContain("probability distribution");
    expect(harness.auditActionTypes).toEqual(["planning.forecast.run_created"]);

    const getResponse = await harness.app.request(
      `/api/workspace/projects/project-forecast/planning/forecast-runs/${createBody.runId}`,
      { headers: { cookie: authHeaders.cookie } }
    );
    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody).toMatchObject({
      runId: createBody.runId,
      projectId: "project-forecast",
      managerSummary: createBody.managerSummary
    });
    expect(getBody.engineDebug).toBeUndefined();
  });

  it("requires a session", async () => {
    const harness = createApiHarness({ actor: null });

    const response = await harness.app.request(
      "/api/workspace/projects/project-forecast/planning/forecast-runs",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify({ clientPlanVersion: 3 })
      }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "session_required" });
  });

  it("requires project plan read permission", async () => {
    const harness = createApiHarness({ permissions: [] });

    const response = await harness.app.request(
      "/api/workspace/projects/project-forecast/planning/forecast-runs",
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ clientPlanVersion: 3 })
      }
    );

    expect(response.status).toBe(403);
  });

  it("rejects stale client plan versions", async () => {
    const harness = createApiHarness();

    const response = await harness.app.request(
      "/api/workspace/projects/project-forecast/planning/forecast-runs",
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ clientPlanVersion: 2 })
      }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "plan_version_conflict", currentPlanVersion: 3 });
  });

  it("reports missing persistence without creating a run", async () => {
    const harness = createApiHarness({ omitForecastPersistence: true });

    const response = await harness.app.request(
      "/api/workspace/projects/project-forecast/planning/forecast-runs",
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ clientPlanVersion: 3 })
      }
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "persistence_not_configured" });
    expect(harness.storedRuns.size).toBe(0);
  });

  it("reports missing audit persistence before creating a run", async () => {
    const harness = createApiHarness({ omitAuditPersistence: true });

    const response = await harness.app.request(
      "/api/workspace/projects/project-forecast/planning/forecast-runs",
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ clientPlanVersion: 3 })
      }
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "persistence_not_configured" });
    expect(harness.storedRuns.size).toBe(0);
  });
});

type HarnessInput = {
  actor?: TenantUser | null;
  permissions?: AccessProfile["permissions"];
  omitForecastPersistence?: boolean;
  omitAuditPersistence?: boolean;
};

function createApiHarness(input: HarnessInput = {}) {
  const actor =
    input.actor === undefined
      ? {
          id: "user-forecast-admin",
          tenantId: "tenant-forecast",
          name: "Planner",
          accessProfileId: "forecast-profile"
        }
      : input.actor;
  const permissions = input.permissions ?? ["tenant.project_plan.read"];
  const snapshot = createSnapshot();
  const storedRuns = new Map<string, PlanningForecastRunRecord>();
  const auditActionTypes: string[] = [];

  const dataSource: ApiTenantDataSource = {
    async findSessionByTokenHash() {
      if (!actor) return undefined;
      return {
        id: "session-forecast",
        tenantId: actor.tenantId,
        userId: actor.id,
        tokenHash: "ignored",
        expiresAt: new Date("2026-07-01T00:00:00.000Z")
      };
    },
    async findUserById(userId) {
      return actor && userId === actor.id ? actor : undefined;
    },
    async findTenantById(tenantId) {
      return tenantId === "tenant-forecast" ? { id: tenantId, name: "Forecast Tenant" } : undefined;
    },
    async findAccessProfileById() {
      return {
        id: "forecast-profile",
        tenantId: "tenant-forecast",
        name: "Forecast profile",
        permissions
      };
    },
    async listDevUsers() {
      return actor ? [actor] : [];
    },
    async listUsersByTenantId() {
      return actor ? [actor] : [];
    },
    async listWorkspaceUsers() {
      return [];
    },
    async listProjects() {
      return [
        {
          id: "project-forecast",
          tenantId: "tenant-forecast",
          sourceType: "manual",
          sourceOpportunityId: null,
          clientId: "client-forecast",
          projectTypeId: "project-type-forecast",
          sourceEntity: null,
          title: "Forecast Project",
          clientName: "Forecast Client",
          status: "active",
          plannedStart: new Date("2026-06-01T00:00:00.000Z"),
          plannedFinish: new Date("2026-06-05T00:00:00.000Z"),
          contractValue: 0,
          plannedHours: 8,
          templateId: null,
          createdAt: new Date("2026-05-24T00:00:00.000Z"),
          activatedAt: new Date("2026-05-24T00:00:00.000Z"),
          closedAt: null,
          demand: []
        }
      ];
    },
    async getPlanSnapshot() {
      return snapshot;
    },
    async withTransaction(operation) {
      return operation(dataSource);
    }
  };
  if (!input.omitAuditPersistence) {
    dataSource.appendAuditEvent = async (auditInput) => {
      auditActionTypes.push(auditInput.actionType);
    };
  }

  if (!input.omitForecastPersistence) {
    dataSource.createPlanningForecastRun = async (runInput) => {
      const run: PlanningForecastRunRecord = {
        ...runInput,
        createdAt: runInput.createdAt ?? new Date("2026-06-21T00:00:00.000Z")
      };
      storedRuns.set(run.id, run);
      return run;
    };
    dataSource.findPlanningForecastRun = async (tenantId, projectId, runId) => {
      const run = storedRuns.get(runId);
      if (!run || run.tenantId !== tenantId || run.projectId !== projectId) return undefined;
      return run;
    };
  }

  return {
    app: createApp({ dataSource }),
    auditActionTypes,
    storedRuns
  };
}

function createSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-forecast",
    projectId: "project-forecast",
    planVersion: 3,
    project: {
      id: "project-forecast",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-05",
      deadline: "2026-06-05",
      calendarId: "calendar-default"
    },
    tasks: [
      {
        id: "task-alpha",
        parentTaskId: null,
        wbsCode: "1",
        title: "Task",
        statusId: "todo",
        schedulingMode: "auto",
        taskType: "fixed_work",
        effortDriven: true,
        plannedStart: "2026-06-01",
        plannedFinish: null,
        plannedStartInstant: null,
        plannedFinishInstant: null,
        durationMinutes: 480,
        workMinutes: 480,
        percentComplete: 0,
        calendarId: "calendar-default",
        constraint: null
      }
    ],
    assignments: [
      {
        id: "assignment-alpha",
        taskId: "task-alpha",
        resourceId: "resource-alpha",
        role: "executor",
        unitsPermille: 1000,
        workMinutes: 480,
        calendarId: null
      }
    ],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
    calendarExceptions: [],
    resources: [
      {
        id: "resource-alpha",
        userId: "resource-alpha",
        positionId: "position-engineer",
        teamId: null,
        name: "Alpha",
        calendarId: "calendar-default"
      }
    ],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-24T00:00:00.000Z"
  };
}
