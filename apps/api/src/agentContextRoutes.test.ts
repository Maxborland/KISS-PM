import { describe, expect, it } from "vitest";

import type { Permission } from "@kiss-pm/access-control";
import type { ControlSignal, PlanSnapshot } from "@kiss-pm/domain";
import type { TaskRecord } from "@kiss-pm/persistence";

import { createApp } from "./app";
import type { ApiTenantDataSource, ProjectRecord } from "./apiTypes";

const sessionCookie =
  "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const basePermissions: Permission[] = [
  "tenant.projects.read",
  "tenant.control_signals.read",
  "tenant.project_plan.read",
  "tenant.corrective_actions.manage"
];

describe("project agent context snapshot API", () => {
  it("returns deterministic read-only project context for a permitted actor", async () => {
    const project = createProject("project-alpha");
    const task = createTask("task-alpha", project.id);
    const openSignal = createSignal("signal-open", project.id, {
      allowedActions: ["create_corrective_action", "open_gantt"],
      severity: "critical"
    });
    const resolvedSignal = createSignal("signal-resolved", project.id, {
      status: "resolved",
      allowedActions: ["create_corrective_action"]
    });
    const fixture = createAgentContextFixture({
      projects: [project],
      tasksByProject: { [project.id]: [task] },
      signalsByProject: { [project.id]: [openSignal, resolvedSignal] },
      snapshotsByProject: { [project.id]: createPlanSnapshot(project.id) }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const firstResponse = await app.request(
      "/api/workspace/projects/project-alpha/agent-context",
      { headers: authHeaders() }
    );
    const secondResponse = await app.request(
      "/api/workspace/projects/project-alpha/agent-context",
      { headers: authHeaders() }
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();
    expect(firstBody).toEqual(secondBody);
    expect(firstBody).toMatchObject({
      snapshot: {
        route: {
          path: "/api/workspace/projects/:projectId/agent-context",
          entityType: "Project",
          entityId: "project-alpha",
          tenantId: "tenant-agent"
        },
        actor: {
          id: "user-agent",
          name: "Agent Reader",
          accessProfile: {
            id: "profile-agent",
            grantedPermissions: [
              "tenant.control_signals.read",
              "tenant.corrective_actions.manage",
              "tenant.project_plan.read",
              "tenant.projects.read"
            ]
          }
        },
        safety: {
          readOnly: true,
          noDirectMutation: true,
          directMutationAllowed: false
        },
        project: {
          id: "project-alpha",
          title: "Project project-alpha",
          status: "active",
          plannedStart: "2026-06-01",
          plannedFinish: "2026-06-30"
        },
        tasks: {
          total: 1,
          items: [
            {
              id: "task-alpha",
              title: "Task task-alpha",
              status: "in_progress",
              priority: "normal",
              plannedStart: "2026-06-01",
              plannedFinish: "2026-06-30",
              progress: 25
            }
          ]
        },
        planning: {
          available: true,
          planVersion: 3,
          taskCount: 1,
          assignmentCount: 0,
          dependencyCount: 0,
          resourceCount: 0,
          baselineCount: 0,
          validationIssueCount: 0
        },
        control: {
          attentionItems: [
            {
              id: "signal-open",
              severity: "critical",
              status: "open",
              sourceMetric: "deadline_delta_days",
              allowedActions: ["create_corrective_action", "open_gantt"]
            }
          ],
          allowedActionIdentifiers: ["create_corrective_action", "open_gantt"]
        }
      }
    });
    expect(fixture.appendAuditCalls).toBe(0);
  });

  it("does not leak project details for unauthenticated or denied reads", async () => {
    const project = createProject("project-secret", { title: "Secret Project" });
    const unauthenticatedFixture = createAgentContextFixture({ projects: [project] });
    const unauthenticatedApp = createApp({ dataSource: unauthenticatedFixture.dataSource });

    const unauthenticatedResponse = await unauthenticatedApp.request(
      "/api/workspace/projects/project-secret/agent-context"
    );

    expect(unauthenticatedResponse.status).toBe(401);
    await expect(unauthenticatedResponse.json()).resolves.toEqual({
      error: "session_required"
    });
    expect(unauthenticatedFixture.projectReads).toBe(0);

    const deniedFixture = createAgentContextFixture({
      permissions: [],
      projects: [project]
    });
    const deniedApp = createApp({ dataSource: deniedFixture.dataSource });

    const deniedResponse = await deniedApp.request(
      "/api/workspace/projects/project-secret/agent-context",
      { headers: authHeaders() }
    );

    expect(deniedResponse.status).toBe(403);
    await expect(deniedResponse.json()).resolves.toEqual({ error: "permission_missing" });
    expect(deniedFixture.projectReads).toBe(0);
  });

  it("keeps the snapshot read-only and free of suggestion or model fields", async () => {
    const project = createProject("project-alpha");
    const fixture = createAgentContextFixture({ projects: [project] });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/workspace/projects/project-alpha/agent-context",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(body.snapshot.safety).toEqual({
      readOnly: true,
      noDirectMutation: true,
      directMutationAllowed: false
    });
    expect(serialized).not.toMatch(
      /confidence|recommendation|recommendations|prompt|model|training|export|generatedText|suggestion/i
    );
    expect(fixture.appendAuditCalls).toBe(0);
  });

  it("documents the endpoint in OpenAPI", async () => {
    const app = createApp();

    const response = await app.request("/api/openapi.json");

    expect(response.status).toBe(200);
    const document = await response.json();
    const operation =
      document.paths["/api/workspace/projects/{projectId}/agent-context"]?.get;
    expect(operation).toMatchObject({
      summary: "Read project agent context snapshot"
    });
    expect(
      operation.responses["200"].content["application/json"].schema
    ).toEqual({ $ref: "#/components/schemas/ProjectAgentContextResponse" });
  });
});

function authHeaders() {
  return { cookie: sessionCookie };
}

type AgentContextFixtureInput = {
  permissions?: Permission[];
  projects?: ProjectRecord[];
  tasksByProject?: Record<string, TaskRecord[]>;
  signalsByProject?: Record<string, ControlSignal[]>;
  snapshotsByProject?: Record<string, PlanSnapshot>;
};

function createAgentContextFixture(input: AgentContextFixtureInput) {
  let projectReads = 0;
  let appendAuditCalls = 0;
  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() {
      return [];
    },
    async findUserById(userId) {
      return userId === "user-agent"
        ? {
            id: "user-agent",
            tenantId: "tenant-agent",
            name: "Agent Reader",
            accessProfileId: "profile-agent"
          }
        : undefined;
    },
    async findTenantById(tenantId) {
      return tenantId === "tenant-agent"
        ? { id: "tenant-agent", name: "Agent Tenant" }
        : undefined;
    },
    async findAccessProfileById() {
      return {
        id: "profile-agent",
        permissions: input.permissions ?? basePermissions
      };
    },
    async listUsersByTenantId() {
      return [];
    },
    async findSessionByTokenHash() {
      return {
        id: "session-agent",
        tenantId: "tenant-agent",
        userId: "user-agent",
        tokenHash: "ignored",
        expiresAt: new Date("2026-07-01T00:00:00.000Z")
      };
    },
    async listProjects(tenantId) {
      projectReads += 1;
      return (input.projects ?? []).filter((project) => project.tenantId === tenantId);
    },
    async listProjectTasks(_tenantId, projectId) {
      return input.tasksByProject?.[projectId] ?? [];
    },
    async getPlanSnapshot(_tenantId, projectId) {
      return input.snapshotsByProject?.[projectId];
    },
    async listControlSignals(_tenantId, projectId) {
      return input.signalsByProject?.[projectId] ?? [];
    },
    async appendAuditEvent() {
      appendAuditCalls += 1;
    }
  };

  return {
    dataSource: dataSource as ApiTenantDataSource,
    get projectReads() {
      return projectReads;
    },
    get appendAuditCalls() {
      return appendAuditCalls;
    }
  };
}

function createProject(id: string, overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id,
    tenantId: "tenant-agent",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: null,
    projectTypeId: null,
    title: `Project ${id}`,
    clientName: "Agent client",
    status: "active",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 1000,
    plannedHours: 80,
    templateId: null,
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    activatedAt: new Date("2026-06-01T00:00:00.000Z"),
    closedAt: null,
    demand: [],
    ...overrides
  };
}

function createTask(id: string, projectId: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    tenantId: "tenant-agent",
    projectId,
    stageId: null,
    title: `Task ${id}`,
    description: null,
    status: "in_progress",
    statusId: "task-status-in-progress",
    statusName: "In progress",
    statusCategory: "in_progress",
    priority: "normal",
    requesterUserId: "user-agent",
    ownerUserId: "user-agent",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    durationWorkingDays: 20,
    plannedWork: 80,
    actualWork: 20,
    progress: 25,
    requiresAcceptance: false,
    source: "manual",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    archivedAt: null,
    participants: [],
    ...overrides
  };
}

function createSignal(id: string, projectId: string, overrides: Partial<ControlSignal> = {}): ControlSignal {
  return {
    id,
    tenantId: "tenant-agent",
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

function createPlanSnapshot(projectId: string): PlanSnapshot {
  return {
    tenantId: "tenant-agent",
    projectId,
    planVersion: 3,
    project: {
      id: projectId,
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-06-01",
      plannedFinish: "2026-06-30",
      deadline: null,
      calendarId: null
    },
    tasks: [
      {
        id: "plan-task-alpha",
        parentTaskId: null,
        wbsCode: "1",
        title: "Plan task",
        statusId: "task-status-in-progress",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-06-01",
        plannedFinish: "2026-06-30",
        durationMinutes: 9600,
        workMinutes: 4800,
        percentComplete: 25,
        calendarId: null,
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
    capturedAt: "2026-06-05T00:00:00.000Z"
  };
}
