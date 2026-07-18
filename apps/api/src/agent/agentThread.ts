/**
 * Персистентный тред агента поверх существующей collaboration-модели (P1).
 *
 * Контракт: у пользователя один приватный тред (conversation entityType="agent",
 * entityId=userId, conversationType="agent"), доступ — по членству (см.
 * resolveConversationForActor), клиентская запись запрещена (agent_conversation_readonly) —
 * единственный писатель agent-семантики этот модуль, вызываемый из propose/execute.
 * Реплики агента пишутся от имени владельца треда (authorUserId = пользователь),
 * роль хода — в metadata.agent.role; отдельной agent-подсистемы хранения нет намеренно.
 */

import { randomUUID } from "node:crypto";

import type { Conversation, TenantUser } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "../apiTypes";

// Капы персистентного снимка: тред — история решений, не полный дамп payload'ов.
const SNAPSHOT_TEXT_CAP = 500;
const BODY_CAP = 4000;
const SNAPSHOT_ACTIONS_CAP = 20;

const capText = (value: string, cap = SNAPSHOT_TEXT_CAP): string =>
  value.length > cap ? `${value.slice(0, cap)}…` : value;

/** Детерминированный id треда: create-or-get идемпотентен по (tenantId, id). */
export const agentThreadId = (userId: string): string => `agent-thread-${userId}`;

export function agentThreadConfigured(dataSource: ApiTenantDataSource): boolean {
  // В рантайме приложение создаётся с Partial<ApiTenantDataSource> — методы
  // collaboration-персистентности могут отсутствовать (partial data-source режим).
  const optional = dataSource as Partial<ApiTenantDataSource>;
  return Boolean(
    optional.ensureConversation &&
    optional.addConversationMembers &&
    optional.createDiscussionMessage
  );
}

export async function ensureAgentThread(
  dataSource: ApiTenantDataSource,
  actor: TenantUser
): Promise<Conversation> {
  const conversation = await dataSource.ensureConversation!({
    id: agentThreadId(actor.id),
    tenantId: actor.tenantId,
    entityType: "agent",
    entityId: actor.id,
    conversationType: "agent",
    title: "Тред агента",
    createdByUserId: actor.id
  });
  await dataSource.addConversationMembers!({
    tenantId: actor.tenantId,
    conversationId: conversation.id,
    userIds: [actor.id]
  });
  return conversation;
}

/** Типизированная agent-часть metadata персистентного хода. */
export type AgentTurnMetadata =
  | { role: "user" }
  | { role: "agent"; kind?: "error"; proposal?: Record<string, unknown> }
  | {
      role: "agent";
      kind: "result";
      correlationId?: string;
      outcomes: Array<{
        tool: string;
        status: string;
        auditEventId?: string;
        planningAuditEventId?: string;
        planVersion?: number;
      }>;
    };

export async function appendAgentTurn(
  dataSource: ApiTenantDataSource,
  actor: TenantUser,
  conversationId: string,
  body: string,
  agent: AgentTurnMetadata,
  attachmentIds?: string[]
): Promise<string> {
  const id = `message-agent-turn-${randomUUID()}`;
  await dataSource.createDiscussionMessage!({
    id,
    tenantId: actor.tenantId,
    conversationId,
    authorUserId: actor.id,
    body: capText(body, BODY_CAP),
    metadata: {
      agent,
      ...(attachmentIds && attachmentIds.length > 0 ? { attachmentIds: attachmentIds.slice(0, 20) } : {})
    }
  });
  return id;
}

/**
 * Компактный снимок предложения для истории: объект/действие/before/after/права.
 * Полный payload действий НЕ персистится (капы выше) — источник правды для
 * применения остаётся в live-контракте propose/execute, а не в истории.
 * Неизвестные будущие поля действий сюда не попадают by design (forward-safe).
 */
export function proposalSnapshot(result: {
  model: string;
  stopReason?: string;
  proposedActions: Array<{
    tool: string;
    title: string;
    preview: { before: string; after: string };
    capability: { allowed: boolean };
  }>;
}): Record<string, unknown> {
  return {
    model: result.model,
    ...(result.stopReason ? { stopReason: result.stopReason } : {}),
    actionsTotal: result.proposedActions.length,
    actions: result.proposedActions.slice(0, SNAPSHOT_ACTIONS_CAP).map((action) => ({
      tool: action.tool,
      title: capText(action.title),
      before: capText(action.preview.before),
      after: capText(action.preview.after),
      allowed: action.capability.allowed
    }))
  };
}

export function serializeAgentConversation(conversation: Conversation) {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    archivedAt: conversation.archivedAt?.toISOString() ?? null
  };
}

/** История для LLM из персистентного треда: user/agent-ходы, error-квитанции пропускаются. */
export function historyFromThreadMessages(
  messages: Array<{ body: string; metadata: Record<string, unknown> }>
): Array<{ role: "user" | "assistant"; content: string }> {
  const turns: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const message of messages) {
    const agent = (message.metadata as { agent?: { role?: unknown; kind?: unknown } }).agent;
    if (!agent) continue;
    if (agent.kind === "error") continue;
    if (agent.role === "user") turns.push({ role: "user", content: message.body });
    else if (agent.role === "agent") turns.push({ role: "assistant", content: message.body });
  }
  return turns;
}
