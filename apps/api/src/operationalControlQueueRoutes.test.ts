import { describe, expect, it } from "vitest";

import type { Permission } from "@kiss-pm/access-control";
import type { ControlSignal, CorrectiveAction } from "@kiss-pm/domain";
import type { TaskRecord } from "@kiss-pm/persistence";

import { createApp } from "./app";
import type { ApiTenantDataSource, AuditEventListItem, ProjectRecord } from "./apiTypes";

const sessionCookie =
  "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const operationalQueuePermissions: Permission[] = [
  "tenant.projects.read",
  "tenant.control_signals.read",
  "tenant.audit_events.read"
];

describe("operational control queue API", () => {
  it("returns an empty operational control queue for a tenant with no active signals", async () => {
    const fixture = createOperationalQueueFixture({ projects: [] });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      asOf: "2026-06-10T00:00:00.000Z",
      limit: 10,
      items: []
    });
  });

  it("fails closed before loading the queue without audit permission", async () => {
    const fixture = createOperationalQueueFixture({
      permissions: ["tenant.projects.read", "tenant.control_signals.read"],
      projects: [createProject("project-alpha")]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(fixture.loadedQueueData).toBe(false);
  });

  it("keeps queue items isolated to the actor tenant", async () => {
    const fixture = createOperationalQueueFixture({
      projects: [
        createProject("project-alpha"),
        createProject("project-beta", { tenantId: "tenant-other" })
      ],
      signalsByProject: {
        "project-alpha": [createSignal("signal-alpha", "project-alpha")],
        "project-beta": [createSignal("signal-beta", "project-beta", { tenantId: "tenant-other" })]
      }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "control-signal:project-alpha:signal-alpha",
      tenantId: "tenant-control",
      project: { id: "project-alpha" },
      source: { entityType: "ControlSignal", entityId: "signal-alpha" }
    });
  });

  it("excludes accepted-risk control signals from the attention queue", async () => {
    const project = createProject("project-alpha");
    const openSignal = createSignal("signal-open", project.id, {
      status: "open",
      severity: "critical"
    });
    const acceptedRiskSignal = createSignal("signal-accepted-risk", project.id, {
      status: "accepted_risk",
      severity: "critical",
      explanation: "Accepted risk should not require operational attention"
    });
    const fixture = createOperationalQueueFixture({
      projects: [project],
      signalsByProject: { [project.id]: [openSignal, acceptedRiskSignal] }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string; status: { value: string } }> };
    expect(body.items.map((item) => item.id)).toEqual([
      "control-signal:project-alpha:signal-open"
    ]);
    expect(body.items).toEqual([
      expect.objectContaining({
        id: "control-signal:project-alpha:signal-open",
        status: { value: "open" }
      })
    ]);
  });

  it("resolves audit events sourced from control signals and corrective actions", async () => {
    const project = createProject("project-alpha");
    const signal = createSignal("signal-review", project.id, {
      status: "resolved",
      explanation: "Resolved signal with denied action"
    });
    const action = createCorrectiveAction("action-review", project.id, signal.id, {
      status: "done"
    });
    const fixture = createOperationalQueueFixture({
      projects: [project],
      signalsByProject: { [project.id]: [signal] },
      correctiveActionsByProject: { [project.id]: [action] },
      auditEvents: [
        createAuditEvent("audit-signal-denied", {
          sourceEntity: { type: "ControlSignal", id: signal.id },
          actionType: "management_action.denied",
          executionResult: { status: "denied" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        }),
        createAuditEvent("audit-action-failed", {
          sourceEntity: { type: "CorrectiveAction", id: action.id },
          actionType: "corrective_action.apply_failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T11:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string; project: { id: string } }> };
    expect(body.items.map((item) => item.id)).toEqual([
      "audit-event:project-alpha:audit-action-failed",
      "audit-event:project-alpha:audit-signal-denied"
    ]);
    expect(body.items).toEqual([
      expect.objectContaining({
        project: { id: project.id, title: project.title, status: project.status, plannedFinish: "2026-06-30" },
        source: expect.objectContaining({ auditEventId: "audit-action-failed" })
      }),
      expect.objectContaining({
        project: { id: project.id, title: project.title, status: project.status, plannedFinish: "2026-06-30" },
        source: expect.objectContaining({ auditEventId: "audit-signal-denied" })
      })
    ]);
  });

  it("includes conflict audit events in the queue", async () => {
    const project = createProject("project-alpha");
    const fixture = createOperationalQueueFixture({
      projects: [project],
      auditEvents: [
        createAuditEvent("audit-conflict-status", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.apply",
          executionResult: { status: "conflict" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        }),
        createAuditEvent("audit-conflict-action", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.conflict",
          executionResult: { status: "succeeded" },
          createdAt: new Date("2026-06-08T11:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string; severity: string }> };
    expect(body.items.map((item) => item.id)).toEqual([
      "audit-event:project-alpha:audit-conflict-action",
      "audit-event:project-alpha:audit-conflict-status"
    ]);
    expect(body.items).toEqual([
      expect.objectContaining({ severity: "warning" }),
      expect.objectContaining({ severity: "warning" })
    ]);
  });

  it("queries actionable audit events before applying the audit source cap", async () => {
    const project = createProject("project-alpha");
    const newerSuccesses = Array.from({ length: 100 }, (_, index) => createAuditEvent(`audit-success-${index}`, {
      sourceEntity: { type: "Project", id: project.id },
      actionType: "management_action.succeeded",
      executionResult: { status: "succeeded" },
      createdAt: new Date(`2026-06-08T12:${String(index).padStart(2, "0")}:00.000Z`)
    }));
    const fixture = createOperationalQueueFixture({
      projects: [project],
      auditEvents: [
        ...newerSuccesses,
        createAuditEvent("audit-older-conflict", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.conflict",
          executionResult: { status: "conflict" },
          createdAt: new Date("2026-06-08T09:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string }> };
    expect(body.items.map((item) => item.id)).toEqual(["audit-event:project-alpha:audit-older-conflict"]);
  });

  it("applies the audit source cap after active project resolution", async () => {
    const project = createProject("project-alpha");
    const closedProject = createProject("project-closed", { status: "closed" });
    const newerClosedProjectFailures = Array.from({ length: 100 }, (_, index) => createAuditEvent(
      `audit-closed-failed-${index}`,
      {
        sourceEntity: { type: "Project", id: closedProject.id },
        actionType: "management_action.failed",
        executionResult: { status: "failed" },
        createdAt: new Date(`2026-06-08T12:${String(index).padStart(2, "0")}:00.000Z`)
      }
    ));
    const fixture = createOperationalQueueFixture({
      projects: [project, closedProject],
      auditEvents: [
        ...newerClosedProjectFailures,
        createAuditEvent("audit-active-older-conflict", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.conflict",
          executionResult: { status: "conflict" },
          createdAt: new Date("2026-06-08T09:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string }> };
    expect(body.items.map((item) => item.id)).toEqual(["audit-event:project-alpha:audit-active-older-conflict"]);
  });

  it("ranks failed audit events before capping actionable audit events by recency", async () => {
    const project = createProject("project-alpha");
    const newerWarnings = Array.from({ length: 100 }, (_, index) => createAuditEvent(`audit-denied-${index}`, {
      sourceEntity: { type: "Project", id: project.id },
      actionType: "management_action.denied",
      executionResult: { status: "denied" },
      createdAt: new Date(Date.parse("2026-06-08T12:00:00.000Z") + index * 1000)
    }));
    const fixture = createOperationalQueueFixture({
      projects: [project],
      auditEvents: [
        ...newerWarnings,
        createAuditEvent("audit-older-failed", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T09:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=1",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string; severity: string }> };
    expect(body.items).toEqual([
      expect.objectContaining({ id: "audit-event:project-alpha:audit-older-failed", severity: "critical" })
    ]);
  });

  it("preserves audit queue item id tie-break before applying the audit source cap", async () => {
    const project = createProject("project-alpha");
    const tiedWarnings = Array.from({ length: 101 }, (_, index) => createAuditEvent(
      `audit-same-${String(index).padStart(3, "0")}`,
      {
        sourceEntity: { type: "Project", id: project.id },
        actionType: "management_action.denied",
        executionResult: { status: "denied" },
        createdAt: new Date("2026-06-08T12:00:00.000Z")
      }
    ));
    const fixture = createOperationalQueueFixture({
      projects: [project],
      auditEvents: tiedWarnings
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=1",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string; severity: string }> };
    expect(body.items).toEqual([
      expect.objectContaining({ id: "audit-event:project-alpha:audit-same-000", severity: "warning" })
    ]);
  });

  it("returns sorted and limited signals from control, corrective, status, overdue, and audit inputs", async () => {
    const project = createProject("project-alpha", {
      plannedFinish: new Date("2026-06-08T00:00:00.000Z")
    });
    const criticalSignal = createSignal("signal-critical", project.id, {
      severity: "critical",
      sourceMetric: "resource_overload_minutes",
      updatedAt: "2026-06-07T12:00:00.000Z"
    });
    const fixture = createOperationalQueueFixture({
      projects: [project],
      tasksByProject: {
        [project.id]: [
          createTask("task-overdue", project.id, {
            priority: "critical",
            plannedFinish: new Date("2026-06-04T00:00:00.000Z"),
            updatedAt: new Date("2026-06-06T00:00:00.000Z")
          }),
          createTask("task-waiting", project.id, {
            status: "waiting",
            statusCategory: "waiting",
            statusName: "Waiting on client",
            priority: "high",
            plannedFinish: new Date("2026-06-12T00:00:00.000Z")
          })
        ]
      },
      signalsByProject: { [project.id]: [criticalSignal] },
      correctiveActionsByProject: {
        [project.id]: [
          createCorrectiveAction("corrective-overdue", project.id, criticalSignal.id, {
            dueDate: "2026-06-03"
          })
        ]
      },
      auditEvents: [
        createAuditEvent("audit-failed", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "planning.apply_failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-09T00:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=3",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { limit: number; items: Array<{ id: string }> };
    expect(body.limit).toBe(3);
    expect(body.items.map((item) => item.id)).toEqual([
      "corrective-action:project-alpha:corrective-overdue",
      "task-overdue:project-alpha:task-overdue",
      "project-overdue:project-alpha"
    ]);
    expect(body.items[0]).toMatchObject({
      signalKind: "corrective_action",
      severity: "critical",
      priority: "critical",
      dueDate: "2026-06-03",
      overdue: true,
      reason: "Corrective action is overdue: corrective-overdue",
      sourceTimestamps: { dueAt: "2026-06-03" }
    });
  });

  it("uses batched project queue reads instead of per-project fan-out", async () => {
    const projects = Array.from({ length: 25 }, (_, index) => createProject(`project-${index}`));
    const firstProject = projects[0]!;
    const fixture = createOperationalQueueFixture({
      projects,
      signalsByProject: {
        [firstProject.id]: [createSignal("signal-critical", firstProject.id, { severity: "critical" })]
      }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=1",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string }> };
    expect(body.items).toEqual([
      expect.objectContaining({ id: "control-signal:project-0:signal-critical" })
    ]);
    expect(fixture.dataReadCalls).toMatchObject({
      projectTaskBatches: 1,
      controlSignalBatches: 1,
      correctiveActionBatches: 1,
      projectTasksByProject: 0,
      controlSignalsByProject: 0,
      correctiveActionsByProject: 0
    });
  });

  it("loads capped active and paused project candidates instead of all tenant projects", async () => {
    const activeProject = createProject("project-active");
    const pausedProject = createProject("project-paused", { status: "paused" });
    const closedProject = createProject("project-closed", { status: "closed" });
    const fixture = createOperationalQueueFixture({
      failFullProjectList: true,
      operationalQueueProjects: [activeProject, pausedProject],
      projects: [activeProject, pausedProject, closedProject],
      signalsByProject: {
        [activeProject.id]: [createSignal("signal-active", activeProject.id, { severity: "critical" })],
        [closedProject.id]: [createSignal("signal-closed", closedProject.id, { severity: "critical" })]
      }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=1",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string }> };
    expect(body.items).toEqual([
      expect.objectContaining({ id: "control-signal:project-active:signal-active" })
    ]);
    expect(fixture.projectCandidateReads).toEqual([
      { tenantId: "tenant-control", limit: undefined, statuses: ["active", "paused"] }
    ]);
    expect(fixture.dataReadCalls).toMatchObject({
      projectTaskBatches: 1,
      controlSignalBatches: 1,
      correctiveActionBatches: 1
    });
  });

  it("ranks overdue project severity before capping project candidates", async () => {
    const newerHealthyProjects = Array.from({ length: 100 }, (_, index) =>
      createProject(`project-newer-${index}`, {
        plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        activatedAt: new Date("2026-06-02T00:00:00.000Z")
      })
    );
    const oldestCriticalProject = createProject("project-oldest-critical", {
      plannedFinish: new Date("2026-05-01T00:00:00.000Z"),
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      activatedAt: new Date("2026-05-01T00:00:00.000Z")
    });
    const projects = [...newerHealthyProjects, oldestCriticalProject];
    const fixture = createOperationalQueueFixture({
      failFullProjectList: true,
      operationalQueueProjects: projects,
      projects
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=1",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string }> };
    expect(body.items).toEqual([
      expect.objectContaining({ id: "project-overdue:project-oldest-critical" })
    ]);
  });

  it("documents the operational control queue route in OpenAPI", async () => {
    const app = createApp();

    const response = await app.request("/api/openapi.json");

    expect(response.status).toBe(200);
    const document = await response.json() as {
      paths: Record<string, Record<string, unknown>>;
    };
    const route = document.paths["/api/tenant/current/operational-control-queue"];

    expect(route).toBeDefined();
    expect(route?.get).toMatchObject({
      summary: "Read operational control queue"
    });
  });
});

function authHeaders() {
  return { cookie: sessionCookie };
}

type OperationalQueueFixtureInput = {
  permissions?: Permission[];
  projects?: ProjectRecord[];
  tasksByProject?: Record<string, TaskRecord[]>;
  signalsByProject?: Record<string, ControlSignal[]>;
  correctiveActionsByProject?: Record<string, CorrectiveAction[]>;
  auditEvents?: AuditEventListItem[];
  operationalQueueProjects?: ProjectRecord[];
  failFullProjectList?: boolean;
};

type OperationalQueueDataReadCalls = {
  projectTasksByProject: number;
  controlSignalsByProject: number;
  correctiveActionsByProject: number;
  projectTaskBatches: number;
  controlSignalBatches: number;
  correctiveActionBatches: number;
};

type OperationalQueueBatchDataSource = Partial<ApiTenantDataSource> & {
  listOperationalQueueProjects(
    tenantId: string,
    options: { statuses: Array<"active" | "paused">; limit?: number }
  ): Promise<ProjectRecord[]>;
  listProjectTasksForProjects(tenantId: string, projectIds: string[]): Promise<TaskRecord[]>;
  listControlSignalsForProjects(tenantId: string, projectIds: string[]): Promise<ControlSignal[]>;
  listCorrectiveActionsForProjects(tenantId: string, projectIds: string[]): Promise<CorrectiveAction[]>;
};

function createOperationalQueueFixture(input: OperationalQueueFixtureInput) {
  let loadedQueueData = false;
  const projectCandidateReads: Array<{
    tenantId: string;
    limit: number | undefined;
    statuses: Array<"active" | "paused">;
  }> = [];
  const dataReadCalls: OperationalQueueDataReadCalls = {
    projectTasksByProject: 0,
    controlSignalsByProject: 0,
    correctiveActionsByProject: 0,
    projectTaskBatches: 0,
    controlSignalBatches: 0,
    correctiveActionBatches: 0
  };
  const dataSource: OperationalQueueBatchDataSource = {
    async listDevUsers() {
      return [];
    },
    async findUserById(userId) {
      return userId === "user-control"
        ? {
            id: "user-control",
            tenantId: "tenant-control",
            name: "Control User",
            accessProfileId: "control-profile"
          }
        : undefined;
    },
    async findAccessProfileById() {
      return {
        id: "control-profile",
        permissions: input.permissions ?? operationalQueuePermissions
      };
    },
    async findSessionByTokenHash() {
      return {
        id: "session-control",
        tenantId: "tenant-control",
        userId: "user-control",
        tokenHash: "ignored",
        expiresAt: new Date("2026-07-01T00:00:00.000Z")
      };
    },
    async listOperationalQueueProjects(tenantId, options) {
      loadedQueueData = true;
      projectCandidateReads.push({ tenantId, limit: options.limit, statuses: [...options.statuses] });
      const candidates = (input.operationalQueueProjects ?? input.projects ?? [])
        .filter((project) => project.tenantId === tenantId)
        .filter((project) => options.statuses.includes(project.status as "active" | "paused"));
      return options.limit === undefined ? candidates : candidates.slice(0, options.limit);
    },
    async listProjects() {
      if (input.failFullProjectList) {
        throw new Error("listProjects should not be called for operational queue candidates");
      }
      loadedQueueData = true;
      return input.projects ?? [];
    },
    async listProjectTasks(_tenantId, projectId) {
      dataReadCalls.projectTasksByProject += 1;
      loadedQueueData = true;
      return input.tasksByProject?.[projectId] ?? [];
    },
    async listControlSignals(_tenantId, projectId) {
      dataReadCalls.controlSignalsByProject += 1;
      loadedQueueData = true;
      return input.signalsByProject?.[projectId] ?? [];
    },
    async listCorrectiveActions(_tenantId, projectId) {
      dataReadCalls.correctiveActionsByProject += 1;
      loadedQueueData = true;
      return input.correctiveActionsByProject?.[projectId] ?? [];
    },
    async listProjectTasksForProjects(_tenantId, projectIds) {
      dataReadCalls.projectTaskBatches += 1;
      loadedQueueData = true;
      return projectIds.flatMap((projectId) => input.tasksByProject?.[projectId] ?? []);
    },
    async listControlSignalsForProjects(_tenantId, projectIds) {
      dataReadCalls.controlSignalBatches += 1;
      loadedQueueData = true;
      return projectIds.flatMap((projectId) => input.signalsByProject?.[projectId] ?? []);
    },
    async listCorrectiveActionsForProjects(_tenantId, projectIds) {
      dataReadCalls.correctiveActionBatches += 1;
      loadedQueueData = true;
      return projectIds.flatMap((projectId) => input.correctiveActionsByProject?.[projectId] ?? []);
    },
    async listAuditEventsByTenantId(_tenantId, options) {
      loadedQueueData = true;
      const filtered = options?.requiresAttention
        ? (input.auditEvents ?? []).filter((event) => {
          if (!auditEventMatchesSourceEntities(event, options.sourceEntities)) return false;
          const status = typeof event.executionResult.status === "string" ? event.executionResult.status : null;
          return status === "failed" ||
            status === "denied" ||
            status === "conflict" ||
            /(?:_|\.)(?:failed|denied|conflict)$/.test(event.actionType);
        })
        : input.auditEvents ?? [];
      const ordered = options?.requiresAttention
        ? [...filtered].sort(compareAttentionAuditEvents)
        : filtered;
      return ordered.slice(0, options?.limit);
    }
  };

  return {
    dataSource: dataSource as ApiTenantDataSource,
    get loadedQueueData() {
      return loadedQueueData;
    },
    get dataReadCalls() {
      return { ...dataReadCalls };
    },
    get projectCandidateReads() {
      return [...projectCandidateReads];
    }
  };
}

function createProject(id: string, overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id,
    tenantId: "tenant-control",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: null,
    projectTypeId: null,
    title: `Project ${id}`,
    clientName: "Control client",
    status: "active",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 0,
    plannedHours: 0,
    templateId: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    activatedAt: new Date("2026-06-01T00:00:00.000Z"),
    closedAt: null,
    demand: [],
    ...overrides
  };
}

function createTask(id: string, projectId: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    tenantId: "tenant-control",
    projectId,
    stageId: null,
    title: `Task ${id}`,
    description: null,
    status: "in_progress",
    statusId: "task-status-in-progress",
    statusName: "In progress",
    statusCategory: "in_progress",
    priority: "normal",
    requesterUserId: "user-control",
    ownerUserId: "user-control",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    durationWorkingDays: 1,
    plannedWork: 1,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: false,
    source: "manual",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    archivedAt: null,
    participants: [],
    ...overrides
  };
}

function createSignal(id: string, projectId: string, overrides: Partial<ControlSignal> = {}): ControlSignal {
  return {
    id,
    tenantId: "tenant-control",
    projectId,
    sourceEntity: { type: "Project", id: projectId },
    sourceMetric: "deadline_delta_days",
    evaluationId: null,
    severity: "warning",
    explanation: `Signal ${id}`,
    ownerUserId: null,
    allowedActions: ["create_corrective_action"],
    scenarioProposals: [],
    status: "open",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
    ...overrides
  };
}

function createCorrectiveAction(
  id: string,
  projectId: string,
  controlSignalId: string,
  overrides: Partial<CorrectiveAction> = {}
): CorrectiveAction {
  return {
    id,
    tenantId: "tenant-control",
    projectId,
    controlSignalId,
    title: id,
    description: null,
    responsibleUserId: null,
    dueDate: null,
    status: "open",
    result: null,
    ...overrides
  };
}

function createAuditEvent(id: string, overrides: Partial<AuditEventListItem> = {}): AuditEventListItem {
  return {
    id,
    tenantId: "tenant-control",
    actorUserId: "user-control",
    actionType: "control.action_denied",
    sourceSurfaceId: null,
    sourceWorkflow: "control",
    sourceEntity: { type: "Project", id: "project-alpha" },
    input: {},
    beforeState: null,
    afterState: null,
    permissionResult: { allowed: false, reason: "permission_missing" },
    executionResult: { status: "denied" },
    correlationId: `correlation-${id}`,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides
  };
}


  it("filters allowedActions by actor permissions", async () => {
    const project = createProject("project-alpha", {
      plannedFinish: new Date("2026-06-08T00:00:00.000Z")
    });
    const signal = createSignal("signal-actions", project.id, {
      allowedActions: ["accept_risk", "apply_planning_delta", "move_deadline"]
    });
    const fixture = createOperationalQueueFixture({
      permissions: [
        "tenant.projects.read",
        "tenant.control_signals.read",
        "tenant.audit_events.read"
      ],
      projects: [project],
      signalsByProject: { [project.id]: [signal] }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string; allowedActions: string[] }> };
    for (const item of body.items) {
      expect(item.allowedActions).not.toContain("open_gantt");
      expect(item.allowedActions).not.toContain("generate_planning_solution");
      expect(item.allowedActions).not.toContain("create_corrective_action");
      expect(item.allowedActions).not.toContain("accept_risk");
      expect(item.allowedActions).not.toContain("apply_planning_delta");
      expect(item.allowedActions).not.toContain("move_deadline");
    }
  });

  it("includes allowedActions when actor has the required permissions", async () => {
    const project = createProject("project-alpha", {
      plannedFinish: new Date("2026-06-08T00:00:00.000Z")
    });
    const signal = createSignal("signal-actions", project.id, {
      allowedActions: ["accept_risk", "apply_planning_delta", "move_deadline"]
    });
    const fixture = createOperationalQueueFixture({
      permissions: [
        "tenant.projects.read",
        "tenant.control_signals.read",
        "tenant.audit_events.read",
        "tenant.project_plan.read",
        "tenant.project_plan.manage",
        "tenant.planning_scenarios.preview",
        "tenant.corrective_actions.manage",
        "tenant.management_actions.execute",
        "tenant.control_signals.manage"
      ],
      projects: [project],
      signalsByProject: { [project.id]: [signal] }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/operational-control-queue?asOf=2026-06-10T00:00:00.000Z&limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string; allowedActions: string[] }> };
    const overdueProject = body.items.find((item) => item.id === "project-overdue:project-alpha");
    expect(overdueProject).toBeDefined();
    expect(overdueProject!.allowedActions).toContain("open_gantt");
    expect(overdueProject!.allowedActions).toContain("generate_planning_solution");

    const actionsSignal = body.items.find((item) => item.id === "control-signal:project-alpha:signal-actions");
    expect(actionsSignal).toBeDefined();
    expect(actionsSignal!.allowedActions).toEqual([
      "accept_risk",
      "apply_planning_delta",
      "move_deadline"
    ]);
  });
function compareAttentionAuditEvents(left: AuditEventListItem, right: AuditEventListItem) {
  return auditEventSeverityRank(left) - auditEventSeverityRank(right) ||
    right.createdAt.getTime() - left.createdAt.getTime() ||
    left.id.localeCompare(right.id);
}

function auditEventSeverityRank(event: AuditEventListItem) {
  const status = typeof event.executionResult.status === "string" ? event.executionResult.status : null;
  return status === "failed" || /(?:_|\.)failed$/.test(event.actionType) ? 0 : 1;
}
function auditEventMatchesSourceEntities(
  event: { sourceEntity: Record<string, unknown> },
  sourceEntities: Array<{ type: string; ids: string[] }> | undefined
) {
  if (!sourceEntities?.length) return true;
  const type = typeof event.sourceEntity.type === "string" ? event.sourceEntity.type : undefined;
  const id = typeof event.sourceEntity.id === "string" ? event.sourceEntity.id : undefined;
  if (!type || !id) return false;
  return sourceEntities.some((sourceEntity) =>
    sourceEntity.type === type && sourceEntity.ids.includes(id)
  );
}
