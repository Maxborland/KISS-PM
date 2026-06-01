import { canReadOpportunities, canReadProjects, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import { randomUUID } from "node:crypto";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  WorkspaceAgentActionProposalRecord,
  WorkspaceAgentContextFocus,
  WorkspaceAgentFocusType,
  WorkspaceAgentMessageRecord,
  WorkspaceAgentThreadContext
} from "./apiTypes";
import { isId } from "./crmParsers";
import { readLimitedJsonBody } from "./jsonBody";
import type { ApiApp } from "./routeTypes";

type WorkspaceAgentRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

type ContextParseResult =
  | { ok: true; context: WorkspaceAgentThreadContext; rawFocus?: WorkspaceAgentContextFocus }
  | { ok: false; status: 400; error: string };

type MessageBodyParseResult =
  | { ok: true; body: string; context: WorkspaceAgentThreadContext; rawFocus?: WorkspaceAgentContextFocus }
  | { ok: false; status: 400 | 413 | 415; error: string };

const maxAgentMessageLength = 4000;

export function registerWorkspaceAgentRoutes(app: ApiApp, deps: WorkspaceAgentRouteDeps) {
  app.get("/api/workspace/agent-thread", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const parsedContext = parseQueryContext(context.req.query());
    if (!parsedContext.ok) {
      return context.json({ error: parsedContext.error }, parsedContext.status);
    }

    if (!deps.dataSource.listWorkspaceAgentMessages) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const resolvedContext = await resolveThreadContext(deps, actor, parsedContext.rawFocus);
    if (!resolvedContext.ok) {
      return context.json({ error: resolvedContext.error }, resolvedContext.status);
    }

    const messages = await deps.dataSource.listWorkspaceAgentMessages({
      tenantId: actor.tenantId,
      context: resolvedContext.context,
      limit: 100
    });
    const proposals = deps.dataSource.listWorkspaceAgentProposals
      ? await deps.dataSource.listWorkspaceAgentProposals({
          tenantId: actor.tenantId,
          context: resolvedContext.context,
          limit: 20
        })
      : [];

    return context.json({
      context: resolvedContext.context,
      messages: messages.map(serializeWorkspaceAgentMessage),
      proposals: proposals.map(serializeWorkspaceAgentProposal)
    });
  });

  app.post("/api/workspace/agent-thread/messages", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const bodyResult = await readLimitedJsonBody(context);
    if (!bodyResult.ok) return context.json({ error: bodyResult.error }, bodyResult.status);

    const parsedMessage = parseMessageBody(bodyResult.value);
    if (!parsedMessage.ok) {
      return context.json({ error: parsedMessage.error }, parsedMessage.status);
    }

    if (!deps.dataSource.createWorkspaceAgentMessage || !deps.dataSource.listWorkspaceAgentMessages) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const resolvedContext = await resolveThreadContext(deps, actor, parsedMessage.rawFocus);
    if (!resolvedContext.ok) {
      return context.json({ error: resolvedContext.error }, resolvedContext.status);
    }

    const message = await deps.dataSource.createWorkspaceAgentMessage({
      id: `workspace-agent-message-${randomUUID()}`,
      tenantId: actor.tenantId,
      authorUserId: actor.id,
      body: parsedMessage.body,
      context: resolvedContext.context,
      createdAt: new Date()
    });
    const proposal =
      deps.dataSource.createWorkspaceAgentProposal
        ? await deps.dataSource.createWorkspaceAgentProposal(
            buildWorkspaceAgentProposal(actor, message, resolvedContext.context)
          )
        : undefined;

    const messages = await deps.dataSource.listWorkspaceAgentMessages({
      tenantId: actor.tenantId,
      context: resolvedContext.context,
      limit: 100
    });
    const proposals = deps.dataSource.listWorkspaceAgentProposals
      ? await deps.dataSource.listWorkspaceAgentProposals({
          tenantId: actor.tenantId,
          context: resolvedContext.context,
          limit: 20
        })
      : [];

    return context.json(
      {
        context: resolvedContext.context,
        message: serializeWorkspaceAgentMessage(message),
        proposal: proposal ? serializeWorkspaceAgentProposal(proposal) : undefined,
        messages: messages.map(serializeWorkspaceAgentMessage),
        proposals: proposals.map(serializeWorkspaceAgentProposal)
      },
      201
    );
  });

  app.post("/api/workspace/agent-thread/proposals/:proposalId/confirm", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const proposalId = context.req.param("proposalId");
    if (!isId(proposalId)) return context.json({ error: "invalid_agent_proposal_id" }, 400);

    if (
      !deps.dataSource.findWorkspaceAgentProposal ||
      !deps.dataSource.updateWorkspaceAgentProposalStatus ||
      !deps.dataSource.listWorkspaceAgentMessages
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const bodyResult = await readLimitedJsonBody(context);
    if (!bodyResult.ok) return context.json({ error: bodyResult.error }, bodyResult.status);
    const decision = parseProposalDecision(bodyResult.value);
    if (!decision.ok) return context.json({ error: decision.error }, 400);

    const proposal = await deps.dataSource.findWorkspaceAgentProposal(actor.tenantId, proposalId);
    if (!proposal) return context.json({ error: "agent_proposal_not_found" }, 404);
    if (proposal.status !== "proposed") return context.json({ error: "agent_proposal_already_resolved" }, 409);

    const resolvedContext = await resolveThreadContext(deps, actor, proposal.context.focus);
    if (!resolvedContext.ok) {
      return context.json({ error: resolvedContext.error }, resolvedContext.status);
    }

    const actionType =
      decision.decision === "apply"
        ? "workspace.agent_action.applied"
        : "workspace.agent_action.rejected";
    const auditEventId = await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType,
      sourceWorkflow: "workspace_agent_action",
      sourceEntity: { type: "WorkspaceAgentProposal", id: proposal.id },
      commandInput: {
        proposalId: proposal.id,
        decision: decision.decision,
        actionType: proposal.actionType,
        payload: proposal.payload
      },
      beforeState: { status: proposal.status },
      afterState: { status: decision.decision === "apply" ? "applied" : "rejected" },
      permissionResult: { allowed: true },
      executionResult: {
        status: decision.decision === "apply" ? "succeeded" : "rejected",
        mutationApplied: false
      }
    });

    const updatedProposal = await deps.dataSource.updateWorkspaceAgentProposalStatus({
      tenantId: actor.tenantId,
      proposalId: proposal.id,
      status: decision.decision === "apply" ? "applied" : "rejected",
      auditEventId,
      resolvedAt: new Date()
    });

    const messages = await deps.dataSource.listWorkspaceAgentMessages({
      tenantId: actor.tenantId,
      context: resolvedContext.context,
      limit: 100
    });
    const proposals = deps.dataSource.listWorkspaceAgentProposals
      ? await deps.dataSource.listWorkspaceAgentProposals({
          tenantId: actor.tenantId,
          context: resolvedContext.context,
          limit: 20
        })
      : [];

    return context.json({
      context: resolvedContext.context,
      proposal: updatedProposal ? serializeWorkspaceAgentProposal(updatedProposal) : undefined,
      messages: messages.map(serializeWorkspaceAgentMessage),
      proposals: proposals.map(serializeWorkspaceAgentProposal),
      auditEventId
    });
  });
}

function parseQueryContext(query: Record<string, string | undefined>): ContextParseResult {
  return parseFocusCandidate({
    dealId: query.dealId,
    projectId: query.projectId,
    taskId: query.taskId
  });
}

function parseMessageBody(value: unknown): MessageBodyParseResult {
  if (typeof value === "string") {
    const body = value.trim();
    if (body.length === 0 || body.length > maxAgentMessageLength) {
      return { ok: false, status: 400, error: "invalid_agent_message_body" };
    }
    return { ok: true, body, context: {} };
  }

  if (!isRecord(value)) {
    return { ok: false, status: 400, error: "invalid_agent_message_body" };
  }

  const bodyValue = value.body;
  if (typeof bodyValue !== "string") {
    return { ok: false, status: 400, error: "invalid_agent_message_body" };
  }
  const body = bodyValue.trim();
  if (body.length === 0 || body.length > maxAgentMessageLength) {
    return { ok: false, status: 400, error: "invalid_agent_message_body" };
  }

  const parsedContext = parseBodyContext(value.context);
  if (!parsedContext.ok) return parsedContext;

  const result: MessageBodyParseResult = {
    ok: true,
    body,
    context: parsedContext.context
  };
  if (parsedContext.rawFocus) result.rawFocus = parsedContext.rawFocus;
  return result;
}

function parseBodyContext(value: unknown): ContextParseResult {
  if (value === undefined || value === null) return { ok: true, context: {} };
  if (!isRecord(value)) return { ok: false, status: 400, error: "invalid_agent_context" };

  const focus = value.focus;
  if (focus === undefined || focus === null) {
    return parseFocusCandidate({
      dealId: stringField(value.dealId),
      projectId: stringField(value.projectId),
      taskId: stringField(value.taskId)
    });
  }

  if (!isRecord(focus)) return { ok: false, status: 400, error: "invalid_agent_context" };

  const type = focus.type;
  const id = focus.id;
  if (!isFocusType(type) || typeof id !== "string") {
    return { ok: false, status: 400, error: "invalid_agent_context" };
  }

  return parseFocusCandidate({ [`${type}Id`]: id });
}

async function resolveThreadContext(
  deps: WorkspaceAgentRouteDeps,
  actor: TenantUser,
  rawFocus?: WorkspaceAgentContextFocus
): Promise<
  | { ok: true; context: WorkspaceAgentThreadContext }
  | { ok: false; status: 403 | 404 | 501; error: string }
> {
  if (!rawFocus) {
    const profile = await deps.getActorProfile(actor);
    const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendWorkspaceAgentDeniedAudit(deps, actor, {
        commandInput: { context: {} },
        decision,
        entityId: "portfolio",
        entityType: "WorkspaceAgentThread"
      });
      return { ok: false, status: 403, error: decision.reason };
    }
    return { ok: true, context: {} };
  }

  if (rawFocus.type === "project") {
    const profile = await deps.getActorProfile(actor);
    const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendWorkspaceAgentDeniedAudit(deps, actor, {
        commandInput: { context: { focus: rawFocus } },
        decision,
        entityId: rawFocus.id,
        entityType: "Project"
      });
      return { ok: false, status: 403, error: decision.reason };
    }
    if (!deps.dataSource.listProjects) {
      return { ok: false, status: 501, error: "persistence_not_configured" };
    }
    const project = (await deps.dataSource.listProjects(actor.tenantId)).find(
      (candidate) => candidate.id === rawFocus.id
    );
    if (!project) return { ok: false, status: 404, error: "project_not_found" };
    return { ok: true, context: { focus: { type: "project", id: project.id, title: project.title } } };
  }

  if (rawFocus.type === "task") {
    const profile = await deps.getActorProfile(actor);
    const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendWorkspaceAgentDeniedAudit(deps, actor, {
        commandInput: { context: { focus: rawFocus } },
        decision,
        entityId: rawFocus.id,
        entityType: "Task"
      });
      return { ok: false, status: 403, error: decision.reason };
    }
    if (!deps.dataSource.findTaskById) {
      return { ok: false, status: 501, error: "persistence_not_configured" };
    }
    const task = await deps.dataSource.findTaskById(actor.tenantId, rawFocus.id);
    if (!task) return { ok: false, status: 404, error: "task_not_found" };
    return { ok: true, context: { focus: { type: "task", id: task.id, title: task.title } } };
  }

  const profile = await deps.getActorProfile(actor);
  const decision = canReadOpportunities({ actor, profile, targetTenantId: actor.tenantId });
  if (!decision.allowed) {
    await appendWorkspaceAgentDeniedAudit(deps, actor, {
      commandInput: { context: { focus: rawFocus } },
      decision,
      entityId: rawFocus.id,
      entityType: "Opportunity"
    });
    return { ok: false, status: 403, error: decision.reason };
  }
  if (!deps.dataSource.findOpportunityById) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }
  const deal = await deps.dataSource.findOpportunityById(actor.tenantId, rawFocus.id);
  if (!deal) return { ok: false, status: 404, error: "deal_not_found" };
  return { ok: true, context: { focus: { type: "deal", id: deal.id, title: deal.title } } };
}

function parseFocusCandidate(input: {
  projectId?: string | undefined;
  taskId?: string | undefined;
  dealId?: string | undefined;
}): ContextParseResult {
  const candidates = [
    input.projectId === undefined ? undefined : { type: "project" as const, id: input.projectId },
    input.taskId === undefined ? undefined : { type: "task" as const, id: input.taskId },
    input.dealId === undefined ? undefined : { type: "deal" as const, id: input.dealId }
  ].filter((candidate): candidate is { type: WorkspaceAgentFocusType; id: string } =>
    Boolean(candidate)
  );

  if (candidates.length === 0) return { ok: true, context: {} };
  if (candidates.length > 1) return { ok: false, status: 400, error: "multiple_agent_context_ids" };

  const candidate = candidates[0];
  if (!candidate) return { ok: true, context: {} };
  const parsed =
    candidate.type === "project"
      ? parseContextId(candidate.id, "invalid_project_id")
      : candidate.type === "task"
        ? parseContextId(candidate.id, "invalid_task_id")
        : parseContextId(candidate.id, "invalid_opportunity_id");
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const rawFocus: WorkspaceAgentContextFocus = { type: candidate.type, id: parsed.value };
  return { ok: true, context: { focus: rawFocus }, rawFocus };
}

function serializeWorkspaceAgentMessage(message: WorkspaceAgentMessageRecord) {
  return {
    id: message.id,
    authorUserId: message.authorUserId,
    body: message.body,
    context: message.context,
    createdAt: message.createdAt.toISOString()
  };
}

function serializeWorkspaceAgentProposal(proposal: WorkspaceAgentActionProposalRecord) {
  return {
    id: proposal.id,
    messageId: proposal.messageId,
    actionType: proposal.actionType,
    title: proposal.title,
    description: proposal.description,
    context: proposal.context,
    payload: proposal.payload,
    status: proposal.status,
    auditEventId: proposal.auditEventId,
    createdAt: proposal.createdAt.toISOString(),
    resolvedAt: proposal.resolvedAt?.toISOString() ?? null
  };
}

function buildWorkspaceAgentProposal(
  actor: TenantUser,
  message: WorkspaceAgentMessageRecord,
  context: WorkspaceAgentThreadContext
): WorkspaceAgentActionProposalRecord {
  return {
    id: `workspace-agent-proposal-${randomUUID()}`,
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    messageId: message.id,
    actionType: "workspace.agent.review_request",
    title: "Зафиксировать управленческое поручение",
    description: "Генри подготовил безопасное действие: записать поручение без изменения проектов, задач или сделок.",
    context,
    payload: {
      messageBody: message.body,
      context
    },
    status: "proposed",
    auditEventId: null,
    createdAt: new Date(),
    resolvedAt: null
  };
}

function parseProposalDecision(value: unknown): { ok: true; decision: "apply" | "reject" } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "invalid_agent_proposal_decision" };
  return value.decision === "apply" || value.decision === "reject"
    ? { ok: true, decision: value.decision }
    : { ok: false, error: "invalid_agent_proposal_decision" };
}

function parseContextId(value: string, error: string): { ok: true; value: string } | { ok: false; error: string } {
  return isId(value) ? { ok: true, value } : { ok: false, error };
}

async function appendWorkspaceAgentDeniedAudit(
  deps: WorkspaceAgentRouteDeps,
  actor: TenantUser,
  input: {
    commandInput: Record<string, unknown>;
    decision: Record<string, unknown>;
    entityId: string;
    entityType: string;
  }
) {
  try {
    await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "workspace.agent_thread.read_denied",
      sourceWorkflow: "workspace_agent_thread",
      sourceEntity: { type: input.entityType, id: input.entityId },
      commandInput: input.commandInput,
      beforeState: null,
      afterState: null,
      permissionResult: input.decision
    });
  } catch {
    // Denial response must stay stable even when audit persistence is unavailable.
  }
}

function isFocusType(value: unknown): value is WorkspaceAgentFocusType {
  return value === "project" || value === "task" || value === "deal";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
