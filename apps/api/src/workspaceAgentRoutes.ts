import {
  canCreateTasks,
  canManageProjects,
  canReadProjectResources,
  canReadOpportunities,
  canReadProjects,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type {
  OperationsCockpitReadModel,
  TaskRecord,
  TaskStatusCategory,
  TaskStatusRecord
} from "@kiss-pm/persistence";
import { randomUUID } from "node:crypto";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  ProjectRecord,
  WorkspaceAgentActionProposalRecord,
  WorkspaceAgentContextFocus,
  WorkspaceAgentFocusType,
  WorkspaceAgentMessageRecord,
  WorkspaceAgentThreadContext
} from "./apiTypes";
import { isId } from "./crmParsers";
import { readLimitedJsonBody } from "./jsonBody";
import { buildCreateTaskPlanningCommand } from "./planningTaskCompatibility";
import type { ApiApp } from "./routeTypes";

type WorkspaceAgentRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
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

type WorkspaceAgentOperationsContext =
  | {
      status: "available";
      generatedAt: string;
      indicators: OperationsCockpitReadModel["indicators"];
      attentionItems: Array<{
        id: string;
        severity: string;
        title: string;
        entity: OperationsCockpitReadModel["attentionItems"][number]["entity"];
        dueDate: string | null;
      }>;
      unavailableSources: OperationsCockpitReadModel["agentContext"]["unavailableSources"];
    }
  | {
      status: "unavailable";
      reason: "persistence_not_configured" | "permission_missing";
    };

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
    const operationsContext = await readWorkspaceAgentOperationsContext(deps, actor);

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
            buildWorkspaceAgentProposal(actor, message, resolvedContext.context, operationsContext)
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

    const resolvedProposal =
      decision.decision === "apply" && proposal.actionType === "workspace.agent.create_task"
        ? await applyCreateTaskProposal(deps, actor, proposal)
        : await resolveNonMutatingProposal(deps, actor, proposal, decision.decision);
    if (!resolvedProposal.ok) {
      return context.json({ error: resolvedProposal.error }, resolvedProposal.status);
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
      proposal: serializeWorkspaceAgentProposal(resolvedProposal.proposal),
      messages: messages.map(serializeWorkspaceAgentMessage),
      proposals: proposals.map(serializeWorkspaceAgentProposal),
      auditEventId: resolvedProposal.auditEventId
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
  context: WorkspaceAgentThreadContext,
  operationsContext: WorkspaceAgentOperationsContext
): WorkspaceAgentActionProposalRecord {
  const taskProposal = buildCreateTaskProposalPayload(actor, message, context, operationsContext);
  if (taskProposal) {
    return {
      id: `workspace-agent-proposal-${randomUUID()}`,
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      messageId: message.id,
      actionType: "workspace.agent.create_task",
      title: "Создать задачу",
      description: `Генри подготовил задачу: ${taskProposal.title}. ${describeOperationsContext(operationsContext)} Изменение будет применено только после подтверждения.`,
      context,
      payload: { task: taskProposal, agentContext: { operationsCockpit: operationsContext } },
      status: "proposed",
      auditEventId: null,
      createdAt: new Date(),
      resolvedAt: null
    };
  }

  return {
    id: `workspace-agent-proposal-${randomUUID()}`,
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    messageId: message.id,
    actionType: "workspace.agent.review_request",
    title: "Зафиксировать управленческое поручение",
    description: `Генри подготовил безопасное действие: записать поручение без изменения проектов, задач или сделок. ${describeOperationsContext(operationsContext)}`,
    context,
    payload: {
      messageBody: message.body,
      context,
      agentContext: { operationsCockpit: operationsContext }
    },
    status: "proposed",
    auditEventId: null,
    createdAt: new Date(),
    resolvedAt: null
  };
}

function buildCreateTaskProposalPayload(
  actor: TenantUser,
  message: WorkspaceAgentMessageRecord,
  context: WorkspaceAgentThreadContext,
  operationsContext: WorkspaceAgentOperationsContext
): {
  title: string;
  description: string;
  plannedStart: string;
  plannedFinish: string;
  durationWorkingDays: number;
  plannedWork: number;
  priority: "normal";
  requiresAcceptance: false;
  participants: Array<{ userId: string; role: "executor" | "requester" }>;
} | null {
  const title = extractCreateTaskTitle(message.body);
  if (!title) return null;

  const plannedDate = message.createdAt.toISOString().slice(0, 10);
  const focus = context.focus?.title ? ` Контекст: ${context.focus.title}.` : "";
  const operationsSummary =
    operationsContext.status === "available"
      ? ` Операционный контекст: ${operationsContext.indicators.overdueTasks} просроченных задач, ${operationsContext.indicators.criticalTasks} критичных задач.`
      : " Операционный контекст недоступен.";
  return {
    title,
    description: `Создано из сообщения агенту: ${message.body.trim()}.${focus}${operationsSummary}`,
    plannedStart: plannedDate,
    plannedFinish: plannedDate,
    durationWorkingDays: 1,
    plannedWork: 1,
    priority: "normal",
    requiresAcceptance: false,
    participants: [
      { userId: actor.id, role: "executor" },
      { userId: actor.id, role: "requester" }
    ]
  };
}

async function readWorkspaceAgentOperationsContext(
  deps: WorkspaceAgentRouteDeps,
  actor: TenantUser
): Promise<WorkspaceAgentOperationsContext> {
  if (!deps.dataSource.getOperationsCockpitReadModel) {
    return { status: "unavailable", reason: "persistence_not_configured" };
  }

  const profile = await deps.getActorProfile(actor);
  const projectDecision = canReadProjects({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
  if (!projectDecision.allowed) {
    return { status: "unavailable", reason: "permission_missing" };
  }

  const opportunityDecision = canReadOpportunities({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
  const resourceDecision = canReadProjectResources({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
  const cockpit = await deps.dataSource.getOperationsCockpitReadModel({
    tenantId: actor.tenantId,
    now: new Date(),
    includePipelinePressure: opportunityDecision.allowed,
    includeWorkloadHints: resourceDecision.allowed
  });

  return {
    status: "available",
    generatedAt: cockpit.generatedAt,
    indicators: cockpit.indicators,
    attentionItems: cockpit.attentionItems.slice(0, 5).map((item) => ({
      id: item.id,
      severity: item.severity,
      title: item.title,
      entity: item.entity,
      dueDate: item.dueDate
    })),
    unavailableSources: cockpit.agentContext.unavailableSources
  };
}

function describeOperationsContext(context: WorkspaceAgentOperationsContext): string {
  if (context.status === "unavailable") {
    return "Операционный контекст сейчас недоступен.";
  }
  const indicators = context.indicators;
  return `Учтён cockpit: ${indicators.activeProjects} активных проектов, ${indicators.overdueTasks} просроченных задач, ${indicators.criticalTasks} критичных задач, ${indicators.openDeals} открытых сделок.`;
}

function extractCreateTaskTitle(body: string): string | null {
  const trimmed = body.trim();
  const normalized = trimmed.toLocaleLowerCase("ru-RU");
  const isCreateTaskRequest =
    normalized.startsWith("создай задачу") ||
    normalized.startsWith("создать задачу") ||
    normalized.startsWith("добавь задачу");
  if (!isCreateTaskRequest) return null;

  const candidate = (trimmed.split(":").slice(1).join(":").trim() || trimmed)
    .replace(/^(создай|создать|добавь)\s+задачу\s*/i, "")
    .trim();
  const title = candidate.length > 0 ? candidate : "Поручение от Генри";
  if (title.length < 3) return null;
  return title.slice(0, 160);
}

async function resolveNonMutatingProposal(
  deps: WorkspaceAgentRouteDeps,
  actor: TenantUser,
  proposal: WorkspaceAgentActionProposalRecord,
  decision: "apply" | "reject"
): Promise<
  | { ok: true; auditEventId: string; proposal: WorkspaceAgentActionProposalRecord }
  | { ok: false; status: 409 | 501; error: string }
> {
  const resolvedAt = new Date();
  const finalStatus = decision === "apply" ? "applied" : "rejected";
  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    const claimedProposal = await transactionDataSource.updateWorkspaceAgentProposalStatus?.({
      tenantId: actor.tenantId,
      proposalId: proposal.id,
      status: finalStatus,
      auditEventId: null,
      resolvedAt,
      expectedStatus: "proposed"
    });
    if (!claimedProposal) {
      return { ok: false as const, status: 409 as const, error: "agent_proposal_already_resolved" };
    }

    const auditEventId = await deps.appendManagementAuditEvent(
      {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: finalStatus === "applied" ? "workspace.agent_action.applied" : "workspace.agent_action.rejected",
        sourceWorkflow: "workspace_agent_action",
        sourceEntity: { type: "WorkspaceAgentProposal", id: proposal.id },
        commandInput: {
          proposalId: proposal.id,
          decision,
          actionType: proposal.actionType,
          payload: proposal.payload
        },
        beforeState: { status: proposal.status },
        afterState: { status: finalStatus },
        permissionResult: { allowed: true },
        executionResult: {
          status: finalStatus === "applied" ? "succeeded" : "rejected",
          mutationApplied: false
        }
      },
      transactionDataSource
    );

    const updatedProposal = await transactionDataSource.updateWorkspaceAgentProposalStatus?.({
      tenantId: actor.tenantId,
      proposalId: proposal.id,
      status: finalStatus,
      auditEventId,
      resolvedAt,
      expectedStatus: finalStatus
    });
    return updatedProposal
      ? { ok: true as const, auditEventId, proposal: updatedProposal }
      : { ok: false as const, status: 501 as const, error: "persistence_not_configured" };
  });
}

async function applyCreateTaskProposal(
  deps: WorkspaceAgentRouteDeps,
  actor: TenantUser,
  proposal: WorkspaceAgentActionProposalRecord
): Promise<
  | { ok: true; auditEventId: string; proposal: WorkspaceAgentActionProposalRecord }
  | { ok: false; status: 400 | 403 | 409 | 501; error: string }
> {
  if (!hasCreateTaskDataSource(deps.dataSource)) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const taskPayload = parseCreateTaskProposalPayload(proposal.payload);
  if (!taskPayload) return { ok: false, status: 400, error: "invalid_agent_proposal_payload" };

  const profile = await deps.getActorProfile(actor);
  const decision = canCreateTasks({ actor, profile, targetTenantId: actor.tenantId });
  const legacyManageDecision = canManageProjects({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
  if (!decision.allowed && !legacyManageDecision.allowed) {
    return { ok: false, status: 403, error: decision.reason };
  }

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (!hasCreateTaskDataSource(transactionDataSource)) {
      return { ok: false as const, status: 501 as const, error: "persistence_not_configured" };
    }

    await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
    const users = await transactionDataSource.listWorkspaceUsers(actor.tenantId);
    const activeUserIds = new Set(users.filter((user) => user.status !== "inactive").map((user) => user.id));
    if (taskPayload.participants.some((participant) => !activeUserIds.has(participant.userId))) {
      return { ok: false as const, status: 400 as const, error: "invalid_task_participant" };
    }
    const requesterUserId = taskPayload.participants.find((participant) => participant.role === "requester")?.userId;
    const ownerUserId = taskPayload.participants.find((participant) => participant.role === "executor")?.userId;
    if (!requesterUserId || !ownerUserId) {
      return { ok: false as const, status: 400 as const, error: "invalid_agent_proposal_payload" };
    }

    const statuses = await transactionDataSource.listTaskStatuses(actor.tenantId);
    const taskStatus = getRequiredStatusByCategory(statuses, "new");
    if (!taskStatus) return { ok: false as const, status: 400 as const, error: "task_status_not_found" };

    const claimedProposal = await transactionDataSource.updateWorkspaceAgentProposalStatus({
      tenantId: actor.tenantId,
      proposalId: proposal.id,
      status: "applying",
      auditEventId: null,
      resolvedAt: null,
      expectedStatus: "proposed"
    });
    if (!claimedProposal) {
      return { ok: false as const, status: 409 as const, error: "agent_proposal_already_resolved" };
    }

    const taskId = `task-${randomUUID()}`;
    const taskBody = {
      id: taskId,
      title: taskPayload.title,
      description: taskPayload.description,
      priority: taskPayload.priority,
      statusId: taskStatus.id,
      plannedStart: new Date(`${taskPayload.plannedStart}T00:00:00.000Z`),
      plannedFinish: new Date(`${taskPayload.plannedFinish}T00:00:00.000Z`),
      durationWorkingDays: taskPayload.durationWorkingDays,
      plannedWork: taskPayload.plannedWork,
      requiresAcceptance: taskPayload.requiresAcceptance,
      participants: taskPayload.participants
    };
    const inboxProject = await transactionDataSource.ensureWorkspaceInboxProject({
      tenantId: actor.tenantId,
      plannedStart: taskBody.plannedStart,
      plannedFinish: taskBody.plannedFinish
    });
    const planningCommand = buildCreateTaskPlanningCommand({
      taskId,
      projectId: inboxProject.id,
      statusId: taskStatus.id,
      body: taskBody,
      participants: taskBody.participants
    });
    await transactionDataSource.applyPlanningCommand({
      tenantId: actor.tenantId,
      projectId: inboxProject.id,
      actorUserId: actor.id,
      command: planningCommand
    });
    const metadataTask = await transactionDataSource.updateTaskMetadata({
      tenantId: actor.tenantId,
      taskId,
      description: taskBody.description,
      priority: taskBody.priority,
      requesterUserId,
      ownerUserId,
      requiresAcceptance: taskBody.requiresAcceptance,
      participants: taskBody.participants
    });
    if (!metadataTask) throw new Error("task_create_metadata_failed");

    const createdTask = (await transactionDataSource.findTaskById(actor.tenantId, taskId)) ?? metadataTask;
    const planVersion = await transactionDataSource.incrementPlanVersion(actor.tenantId, inboxProject.id);
    await createTaskSystemActivity(transactionDataSource, {
      tenantId: actor.tenantId,
      taskId: createdTask.id,
      actorUserId: actor.id,
      title: "Задача создана агентом",
      body: `Генри создал задачу после подтверждения. Статус: ${taskStatus.name}.`
    });

    const auditEventId = await deps.appendManagementAuditEvent(
      {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "workspace.agent_action.applied",
        sourceWorkflow: "workspace_agent_action",
        sourceEntity: { type: "WorkspaceAgentProposal", id: proposal.id },
        commandInput: {
          proposalId: proposal.id,
          actionType: proposal.actionType,
          payload: proposal.payload
        },
        beforeState: { status: proposal.status },
        afterState: summarizeCreatedTask(createdTask, inboxProject, planVersion),
        permissionResult: {
          allowed: true,
          reason: decision.allowed ? decision.reason : legacyManageDecision.reason,
          permission: decision.allowed ? "tenant.tasks.create" : "tenant.projects.manage"
        },
        executionResult: {
          status: "succeeded",
          mutationApplied: true,
          createdEntity: { type: "Task", id: createdTask.id }
        }
      },
      transactionDataSource
    );

    const updatedProposal = await transactionDataSource.updateWorkspaceAgentProposalStatus({
      tenantId: actor.tenantId,
      proposalId: proposal.id,
      status: "applied",
      auditEventId,
      resolvedAt: new Date(),
      expectedStatus: "applying"
    });
    if (!updatedProposal) throw new Error("agent_proposal_finalize_failed");
    return { ok: true as const, auditEventId, proposal: updatedProposal };
  });
}

function hasCreateTaskDataSource(dataSource: ApiTenantDataSource): dataSource is ApiTenantDataSource & {
  ensureWorkspaceInboxProject(input: { tenantId: string; plannedStart: Date; plannedFinish: Date }): Promise<ProjectRecord>;
  listWorkspaceUsers(tenantId: string): Promise<Array<{ id: string; status: string }>>;
  listTaskStatuses(tenantId: string): Promise<TaskStatusRecord[]>;
  applyPlanningCommand: NonNullable<ApiTenantDataSource["applyPlanningCommand"]>;
  updateTaskMetadata: NonNullable<ApiTenantDataSource["updateTaskMetadata"]>;
  findTaskById(tenantId: string, taskId: string): Promise<TaskRecord | undefined>;
  incrementPlanVersion(tenantId: string, projectId: string): Promise<number>;
  createTaskActivity: NonNullable<ApiTenantDataSource["createTaskActivity"]>;
  updateWorkspaceAgentProposalStatus: NonNullable<ApiTenantDataSource["updateWorkspaceAgentProposalStatus"]>;
} {
  return Boolean(
    dataSource.ensureWorkspaceInboxProject &&
      dataSource.listWorkspaceUsers &&
      dataSource.listTaskStatuses &&
      dataSource.applyPlanningCommand &&
      dataSource.updateTaskMetadata &&
      dataSource.findTaskById &&
      dataSource.incrementPlanVersion &&
      dataSource.createTaskActivity &&
      dataSource.updateWorkspaceAgentProposalStatus
  );
}

function parseCreateTaskProposalPayload(value: Record<string, unknown>): ReturnType<typeof buildCreateTaskProposalPayload> {
  const task = value.task;
  if (!isRecord(task)) return null;
  if (typeof task.title !== "string" || task.title.length < 3) return null;
  if (typeof task.description !== "string") return null;
  if (typeof task.plannedStart !== "string" || typeof task.plannedFinish !== "string") return null;
  if (typeof task.durationWorkingDays !== "number" || typeof task.plannedWork !== "number") return null;
  if (task.priority !== "normal" || task.requiresAcceptance !== false) return null;
  if (!Array.isArray(task.participants)) return null;
  const participants = task.participants.filter(
    (participant): participant is { userId: string; role: "executor" | "requester" } =>
      isRecord(participant) &&
      typeof participant.userId === "string" &&
      (participant.role === "executor" || participant.role === "requester")
  );
  if (participants.length !== task.participants.length) return null;
  return {
    title: task.title,
    description: task.description,
    plannedStart: task.plannedStart,
    plannedFinish: task.plannedFinish,
    durationWorkingDays: task.durationWorkingDays,
    plannedWork: task.plannedWork,
    priority: task.priority,
    requiresAcceptance: task.requiresAcceptance,
    participants
  };
}

function getRequiredStatusByCategory(
  statuses: TaskStatusRecord[],
  category: TaskStatusCategory
): TaskStatusRecord | undefined {
  return statuses.find((status) => status.category === category && status.status === "active");
}

async function createTaskSystemActivity(
  dataSource: ApiTenantDataSource,
  input: {
    tenantId: string;
    taskId: string;
    actorUserId: string;
    title: string;
    body: string;
  }
) {
  if (!dataSource.createTaskActivity) throw new Error("persistence_not_configured");
  await dataSource.createTaskActivity({
    id: `task-activity-${randomUUID()}`,
    tenantId: input.tenantId,
    taskId: input.taskId,
    type: "system",
    body: input.body,
    title: input.title,
    fileUrl: null,
    fileSizeBytes: null,
    mimeType: null,
    authorUserId: input.actorUserId
  });
}

function summarizeCreatedTask(task: TaskRecord, project: ProjectRecord, planVersion: number): Record<string, unknown> {
  return {
    task: {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      statusId: task.statusId,
      ownerUserId: task.ownerUserId
    },
    project: {
      id: project.id,
      title: project.title,
      sourceType: project.sourceType
    },
    planVersion
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
