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
function createHarness() {
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
    }
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

describe("agent JSON /propose: honest 502 on runProposeLoop failure", () => {
  it("wraps a thrown loop in a 502 {error} instead of an unhandled 500", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("KISS_PM_AGENT_PROVIDER", "");
    vi.stubEnv("KISS_PM_AGENT_DEMO", "");
    vi.stubEnv("KISS_PM_AGENT_SCRIPTED", "1");
    vi.stubEnv("KISS_PM_E2E_TEST_HOOKS", "1");
    const app = createHarness();

    const propose = await post(app, "/api/workspace/agent/propose", {
      goal: "Продвинь мои задачи",
      threadId: agentThreadId("user-agent")
    });

    expect(propose.status).toBe(502);
    expect(propose.body.error).toBe("thread_store_unreachable");
  });
});
