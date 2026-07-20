import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

import type { AccessProfile } from "@kiss-pm/access-control";
import type { ApiTenantDataSource } from "../apiTypes";
import { createApp } from "../app";
import { agentThreadId } from "./agentThread";

const COOKIE = "kiss_pm_session=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

// Провайдер поднят (scripted за двойным гейтом), но сборка истории треда падает —
// runProposeLoop бросает ДО обращения к LLM. Проверяем, что JSON /propose честно
// отвечает 502 {error}, а не даёт исключению всплыть в generic 500.
function createHarness(overrides: Partial<ApiTenantDataSource> = {}) {
  const permissions: AccessProfile["permissions"] = ["tenant.projects.read"];
  const dataSource: Partial<ApiTenantDataSource> = {
    async findUserById(userId) {
      return userId === "user-agent" ? { id: "user-agent", tenantId: "tenant-1", name: "Agent User", accessProfileId: "profile-1" } : undefined;
    },
    async findTenantById(tenantId) {
      return tenantId === "tenant-1" ? { id: tenantId, name: "Tenant" } : undefined;
    },
    async findAccessProfileById() {
      return { id: "profile-1", permissions };
    },
    async listWorkspaceUsers() {
      return [];
    },
    async findSessionByTokenHash() {
      return { id: "session-1", tenantId: "tenant-1", userId: "user-agent", tokenHash: "ignored", expiresAt: new Date(Date.now() + 60_000) };
    },
    async listMyWorkTasks() {
      return [];
    },
    // Сборка истории из персистентного треда падает — единственный источник исключения.
    async listDiscussionMessages() {
      throw new Error("thread_store_unreachable");
    },
    ...overrides
  };
  return createApp({ dataSource: dataSource as ApiTenantDataSource });
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

function stubScriptedProviderEnv(): void {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("KISS_PM_AGENT_PROVIDER", "");
  vi.stubEnv("KISS_PM_AGENT_DEMO", "");
  vi.stubEnv("KISS_PM_AGENT_SCRIPTED", "1");
  vi.stubEnv("KISS_PM_E2E_TEST_HOOKS", "1");
}

describe("agent JSON /propose: honest 502 on runProposeLoop failure", () => {
  it("wraps a thrown loop in a 502 {error} instead of an unhandled 500", async () => {
    stubScriptedProviderEnv();
    const app = createHarness();

    const propose = await post(app, "/api/workspace/agent/propose", {
      goal: "Продвинь мои задачи",
      threadId: agentThreadId("user-agent")
    });

    expect(propose.status).toBe(502);
    // Ревью F3: наружу — СТАБИЛЬНЫЙ код, а не error.message апстрима. Сырой текст
    // собирается из 300 байт ответа OpenRouter и раскрывал бы любому пользователю
    // тенанта провайдера, статус апстрима, состояние квоты и настройки ключа.
    expect(propose.body.error).toBe("agent_upstream_failed");
    expect(JSON.stringify(propose.body)).not.toContain("thread_store_unreachable");
  });
});

// ── Ревью F3: сбой апстрима не теряет набранную пользователем цель ──
// Ветка provider_unavailable персистит реплику + квитанцию (сбой «переживает reload»),
// а throw-ветка этого не делала: транзиентный 5xx апстрима стирал ход пользователя,
// тогда как всего лишь ненастроенный провайдер его сохранял.
describe("agent /propose: сбой апстрима персистит ход в тред", () => {
  function createPersistingHarness() {
    const created: Array<{ body: string; metadata: Record<string, unknown> }> = [];
    const app = createHarness({
      async ensureConversation(input) {
        return {
          id: input.id,
          tenantId: input.tenantId,
          entityType: input.entityType,
          entityId: input.entityId,
          conversationType: input.conversationType,
          title: input.title,
          createdByUserId: input.createdByUserId,
          createdAt: new Date(),
          archivedAt: null
        } as unknown as Awaited<ReturnType<NonNullable<ApiTenantDataSource["ensureConversation"]>>>;
      },
      async addConversationMembers() {
        return undefined as unknown as Awaited<ReturnType<NonNullable<ApiTenantDataSource["addConversationMembers"]>>>;
      },
      async createDiscussionMessage(input) {
        const message = { ...input, createdAt: new Date(), archivedAt: null };
        created.push({ body: String(input.body), metadata: (input.metadata ?? {}) as Record<string, unknown> });
        return message as unknown as Awaited<ReturnType<NonNullable<ApiTenantDataSource["createDiscussionMessage"]>>>;
      }
    });
    return { app, created };
  }

  it("JSON: цель и квитанция об ошибке записаны, наружу — стабильный код", async () => {
    stubScriptedProviderEnv();
    const { app, created } = createPersistingHarness();

    const propose = await post(app, "/api/workspace/agent/propose", {
      goal: "Продвинь мои задачи",
      threadId: agentThreadId("user-agent")
    });

    expect(propose.status).toBe(502);
    expect(propose.body.error).toBe("agent_upstream_failed");
    // Ход переживает reload: цель пользователя + честная квитанция об ошибке.
    expect(created.map((message) => message.body)).toEqual([
      "Продвинь мои задачи",
      "Не удалось получить ответ от LLM — попробуйте повторить запрос. Детали сбоя записаны в серверный лог."
    ]);
    expect((created[1]!.metadata as { agent?: { kind?: string } }).agent?.kind).toBe("error");
    // Клиент получает id для дедупликации своих optimistic-сообщений при гидрации.
    expect(propose.body.threadId).toBe(agentThreadId("user-agent"));
    expect(Array.isArray(propose.body.messageIds)).toBe(true);
    expect((propose.body.messageIds as string[]).length).toBe(2);
    // Сырой текст апстрима в тред не попадает.
    expect(created.map((message) => message.body).join(" ")).not.toContain("thread_store_unreachable");
  });

  it("SSE: тот же контракт — error-эвент со стабильным кодом и персистированный ход", async () => {
    stubScriptedProviderEnv();
    const { app, created } = createPersistingHarness();

    const response = await app.request("/api/workspace/agent/propose/stream", {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", cookie: COOKIE },
      body: JSON.stringify({ goal: "Продвинь мои задачи", threadId: agentThreadId("user-agent") })
    });
    const raw = await response.text();

    expect(raw).toContain("event: error");
    expect(raw).toContain("agent_upstream_failed");
    expect(raw).not.toContain("thread_store_unreachable");
    expect(created.map((message) => message.body)).toEqual([
      "Продвинь мои задачи",
      "Не удалось получить ответ от LLM — попробуйте повторить запрос. Детали сбоя записаны в серверный лог."
    ]);
  });
});
