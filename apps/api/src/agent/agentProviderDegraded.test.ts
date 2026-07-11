import { describe, expect, it, vi } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import type { ApiTenantDataSource } from "../apiTypes";
import { createApp } from "../app";

const COOKIE = "kiss_pm_session=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

function createHarness() {
  const permissions: AccessProfile["permissions"] = [
    "tenant.projects.read",
    "tenant.project_plan.read"
  ];
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

describe("agent provider degraded mode", () => {
  it("reports degraded provider status without allowing a silent mock proposal success", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("KISS_PM_AGENT_PROVIDER", "");
    vi.stubEnv("KISS_PM_AGENT_DEMO", "");
    const app = createHarness();

    const tools = await app.request("/api/workspace/agent/tools", { headers: { cookie: COOKIE } });
    expect(tools.status).toBe(200);
    await expect(tools.json()).resolves.toMatchObject({ provider: { model: "mock-llm", live: false, configured: false } });

    const propose = await post(app, "/api/workspace/agent/propose", { goal: "Продвинь мои задачи" });
    expect(propose.status).toBe(503);
    expect(propose.body).toEqual({ error: "agent_provider_not_configured", provider: { model: "mock-llm", live: false, configured: false } });

    const stream = await post(app, "/api/workspace/agent/propose/stream", { goal: "Продвинь мои задачи" });
    expect(stream.status).toBe(503);
    expect(stream.body).toEqual({ error: "agent_provider_not_configured", provider: { model: "mock-llm", live: false, configured: false } });
  });
});
