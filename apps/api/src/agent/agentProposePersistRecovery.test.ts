import { afterEach, describe, expect, it, vi } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import type { Conversation } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "../apiTypes";
import { createApp } from "../app";
import { runAgentLoop } from "./agentLoop";
import { historyFromThreadMessages } from "./agentThread";
import { createMockLlmProvider, setAgentLlmProviderOverride, type LlmMessage, type LlmProvider, type LlmResponse } from "./llmProvider";
import { findAgentTool } from "./toolRegistry";

const COOKIE = "kiss_pm_session=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

afterEach(() => {
  setAgentLlmProviderOverride(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function stubUnconfiguredProviderEnv(): void {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("KISS_PM_AGENT_PROVIDER", "");
  vi.stubEnv("KISS_PM_AGENT_DEMO", "");
  vi.stubEnv("KISS_PM_AGENT_SCRIPTED", "");
  vi.stubEnv("KISS_PM_E2E_TEST_HOOKS", "");
}

type StoredMessage = {
  id: string;
  conversationId: string;
  authorUserId: string;
  body: string;
  metadata: Record<string, unknown>;
};

/**
 * Харнесс с управляемым сбоем записи: `failWritesFrom` — номер вызова
 * createDiscussionMessage (1-based), начиная с которого запись падает. Так
 * воспроизводится «цель записалась, а ход агента — уже нет».
 */
function createHarness(options: { failWritesFrom?: number } = {}) {
  const permissions: AccessProfile["permissions"] = ["tenant.projects.read", "tenant.tasks.edit"];
  const conversations = new Map<string, Conversation>();
  const messages: StoredMessage[] = [];
  let writeAttempts = 0;

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
    async ensureConversation(input) {
      const existing = conversations.get(input.id);
      if (existing) return existing;
      const record: Conversation = { ...input, createdAt: new Date("2026-07-18T10:00:00.000Z"), archivedAt: null };
      conversations.set(input.id, record);
      return record;
    },
    async findConversation(_tenantId, conversationId) { return conversations.get(conversationId); },
    async addConversationMembers() { return undefined as never; },
    async createDiscussionMessage(input) {
      writeAttempts += 1;
      if (options.failWritesFrom !== undefined && writeAttempts >= options.failWritesFrom) {
        throw new Error("thread_write_unreachable");
      }
      messages.push({
        id: input.id,
        conversationId: input.conversationId,
        authorUserId: input.authorUserId,
        body: input.body,
        metadata: input.metadata
      });
      return { ...input, createdAt: new Date("2026-07-18T10:00:01.000Z"), editedAt: null, archivedAt: null, pinnedAt: null, pinnedByUserId: null } as never;
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

  return { app: createApp({ dataSource: dataSource as ApiTenantDataSource }), messages };
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

function captureHistoryProvider(seen: { messages: LlmMessage[] }): LlmProvider {
  return {
    model: "test-live",
    createMessage(input) {
      seen.messages = input.messages.map((message) => ({ role: message.role, content: message.content }));
      return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Готово." }] });
    }
  };
}

// ── Дефект 1: осиротевшая цель после сбоя апстрима отравляет последующую историю ──
// Персистенция сбоя пишет цель + error-квитанцию, но реплей выбрасывал только квитанцию.
// Оставшийся user-ход + дописанная agentLoop текущая цель = два user-хода подряд, и
// каждый следующий сбой добавлял ещё один. Прямой Anthropic-путь такое отвергает.
describe("реплей истории: цель без ответа не осиротевает после сбоя апстрима", () => {
  const userTurn = (body: string) => ({ body, metadata: { agent: { role: "user" } } });
  const agentTurn = (body: string) => ({ body, metadata: { agent: { role: "agent" } } });
  const errorTurn = (body: string) => ({ body, metadata: { agent: { role: "agent", kind: "error" } } });

  it("выбрасывает цель вместе с квитанцией, на которую та отвечает", () => {
    const history = historyFromThreadMessages([
      userTurn("цель 1"),
      agentTurn("ответ 1"),
      userTurn("цель 2"),
      errorTurn("Не удалось получить ответ от LLM — попробуйте повторить запрос.")
    ]);

    expect(history).toEqual([
      { role: "user", content: "цель 1" },
      { role: "assistant", content: "ответ 1" }
    ]);
  });

  it("серия сбоев подряд не оставляет ни одного лишнего user-хода", () => {
    const history = historyFromThreadMessages([
      userTurn("цель 1"),
      agentTurn("ответ 1"),
      userTurn("цель 2"),
      errorTurn("сбой"),
      userTurn("цель 2"),
      errorTurn("сбой"),
      userTurn("цель 2"),
      errorTurn("сбой")
    ]);

    expect(history.filter((turn) => turn.role === "user")).toHaveLength(1);
    // Ни одной пары одинаковых ролей подряд.
    expect(history.every((turn, index) => index === 0 || turn.role !== history[index - 1]!.role)).toBe(true);
  });

  it("квитанция после ответа агента ничего лишнего не срезает (существующий контракт)", () => {
    const history = historyFromThreadMessages([
      userTurn("цель 1"),
      agentTurn("ответ 1"),
      errorTurn("сбой без своей цели")
    ]);

    expect(history).toEqual([
      { role: "user", content: "цель 1" },
      { role: "assistant", content: "ответ 1" }
    ]);
  });

  it("propose после сбоя апстрима: модель получает валидное чередование ролей", async () => {
    stubUnconfiguredProviderEnv();
    const harness = createHarness();
    harness.messages.push(
      { id: "m-1", conversationId: "agent-thread-user-agent", authorUserId: "user-agent", body: "цель 1", metadata: { agent: { role: "user" } } },
      { id: "m-2", conversationId: "agent-thread-user-agent", authorUserId: "user-agent", body: "ответ 1", metadata: { agent: { role: "agent" } } },
      { id: "m-3", conversationId: "agent-thread-user-agent", authorUserId: "user-agent", body: "Продвинь мои задачи", metadata: { agent: { role: "user" } } },
      { id: "m-4", conversationId: "agent-thread-user-agent", authorUserId: "user-agent", body: "Не удалось получить ответ от LLM — попробуйте повторить запрос.", metadata: { agent: { role: "agent", kind: "error" } } }
    );
    const seen = { messages: [] as LlmMessage[] };
    setAgentLlmProviderOverride(captureHistoryProvider(seen));

    const propose = await post(harness.app, "/api/workspace/agent/propose", {
      goal: "Продвинь мои задачи",
      threadId: "agent-thread-user-agent"
    });

    expect(propose.status).toBe(200);
    expect(seen.messages.map((message) => message.content)).toEqual(["цель 1", "ответ 1", "Продвинь мои задачи"]);
    expect(seen.messages.every((message, index) => index === 0 || message.role !== seen.messages[index - 1]!.role)).toBe(true);
  });
});

// ── Дефект 1 (защита в глубину): agentLoop не отдаёт провайдеру два хода одной роли ──
describe("runAgentLoop: нормализация стартовой последовательности ролей", () => {
  const listMyTasks = findAgentTool("list_my_tasks")!;

  async function runWithHistory(history: LlmMessage[]): Promise<LlmMessage[]> {
    const script: LlmResponse[] = [{ stopReason: "end_turn", content: [{ type: "text", text: "Ок." }] }];
    const provider = createMockLlmProvider(script);
    let seen: LlmMessage[] = [];
    const spy: LlmProvider = {
      model: provider.model,
      createMessage(input) {
        seen = input.messages.map((message) => ({ role: message.role, content: message.content }));
        return provider.createMessage(input);
      }
    };
    await runAgentLoop({ provider: spy, system: "test", goal: "текущая цель", tools: [listMyTasks], executeAnalyze: async () => ({}), history });
    return seen;
  }

  it("склеивает висящий user-ход с текущей целью вместо двух user-ходов подряд", async () => {
    const seen = await runWithHistory([
      { role: "user", content: "цель 1" },
      { role: "assistant", content: "ответ 1" },
      { role: "user", content: "недописанная цель" }
    ]);

    expect(seen.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    // Текст висящего хода не потерян — он приклеен к текущей цели.
    expect(String(seen.at(-1)!.content)).toContain("недописанная цель");
    expect(String(seen.at(-1)!.content)).toContain("текущая цель");
  });

  it("срезает ведущие assistant-ходы (усечённое окно истории)", async () => {
    const seen = await runWithHistory([
      { role: "assistant", content: "хвост прошлого ответа" },
      { role: "user", content: "цель 1" },
      { role: "assistant", content: "ответ 1" }
    ]);

    expect(seen.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    expect(seen[0]!.content).toBe("цель 1");
  });
});

// ── Дефект 2: сбой ЗАПИСИ успешного хода — это не «LLM не ответил» ──
// Общий catch роута повторно звал персистенцию как upstream_failed: цель писалась
// второй раз, а реальный ответ модели подменялся квитанцией об ошибке.
describe("propose: сбой персистенции успешного хода не выдаётся за сбой LLM", () => {
  it("JSON: ответ модели сохранён, цель не продублирована, квитанции об ошибке нет", async () => {
    stubUnconfiguredProviderEnv();
    // Первая запись (цель) проходит, вторая (ход агента) падает.
    const harness = createHarness({ failWritesFrom: 2 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    setAgentLlmProviderOverride({
      model: "test-live",
      createMessage() {
        return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Вот что я предлагаю." }] });
      }
    });

    const propose = await post(harness.app, "/api/workspace/agent/propose", {
      goal: "Продвинь мои задачи",
      threadId: "agent-thread-user-agent"
    });

    // Модель ответила — наружу 200 с реальным ответом, а не 502 agent_upstream_failed.
    expect(propose.status).toBe(200);
    expect(propose.body.error).toBeUndefined();
    expect(propose.body.reasoning).toBe("Вот что я предлагаю.");
    // Сбой записи признан честно, id-шников для дедупликации нет.
    expect(propose.body.persistFailed).toBe(true);
    expect(propose.body.messageIds).toBeUndefined();
    // Цель записана РОВНО один раз, поверх неё не легла квитанция об ошибке.
    expect(harness.messages.map((message) => message.body)).toEqual(["Продвинь мои задачи"]);
    expect(harness.messages.some((message) => message.body.includes("Не удалось получить ответ от LLM"))).toBe(false);
  });

  it("SSE: тот же контракт — done с ответом модели, а не error-эвент", async () => {
    stubUnconfiguredProviderEnv();
    const harness = createHarness({ failWritesFrom: 2 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    setAgentLlmProviderOverride({
      model: "test-live",
      createMessage() {
        return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Вот что я предлагаю." }] });
      }
    });

    const response = await harness.app.request("/api/workspace/agent/propose/stream", {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", cookie: COOKIE },
      body: JSON.stringify({ goal: "Продвинь мои задачи", threadId: "agent-thread-user-agent" })
    });
    const raw = await response.text();

    expect(raw).toContain("event: done");
    expect(raw).not.toContain("agent_upstream_failed");
    expect(raw).toContain("Вот что я предлагаю.");
    expect(raw).toContain("persistFailed");
    expect(harness.messages.map((message) => message.body)).toEqual(["Продвинь мои задачи"]);
  });

  it("сбой САМОГО LLM по-прежнему даёт 502 и квитанцию в треде (регрессия не задета)", async () => {
    stubUnconfiguredProviderEnv();
    const harness = createHarness();
    vi.spyOn(console, "error").mockImplementation(() => {});
    setAgentLlmProviderOverride({
      model: "test-live",
      createMessage() {
        return Promise.reject(new Error("upstream_502"));
      }
    });

    const propose = await post(harness.app, "/api/workspace/agent/propose", {
      goal: "Продвинь мои задачи",
      threadId: "agent-thread-user-agent"
    });

    expect(propose.status).toBe(502);
    expect(propose.body.error).toBe("agent_upstream_failed");
    expect(harness.messages.map((message) => message.body)).toEqual([
      "Продвинь мои задачи",
      "Не удалось получить ответ от LLM — попробуйте повторить запрос. Детали сбоя записаны в серверный лог."
    ]);
  });
});
