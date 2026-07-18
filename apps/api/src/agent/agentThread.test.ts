import { afterEach, describe, expect, it, vi } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import type { Conversation } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "../apiTypes";
import { createApp } from "../app";
import { conversationChannel, subscribeWorkspaceEvents } from "../workspaceEventBus";
import type { LlmProvider } from "./llmProvider";
import { setAgentLlmProviderOverride } from "./llmProvider";

const COOKIE = "kiss_pm_session=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

afterEach(() => {
  setAgentLlmProviderOverride(null);
  vi.unstubAllEnvs();
});

// Гарантированно ненастроенный LLM-канал (иначе ключи из окружения разработчика
// включили бы реальный провайдер и тест ушёл бы в сеть).
function stubUnconfiguredProviderEnv() {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("KISS_PM_AGENT_PROVIDER", "");
  vi.stubEnv("KISS_PM_AGENT_DEMO", "");
  vi.stubEnv("KISS_PM_AGENT_SCRIPTED", "");
  vi.stubEnv("KISS_PM_E2E_TEST_HOOKS", "");
}

// Живой (configured) провайдер для тестов: одно предложение comment_task и завершение.
function liveTestProvider(): LlmProvider {
  let proposed = false;
  return {
    model: "test-live",
    createMessage(input) {
      if (!proposed && input.tools.some((tool) => tool.name === "comment_task")) {
        proposed = true;
        return Promise.resolve({
          stopReason: "tool_use",
          content: [
            { type: "text", text: "Предлагаю зафиксировать статус комментарием." },
            { type: "tool_use", id: "t-1", name: "comment_task", input: { taskId: "task-a", body: "Готово" } }
          ]
        });
      }
      return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Предложение готово." }] });
    }
  };
}

type StoredMessage = {
  id: string;
  conversationId: string;
  authorUserId: string;
  body: string;
  metadata: Record<string, unknown>;
};

function createHarness(options: { collaboration?: boolean } = {}) {
  const permissions: AccessProfile["permissions"] = [
    "tenant.projects.read",
    "tenant.tasks.edit"
  ];
  const conversations = new Map<string, Conversation>();
  const members = new Map<string, Set<string>>();
  const messages: StoredMessage[] = [];

  const collaboration: Partial<ApiTenantDataSource> = options.collaboration === false ? {} : {
    async ensureConversation(input) {
      const existing = conversations.get(input.id);
      if (existing) return existing;
      const record: Conversation = { ...input, createdAt: new Date("2026-07-18T10:00:00.000Z"), archivedAt: null };
      conversations.set(input.id, record);
      return record;
    },
    async findConversation(_tenantId, conversationId) {
      return conversations.get(conversationId);
    },
    async addConversationMembers(input) {
      const set = members.get(input.conversationId) ?? new Set<string>();
      for (const userId of input.userIds) set.add(userId);
      members.set(input.conversationId, set);
    },
    async createDiscussionMessage(input) {
      const record: StoredMessage = {
        id: input.id,
        conversationId: input.conversationId,
        authorUserId: input.authorUserId,
        body: input.body,
        metadata: input.metadata
      };
      messages.push(record);
      return {
        ...input,
        createdAt: new Date("2026-07-18T10:00:01.000Z"),
        editedAt: null,
        archivedAt: null,
        pinnedAt: null,
        pinnedByUserId: null
      } as never;
    },
    async listDiscussionMessages(input) {
      return messages
        .filter((message) => message.conversationId === input.conversationId)
        .slice(-input.limit)
        .map((message) => ({
          id: message.id,
          tenantId: "tenant-1",
          conversationId: message.conversationId,
          authorUserId: message.authorUserId,
          body: message.body,
          metadata: message.metadata,
          createdAt: new Date("2026-07-18T10:00:01.000Z"),
          editedAt: null,
          archivedAt: null,
          pinnedAt: null,
          pinnedByUserId: null
        })) as never;
    }
  };

  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() { return []; },
    async findUserById(userId) {
      return userId === "user-agent" ? { id: "user-agent", tenantId: "tenant-1", name: "Агент Пользователь", accessProfileId: "p" } : undefined;
    },
    async findTenantById(tenantId) { return tenantId === "tenant-1" ? { id: tenantId, name: "T" } : undefined; },
    async findAccessProfileById() { return { id: "p", permissions }; },
    async listUsersByTenantId() { return []; },
    async listWorkspaceUsers() { return []; },
    async findSessionByTokenHash() {
      return { id: "s", tenantId: "tenant-1", userId: "user-agent", tokenHash: "ignored", expiresAt: new Date("2099-01-01T00:00:00.000Z") };
    },
    async listMyWorkTasks() { return []; },
    ...collaboration
  };

  return {
    app: createApp({ dataSource: dataSource as ApiTenantDataSource }),
    conversations,
    members,
    messages
  };
}

async function post(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  const res = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", cookie: COOKIE },
    body: JSON.stringify(body)
  });
  const raw = await res.text();
  return { status: res.status, body: raw ? JSON.parse(raw) as Record<string, unknown> : {} };
}

describe("GET /api/workspace/agent/thread", () => {
  it("create-or-get идемпотентен: один тред, membership владельца, readState отсутствует честно", async () => {
    const harness = createHarness();
    const first = await harness.app.request("/api/workspace/agent/thread", { headers: { cookie: COOKIE } });
    expect(first.status).toBe(200);
    const firstPayload = await first.json() as { conversation: { id: string; entityType: string; conversationType: string }; readState: unknown };
    expect(firstPayload.conversation.id).toBe("agent-thread-user-agent");
    expect(firstPayload.conversation.entityType).toBe("agent");
    expect(firstPayload.conversation.conversationType).toBe("agent");
    expect(firstPayload.readState).toBeNull();

    const second = await harness.app.request("/api/workspace/agent/thread", { headers: { cookie: COOKIE } });
    const secondPayload = await second.json() as { conversation: { id: string } };
    expect(secondPayload.conversation.id).toBe(firstPayload.conversation.id);
    expect(harness.conversations.size).toBe(1);
    expect([...(harness.members.get("agent-thread-user-agent") ?? [])]).toEqual(["user-agent"]);
  });

  it("отвечает 401 без сессии и 501 без collaboration-персистентности", async () => {
    const harness = createHarness();
    const anonymous = await harness.app.request("/api/workspace/agent/thread");
    expect(anonymous.status).toBe(401);

    const partial = createHarness({ collaboration: false });
    const degraded = await partial.app.request("/api/workspace/agent/thread", { headers: { cookie: COOKIE } });
    expect(degraded.status).toBe(501);
    await expect(degraded.json()).resolves.toEqual({ error: "collaboration_not_configured" });
  });
});

describe("propose → персистентность треда", () => {
  it("при недоступном LLM персистит реплику пользователя и error-квитанцию, возвращая messageIds в 503", async () => {
    stubUnconfiguredProviderEnv();
    const harness = createHarness();
    const propose = await post(harness.app, "/api/workspace/agent/propose", { goal: "Продвинь мои задачи" });

    expect(propose.status).toBe(503);
    expect(propose.body.threadId).toBe("agent-thread-user-agent");
    expect(propose.body.messageIds).toHaveLength(2);
    expect(harness.messages).toHaveLength(2);
    expect(harness.messages[0]).toMatchObject({
      body: "Продвинь мои задачи",
      authorUserId: "user-agent",
      metadata: { agent: { role: "user" } }
    });
    expect(harness.messages[1]!.metadata).toMatchObject({ agent: { role: "agent", kind: "error" } });
    expect(harness.messages[1]!.body).toContain("LLM-провайдер не настроен");
  });

  it("успешный propose персистит user-ход и ответ агента со снимком proposal", async () => {
    setAgentLlmProviderOverride(liveTestProvider());
    const harness = createHarness();
    const propose = await post(harness.app, "/api/workspace/agent/propose", { goal: "Зафиксируй статус" });

    expect(propose.status).toBe(200);
    expect(propose.body.threadId).toBe("agent-thread-user-agent");
    expect(propose.body.messageIds).toHaveLength(2);
    // Порядок как в live-виде: user → trace (шаги хода) → ответ агента.
    expect(harness.messages).toHaveLength(3);
    const traceTurn = harness.messages[1]!;
    const traceMeta = traceTurn.metadata.agent as { role: string; steps: string[] };
    expect(traceMeta.role).toBe("trace");
    expect(traceMeta.steps.length).toBeGreaterThan(0);
    expect(propose.body.traceMessageId).toBe(traceTurn.id);
    const agentTurn = harness.messages[2]!;
    const agentMeta = agentTurn.metadata.agent as { role: string; proposal: { actions: Array<{ tool: string; allowed: boolean }>; actionsTotal: number } };
    expect(agentMeta.role).toBe("agent");
    expect(agentMeta.proposal.actionsTotal).toBe(1);
    expect(agentMeta.proposal.actions[0]).toMatchObject({ tool: "comment_task" });
  });

  it("realtime: каждый персистентный ход эмитится message.created в канал треда", async () => {
    setAgentLlmProviderOverride(liveTestProvider());
    const harness = createHarness();
    const received: Array<{ type: string; conversationId: string }> = [];
    const unsubscribe = subscribeWorkspaceEvents(conversationChannel("agent-thread-user-agent"), (event) => {
      if (event.type === "message.created") received.push({ type: event.type, conversationId: event.conversationId });
    });
    try {
      await post(harness.app, "/api/workspace/agent/propose", { goal: "Зафиксируй статус" });
    } finally {
      unsubscribe();
    }
    // user + trace + ответ агента — все три хода видны подписчикам канала беседы.
    expect(received).toHaveLength(3);
    expect(received.every((event) => event.conversationId === "agent-thread-user-agent")).toBe(true);
  });

  it("отвергает чужой threadId (403 agent_thread_forbidden) до запуска LLM", async () => {
    setAgentLlmProviderOverride(liveTestProvider());
    const harness = createHarness();
    // Чужой agent-тред существует в БД — id известен, но entityId другого пользователя.
    harness.conversations.set("agent-thread-other-user", {
      id: "agent-thread-other-user",
      tenantId: "tenant-1",
      entityType: "agent",
      entityId: "other-user",
      conversationType: "agent",
      title: "Тред агента",
      createdByUserId: "other-user",
      createdAt: new Date("2026-07-18T09:00:00.000Z"),
      archivedAt: null
    });
    const propose = await post(harness.app, "/api/workspace/agent/propose", {
      goal: "Зафиксируй статус",
      threadId: "agent-thread-other-user"
    });
    expect(propose.status).toBe(403);
    expect(propose.body).toEqual({ error: "agent_thread_forbidden" });
    expect(harness.messages).toHaveLength(0);
  });

  it("принимает legacy-id собственного треда: владение проверяется по беседе, а не по детерминированному id", async () => {
    setAgentLlmProviderOverride(liveTestProvider());
    const harness = createHarness();
    // Существующий тред пользователя под недетерминированным id (импорт/ранняя версия):
    // GET /agent/thread вернул бы его через upsert по tuple — propose обязан его принять.
    harness.conversations.set("conversation-legacy-42", {
      id: "conversation-legacy-42",
      tenantId: "tenant-1",
      entityType: "agent",
      entityId: "user-agent",
      conversationType: "agent",
      title: "Тред агента",
      createdByUserId: "user-agent",
      createdAt: new Date("2026-07-18T09:00:00.000Z"),
      archivedAt: null
    });
    const propose = await post(harness.app, "/api/workspace/agent/propose", {
      goal: "Зафиксируй статус",
      threadId: "conversation-legacy-42"
    });
    expect(propose.status).toBe(200);
  });

  it("с переданным threadId сервер собирает историю из треда, пропуская error-квитанции", async () => {
    const captured: Array<{ role: string; content: unknown }> = [];
    setAgentLlmProviderOverride({
      model: "test-live",
      createMessage(input) {
        captured.push(...input.messages.map((message) => ({ role: message.role, content: message.content })));
        return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Ок." }] });
      }
    });
    const harness = createHarness();
    // Предыстория: успешный ход + error-квитанция (не должна попасть в контекст LLM).
    await post(harness.app, "/api/workspace/agent/propose", { goal: "Первый запрос" });
    harness.messages[1]!.metadata = { agent: { role: "agent" } }; // прошлый ответ агента
    harness.messages.push({
      id: "message-err",
      conversationId: "agent-thread-user-agent",
      authorUserId: "user-agent",
      body: "LLM-провайдер не настроен",
      metadata: { agent: { role: "agent", kind: "error" } }
    });

    await post(harness.app, "/api/workspace/agent/propose", {
      goal: "Второй запрос",
      threadId: "agent-thread-user-agent",
      // Клиентская история игнорируется: источник истины — персистентный тред.
      history: [{ role: "user", text: "фейковая клиентская история" }]
    });

    const flattened = JSON.stringify(captured);
    expect(flattened).toContain("Первый запрос");
    expect(flattened).not.toContain("не настроен");
    expect(flattened).not.toContain("фейковая клиентская история");
  });
});

describe("execute → персистентность исхода", () => {
  it("персистит result-сообщение с per-action outcomes даже для failed-исхода", async () => {
    const harness = createHarness();
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "comment_task", input: { taskId: "task-a", body: "Комментарий" } }]
    });

    expect(execute.status).toBe(200);
    expect(execute.body.threadId).toBe("agent-thread-user-agent");
    expect(typeof execute.body.messageId).toBe("string");
    const resultTurn = harness.messages.find((message) => message.id === execute.body.messageId)!;
    expect(resultTurn.body).toContain("Результат: применено 0");
    expect(resultTurn.metadata.agent).toMatchObject({
      role: "agent",
      kind: "result",
      outcomes: [{ tool: "comment_task", status: "failed" }]
    });
  });

  it("partial-режим без collaboration-персистентности: контракт execute не ломается, messageId отсутствует", async () => {
    const harness = createHarness({ collaboration: false });
    const execute = await post(harness.app, "/api/workspace/agent/execute", {
      actions: [{ tool: "comment_task", input: { taskId: "task-a", body: "Комментарий" } }]
    });

    expect(execute.status).toBe(200);
    expect(execute.body.threadId).toBeUndefined();
    expect(execute.body.messageId).toBeUndefined();
    expect(execute.body.results).toMatchObject([{ tool: "comment_task", status: "failed" }]);
  });
});
