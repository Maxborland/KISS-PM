import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { TaskActivityRecord, TaskRecord, TaskStatusRecord } from "@kiss-pm/persistence";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  OpportunityRecord,
  ProjectRecord,
  WorkspaceAgentActionProposalRecord,
  WorkspaceAgentMessageRecord,
  WorkspaceAgentThreadContext
} from "./apiTypes";
import { createApp } from "./app";
import { registerWorkspaceAgentRoutes } from "./workspaceAgentRoutes";

const actor = {
  id: "user-alpha",
  tenantId: "tenant-alpha",
  accessProfileId: "profile-alpha"
} as TenantUser;

const readerProfile = {
  id: "profile-alpha",
  permissions: ["tenant.projects.read", "tenant.opportunities.read"]
} as AccessProfile;

const taskCreatorProfile = {
  id: "profile-alpha",
  permissions: ["tenant.projects.read", "tenant.opportunities.read", "tenant.tasks.create"]
} as AccessProfile;

describe("workspace agent routes", () => {
  it("returns portfolio thread without context focus", async () => {
    const fixture = createFixture();
    fixture.messages.push(message("message-portfolio", {}, "Портфельный обзор"));
    const app = createRouteApp(fixture);

    const response = await app.request("/api/workspace/agent-thread", requestOptions());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      context: {},
      messages: [{ id: "message-portfolio", body: "Портфельный обзор", context: {} }]
    });
  });

  it.each([
    ["/api/workspace/agent-thread?projectId=project-alpha", { type: "project", id: "project-alpha", title: "Проект Альфа" }],
    ["/api/workspace/agent-thread?taskId=task-alpha", { type: "task", id: "task-alpha", title: "Задача Альфа" }],
    ["/api/workspace/agent-thread?dealId=deal-alpha", { type: "deal", id: "deal-alpha", title: "Сделка Альфа" }]
  ])("returns contextual thread focus for %s", async (path, focus) => {
    const app = createRouteApp(createFixture());

    const response = await app.request(path, requestOptions());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ context: { focus }, messages: [] });
  });

  it("persists posted message in the same contextual thread", async () => {
    const fixture = createFixture();
    const app = createRouteApp(fixture);

    const post = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify({
        body: "Что горит по проекту?",
        context: { projectId: "project-alpha" }
      })
    });

    expect(post.status).toBe(201);
    await expect(post.json()).resolves.toMatchObject({
      context: { focus: { type: "project", id: "project-alpha", title: "Проект Альфа" } },
      message: { body: "Что горит по проекту?" },
      messages: [{ body: "Что горит по проекту?" }],
      proposals: [
        {
          actionType: "workspace.agent.review_request",
          status: "proposed",
          title: "Зафиксировать управленческое поручение"
        }
      ]
    });

    const get = await app.request("/api/workspace/agent-thread?projectId=project-alpha", requestOptions());
    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toMatchObject({
      messages: [{ body: "Что горит по проекту?" }]
    });
  });

  it("applies an agent proposal only through explicit confirmation and writes audit", async () => {
    const fixture = createFixture();
    const app = createRouteApp(fixture);
    const post = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify("Зафиксируй риск по срокам")
    });
    const body = (await post.json()) as { proposal: { id: string } };

    const confirmed = await app.request(`/api/workspace/agent-thread/proposals/${body.proposal.id}/confirm`, {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify({ decision: "apply" })
    });

    expect(confirmed.status).toBe(200);
    await expect(confirmed.json()).resolves.toMatchObject({
      proposal: {
        id: body.proposal.id,
        status: "applied",
        auditEventId: "audit-agent-action-1"
      },
      auditEventId: "audit-agent-action-1"
    });
    expect(fixture.audits).toEqual([
      expect.objectContaining({
        actionType: "workspace.agent_action.applied",
        commandInput: expect.objectContaining({
          proposalId: body.proposal.id,
          decision: "apply"
        }),
        executionResult: expect.objectContaining({
          mutationApplied: false,
          status: "succeeded"
        })
      })
    ]);
  });

  it("does not let a late reject overwrite an already claimed proposal", async () => {
    const fixture = createFixture({ forceNonMutatingResolutionConflict: true });
    const app = createRouteApp(fixture);
    const post = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify("Отклони, если уже не применено")
    });
    const body = (await post.json()) as { proposal: { id: string } };

    const rejected = await app.request(`/api/workspace/agent-thread/proposals/${body.proposal.id}/confirm`, {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify({ decision: "reject" })
    });

    expect(rejected.status).toBe(409);
    await expect(rejected.json()).resolves.toEqual({ error: "agent_proposal_already_resolved" });
    expect(fixture.audits).toEqual([]);
    expect(fixture.proposalStatusUpdates).toEqual([{ expectedStatus: "proposed", status: "rejected" }]);
  });


  it("creates a real task only after confirming a create-task agent proposal", async () => {
    const fixture = createFixture({ profile: taskCreatorProfile });
    const app = createRouteApp(fixture);

    const post = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify("Создай задачу: Проверить исходные данные по БЦ Север")
    });
    expect(post.status).toBe(201);
    const body = (await post.json()) as { proposal: { id: string } };
    await expect(Promise.resolve(body)).resolves.toMatchObject({
      proposal: {
        actionType: "workspace.agent.create_task",
        status: "proposed",
        payload: {
          task: {
            title: "Проверить исходные данные по БЦ Север",
            participants: [
              { userId: actor.id, role: "executor" },
              { userId: actor.id, role: "requester" }
            ]
          }
        }
      }
    });
    expect(fixture.tasks).toHaveLength(1);

    const confirmed = await app.request(`/api/workspace/agent-thread/proposals/${body.proposal.id}/confirm`, {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify({ decision: "apply" })
    });

    expect(confirmed.status).toBe(200);
    await expect(confirmed.json()).resolves.toMatchObject({
      proposal: {
        id: body.proposal.id,
        status: "applied",
        auditEventId: "audit-agent-action-1"
      },
      auditEventId: "audit-agent-action-1"
    });
    expect(fixture.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Проверить исходные данные по БЦ Север",
          projectId: "project-workspace-inbox",
          requesterUserId: actor.id,
          ownerUserId: actor.id,
          participants: [
            { userId: actor.id, role: "executor" },
            { userId: actor.id, role: "requester" }
          ]
        })
      ])
    );
    expect(fixture.taskActivities).toEqual([
      expect.objectContaining({
        taskId: expect.stringMatching(/^task-/),
        type: "system",
        title: "Задача создана агентом"
      })
    ]);
    expect(fixture.audits).toEqual([
      expect.objectContaining({
        actionType: "workspace.agent_action.applied",
        afterState: expect.objectContaining({
          task: expect.objectContaining({
            title: "Проверить исходные данные по БЦ Север",
            projectId: "project-workspace-inbox"
          }),
          planVersion: 2
        }),
        executionResult: expect.objectContaining({
          mutationApplied: true,
          status: "succeeded",
          createdEntity: expect.objectContaining({ type: "Task" })
        })
      })
    ]);
  });

  it("does not create a duplicate task when proposal claim loses the race", async () => {
    const fixture = createFixture({ profile: taskCreatorProfile, forceProposalClaimConflict: true });
    const app = createRouteApp(fixture);

    const post = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify("Создай задачу: Проверить коллизии подтверждения")
    });
    const body = (await post.json()) as { proposal: { id: string } };

    const confirmed = await app.request(`/api/workspace/agent-thread/proposals/${body.proposal.id}/confirm`, {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify({ decision: "apply" })
    });

    expect(confirmed.status).toBe(409);
    await expect(confirmed.json()).resolves.toEqual({ error: "agent_proposal_already_resolved" });
    expect(fixture.tasks).toHaveLength(1);
    expect(fixture.taskActivities).toEqual([]);
    expect(fixture.audits).toEqual([]);
  });

  it("does not create a task proposal for titles rejected by the task parser", async () => {
    const fixture = createFixture({ profile: taskCreatorProfile });
    const app = createRouteApp(fixture);

    const post = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify("Создай задачу: QA")
    });

    expect(post.status).toBe(201);
    await expect(post.json()).resolves.toMatchObject({
      proposal: {
        actionType: "workspace.agent.review_request",
        status: "proposed"
      }
    });
  });

  it("marks a task proposal as applying before mutating planning data", async () => {
    const fixture = createFixture({ profile: taskCreatorProfile });
    const app = createRouteApp(fixture);

    const post = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify("Создай задачу: Проверить порядок применения")
    });
    const body = (await post.json()) as { proposal: { id: string } };

    const confirmed = await app.request(`/api/workspace/agent-thread/proposals/${body.proposal.id}/confirm`, {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify({ decision: "apply" })
    });

    expect(confirmed.status).toBe(200);
    expect(fixture.proposalStatusUpdates.map((update) => update.status)).toEqual(["applying", "applied"]);
    expect(fixture.planningCommandCountAtProposalClaim).toBe(0);
  });

  it("denies applying a create-task proposal without task create permission", async () => {
    const fixture = createFixture();
    const app = createRouteApp(fixture);

    const post = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify("Создай задачу: Проверить доступы")
    });
    const body = (await post.json()) as { proposal: { id: string } };

    const confirmed = await app.request(`/api/workspace/agent-thread/proposals/${body.proposal.id}/confirm`, {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify({ decision: "apply" })
    });

    expect(confirmed.status).toBe(403);
    await expect(confirmed.json()).resolves.toEqual({ error: "permission_missing" });
    expect(fixture.tasks).toHaveLength(1);
    expect(fixture.taskActivities).toEqual([]);
    expect(fixture.audits).toEqual([]);
  });

  it("rejects repeat confirmation for already resolved proposal", async () => {
    const fixture = createFixture();
    const app = createRouteApp(fixture);
    const post = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify("Отклони потом")
    });
    const body = (await post.json()) as { proposal: { id: string } };

    const first = await app.request(`/api/workspace/agent-thread/proposals/${body.proposal.id}/confirm`, {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify({ decision: "reject" })
    });
    expect(first.status).toBe(200);

    const repeated = await app.request(`/api/workspace/agent-thread/proposals/${body.proposal.id}/confirm`, {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify({ decision: "apply" })
    });

    expect(repeated.status).toBe(409);
    await expect(repeated.json()).resolves.toEqual({ error: "agent_proposal_already_resolved" });
  });

  it("accepts legacy string message body", async () => {
    const app = createRouteApp(createFixture());

    const response = await app.request("/api/workspace/agent-thread/messages", {
      ...requestOptions(),
      method: "POST",
      headers: { ...requestOptions().headers, "content-type": "application/json" },
      body: JSON.stringify("Покажи внимание на сегодня")
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      context: {},
      message: { body: "Покажи внимание на сегодня", context: {} }
    });
  });

  it("rejects invalid and multiple context ids", async () => {
    const app = createRouteApp(createFixture());

    const invalid = await app.request("/api/workspace/agent-thread?projectId=bad/id", requestOptions());
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid_project_id" });

    const multiple = await app.request(
      "/api/workspace/agent-thread?projectId=project-alpha&taskId=task-alpha",
      requestOptions()
    );
    expect(multiple.status).toBe(400);
    await expect(multiple.json()).resolves.toEqual({ error: "multiple_agent_context_ids" });
  });

  it("checks session before parsing context or message body", async () => {
    const app = createRouteApp(createFixture(), { actor: null });

    const invalidContext = await app.request("/api/workspace/agent-thread?projectId=bad/id");
    expect(invalidContext.status).toBe(401);
    await expect(invalidContext.json()).resolves.toEqual({ error: "session_required" });

    const invalidBody = await app.request("/api/workspace/agent-thread/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body: "bad context",
        context: { projectId: "project-alpha", dealId: "deal-alpha" }
      })
    });
    expect(invalidBody.status).toBe(401);
    await expect(invalidBody.json()).resolves.toEqual({ error: "session_required" });
  });

  it("keeps workspace agent routes session protected in the full app", async () => {
    const app = createApp();

    const response = await app.request("/api/workspace/agent-thread");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "session_required" });
  });

  it("keeps workspace agent routes protected by existing RBAC", async () => {
    const fixture = createFixture({ profile: { id: "profile-alpha", permissions: [] } as AccessProfile });
    const app = createRouteApp(fixture);

    const response = await app.request("/api/workspace/agent-thread", requestOptions());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
  });
});

function createRouteApp(
  fixture: ReturnType<typeof createFixture>,
  options: { actor?: TenantUser | null } = {}
) {
  const app = new Hono();
  registerWorkspaceAgentRoutes(app, {
    dataSource: fixture.dataSource,
    getActorProfile: async () => fixture.profile,
    getSessionActorFromHeaders: async () => (options.actor === null ? undefined : options.actor ?? actor),
    runDataSourceTransaction: async (operation) => operation(fixture.dataSource),
    appendManagementAuditEvent: async (event) => {
      fixture.audits.push(event);
      return `audit-agent-action-${fixture.audits.length}`;
    }
  });
  return app;
}

function createFixture(
  options: {
    profile?: AccessProfile;
    forceNonMutatingResolutionConflict?: boolean;
    forceProposalClaimConflict?: boolean;
  } = {}
) {
  const messages: WorkspaceAgentMessageRecord[] = [];
  const proposals: WorkspaceAgentActionProposalRecord[] = [];
  const audits: ManagementAuditEventInput[] = [];
  const proposalStatusUpdates: Array<{ expectedStatus: string | undefined; status: string }> = [];
  let planningCommandCount = 0;
  let planningCommandCountAtProposalClaim: number | undefined;
  const projectRecord = project("project-alpha", "Проект Альфа");
  const taskRecord = task("task-alpha", "Задача Альфа", projectRecord.id);
  const tasks: TaskRecord[] = [taskRecord];
  const taskActivities: TaskActivityRecord[] = [];
  const taskStatusRecord = taskStatus("task-status-new", "Новая");
  const inboxProject = {
    ...project("project-workspace-inbox", "Входящие задачи"),
    sourceType: "workspace_inbox" as const
  };
  const dealRecord = deal("deal-alpha", "Сделка Альфа");

  const dataSource = {
    async listDevUsers() {
      return [actor];
    },
    async findUserById() {
      return actor;
    },
    async findTenantById() {
      return { id: "tenant-alpha", name: "Tenant Alpha" };
    },
    async listUsersByTenantId() {
      return [actor];
    },
    async listProjects() {
      return [projectRecord];
    },
    async ensureWorkspaceInboxProject() {
      return inboxProject;
    },
    async findTaskById(tenantId, taskId) {
      return tasks.find((candidate) => candidate.tenantId === tenantId && candidate.id === taskId);
    },
    async listWorkspaceUsers() {
      return [
        {
          ...actor,
          email: "user-alpha@example.test",
          positionId: null,
          positionName: null,
          phone: null,
          telegram: null,
          status: "active",
          theme: "light",
          accentColor: "teal"
        }
      ];
    },
    async listTaskStatuses() {
      return [taskStatusRecord];
    },
    async applyPlanningCommand(input) {
      if (input.command.type !== "task.create") return;
      planningCommandCount += 1;
      const payload = input.command.payload;
      const now = new Date("2026-06-01T00:00:00.000Z");
      const durationMinutes = typeof payload.durationMinutes === "number" ? payload.durationMinutes : 480;
      const workMinutes = typeof payload.workMinutes === "number" ? payload.workMinutes : 60;
      tasks.push({
        id: payload.id,
        tenantId: input.tenantId,
        projectId: input.projectId,
        stageId: null,
        title: payload.title,
        description: null,
        status: taskStatusRecord.category,
        statusId: payload.statusId,
        statusName: taskStatusRecord.name,
        statusCategory: taskStatusRecord.category,
        priority: "normal",
        requesterUserId: actor.id,
        ownerUserId: actor.id,
        plannedStart: new Date(`${payload.plannedStart}T00:00:00.000Z`),
        plannedFinish: new Date(`${payload.plannedFinish}T00:00:00.000Z`),
        durationWorkingDays: durationMinutes / 480,
        plannedWork: workMinutes / 60,
        actualWork: 0,
        progress: 0,
        requiresAcceptance: false,
        source: "manual",
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        participants: []
      });
    },
    async updateTaskMetadata(input) {
      const index = tasks.findIndex(
        (candidate) => candidate.tenantId === input.tenantId && candidate.id === input.taskId
      );
      if (index < 0) return undefined;
      const current = tasks[index];
      if (!current) return undefined;
      const updated = {
        ...current,
        description: input.description,
        priority: input.priority,
        requesterUserId: input.requesterUserId,
        ownerUserId: input.ownerUserId,
        requiresAcceptance: input.requiresAcceptance,
        participants: input.participants,
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      };
      tasks[index] = updated;
      return updated;
    },
    async incrementPlanVersion() {
      return 2;
    },
    async createTaskActivity(input) {
      const record = {
        ...input,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      };
      taskActivities.push(record);
      return record;
    },
    async lockTenantResourcePlanning() {
      return;
    },
    async findOpportunityById() {
      return dealRecord;
    },
    async listWorkspaceAgentMessages(input) {
      return messages.filter(
        (candidate) =>
          candidate.tenantId === input.tenantId &&
          contextKey(candidate.context) === contextKey(input.context)
      );
    },
    async createWorkspaceAgentMessage(input) {
      messages.push(input);
      return input;
    },
    async listWorkspaceAgentProposals(input) {
      return proposals.filter(
        (candidate) =>
          candidate.tenantId === input.tenantId &&
          contextKey(candidate.context) === contextKey(input.context)
      );
    },
    async createWorkspaceAgentProposal(input) {
      proposals.push(input);
      return input;
    },
    async findWorkspaceAgentProposal(tenantId, proposalId) {
      return proposals.find((proposal) => proposal.tenantId === tenantId && proposal.id === proposalId);
    },
    async updateWorkspaceAgentProposalStatus(input) {
      const index = proposals.findIndex(
        (proposal) => proposal.tenantId === input.tenantId && proposal.id === input.proposalId
      );
      if (index < 0) return undefined;
      const current = proposals[index];
      if (!current) return undefined;
      if (input.expectedStatus && current.status !== input.expectedStatus) return undefined;
      if (input.expectedStatus === "proposed" && input.status === "applying" && input.auditEventId === null) {
        planningCommandCountAtProposalClaim = planningCommandCount;
        proposalStatusUpdates.push({ expectedStatus: input.expectedStatus, status: input.status });
        if (options.forceProposalClaimConflict) return undefined;
      } else if (
        input.expectedStatus === "proposed" &&
        (input.status === "applied" || input.status === "rejected") &&
        options.forceNonMutatingResolutionConflict
      ) {
        proposalStatusUpdates.push({ expectedStatus: input.expectedStatus, status: input.status });
        return undefined;
      } else {
        proposalStatusUpdates.push({ expectedStatus: input.expectedStatus, status: input.status });
      }
      const updated = {
        ...current,
        status: input.status,
        auditEventId: input.auditEventId,
        resolvedAt: input.resolvedAt
      };
      proposals[index] = updated;
      return updated;
    }
  } satisfies ApiTenantDataSource;

  return {
    audits,
    dataSource,
    messages,
    get planningCommandCountAtProposalClaim() {
      return planningCommandCountAtProposalClaim;
    },
    profile: options.profile ?? readerProfile,
    proposalStatusUpdates,
    taskActivities,
    tasks
  };
}

function requestOptions() {
  return {
    headers: { cookie: "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
  };
}

function contextKey(context: WorkspaceAgentThreadContext): string {
  if (!context.focus) return "portfolio";
  return `${context.focus.type}:${context.focus.id}`;
}

function message(id: string, context: WorkspaceAgentThreadContext, body: string): WorkspaceAgentMessageRecord {
  return {
    id,
    tenantId: "tenant-alpha",
    authorUserId: actor.id,
    body,
    context,
    createdAt: new Date("2026-06-01T00:00:00.000Z")
  };
}

function project(id: string, title: string): ProjectRecord {
  return {
    id,
    tenantId: "tenant-alpha",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: null,
    projectTypeId: null,
    title,
    clientName: "Клиент",
    status: "active",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 1000000,
    plannedHours: 100,
    templateId: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    activatedAt: new Date("2026-05-02T00:00:00.000Z"),
    demand: []
  };
}

function task(id: string, title: string, projectId: string): TaskRecord {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    id,
    tenantId: "tenant-alpha",
    projectId,
    stageId: null,
    title,
    description: null,
    status: "new",
    statusId: "task-status-new",
    statusName: "Новая",
    statusCategory: "new",
    priority: "normal",
    requesterUserId: actor.id,
    ownerUserId: actor.id,
    plannedStart: now,
    plannedFinish: now,
    durationWorkingDays: 1,
    plannedWork: 60,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: false,
    source: "manual",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    participants: []
  };
}

function taskStatus(id: string, name: string): TaskStatusRecord {
  return {
    id,
    tenantId: "tenant-alpha",
    name,
    category: "new",
    sortOrder: 10,
    status: "active",
    isSystem: true,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z")
  };
}

function deal(id: string, title: string): OpportunityRecord {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    id,
    tenantId: "tenant-alpha",
    clientId: null,
    primaryContactId: null,
    ownerUserId: actor.id,
    projectTypeId: null,
    stageId: null,
    clientName: "Клиент",
    contactName: "Контакт",
    title,
    projectType: "Внедрение",
    description: null,
    plannedStart: now,
    plannedFinish: now,
    contractValue: 100000,
    plannedHourlyRate: 5000,
    plannedHours: 20,
    probability: 50,
    status: "open",
    templateId: null,
    feasibilityStatus: null,
    feasibilityResult: null,
    feasibilityCheckedAt: null,
    createdAt: now,
    updatedAt: now,
    demand: [],
    customFieldValues: {}
  };
}
