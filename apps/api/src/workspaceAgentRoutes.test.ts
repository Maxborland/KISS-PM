import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { TaskRecord } from "@kiss-pm/persistence";
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
    appendManagementAuditEvent: async (event) => {
      fixture.audits.push(event);
      return `audit-agent-action-${fixture.audits.length}`;
    }
  });
  return app;
}

function createFixture(input: { profile?: AccessProfile } = {}) {
  const messages: WorkspaceAgentMessageRecord[] = [];
  const proposals: WorkspaceAgentActionProposalRecord[] = [];
  const audits: ManagementAuditEventInput[] = [];
  const projectRecord = project("project-alpha", "Проект Альфа");
  const taskRecord = task("task-alpha", "Задача Альфа", projectRecord.id);
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
    async findTaskById() {
      return taskRecord;
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

  return { audits, dataSource, messages, profile: input.profile ?? readerProfile };
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
