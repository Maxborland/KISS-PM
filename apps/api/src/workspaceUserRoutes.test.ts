import { describe, expect, it } from "vitest";
import type { Permission } from "@kiss-pm/access-control";
import { createApp } from "./app";
import { hashResetToken, verifyPassword } from "@kiss-pm/persistence";
import type {
  ApiTenantDataSource,
  PasswordResetTokenRecord,
  WorkspaceUserRecord
} from "./apiTypes";

/* ============================================================
   POST /api/workspace/users/:userId/password-reset-token —
   админская выдача токена сброса пароля (delivery:none).
   Фикстура повторяет паттерн app.test.ts: частичный in-memory
   data-source + createApp({dataSource}); cookie-сессия admin-актора.
   ============================================================ */

const TENANT = "tenant-alpha";
const ADMIN_ID = "user-alpha-admin";
const TARGET_ID = "user-alpha-target";
const sessionCookie =
  "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const mutationHeaders = {
  cookie: sessionCookie,
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin"
};

function workspaceUser(id: string, name: string): WorkspaceUserRecord {
  return {
    id,
    tenantId: TENANT,
    email: `${id}@kiss-pm.local`,
    name,
    accessProfileId: "profile-admin",
    positionId: null,
    positionName: null,
    phone: null,
    telegram: null,
    status: "active",
    theme: "light",
    accentColor: "#0f766e"
  };
}

type AuditEventRow = {
  actionType: string;
  input: Record<string, unknown>;
  afterState: Record<string, unknown> | null;
  executionResult: Record<string, unknown>;
  sourceEntity: { type: string; id: string };
};

function createFixture(options: { permissions?: Permission[]; withCreateToken?: boolean } = {}) {
  const permissions: Permission[] = options.permissions ?? ["tenant.users.manage"];
  const resetTokens: PasswordResetTokenRecord[] = [];
  const auditEvents: AuditEventRow[] = [];
  const passwordUpdates: Array<{
    tenantId: string;
    userId: string;
    passwordHash: string;
    passwordSalt: string;
  }> = [];
  const revokedSessionUserIds: string[] = [];

  const dataSource: Partial<ApiTenantDataSource> = {
    async findSessionByTokenHash() {
      return {
        id: "session-admin",
        tenantId: TENANT,
        userId: ADMIN_ID,
        tokenHash: "ignored",
        expiresAt: new Date("2099-01-01T00:00:00.000Z")
      };
    },
    async findUserById(userId) {
      return userId === ADMIN_ID
        ? { id: ADMIN_ID, tenantId: TENANT, name: "Анна Админ", accessProfileId: "profile-admin" }
        : undefined;
    },
    async findAccessProfileById() {
      return { id: "profile-admin", permissions };
    },
    async listWorkspaceUsers() {
      return [workspaceUser(ADMIN_ID, "Анна Админ"), workspaceUser(TARGET_ID, "Тарас Цель")];
    },
    async findPasswordResetTokenByHash(tokenHash) {
      return resetTokens.find((token) => token.tokenHash === tokenHash);
    },
    async markPasswordResetTokenConsumed(tenantId, id, consumedAt) {
      const token = resetTokens.find(
        (candidate) => candidate.tenantId === tenantId && candidate.id === id
      );
      if (!token || token.consumedAt !== null) return 0;
      token.consumedAt = consumedAt;
      return 1;
    },
    async updateCredentialPassword(tenantId, userId, input) {
      passwordUpdates.push({ tenantId, userId, ...input });
    },
    async deleteOtherPasswordResetTokensByUserId() {},
    async deleteSessionsByUserId(_tenantId, userId) {
      revokedSessionUserIds.push(userId);
    },
    async withTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    },
    async appendAuditEvent(input) {
      auditEvents.push(input as unknown as AuditEventRow);
    }
  };
  if (options.withCreateToken !== false) {
    dataSource.createPasswordResetToken = async (input) => {
      resetTokens.push(input);
    };
  }

  const app = createApp({ dataSource: dataSource as ApiTenantDataSource });
  return { app, resetTokens, auditEvents, passwordUpdates, revokedSessionUserIds };
}

function issueRequest(app: ReturnType<typeof createFixture>["app"], userId = TARGET_ID) {
  return app.request(`/api/workspace/users/${userId}/password-reset-token`, {
    method: "POST",
    headers: mutationHeaders
  });
}

describe("POST /api/workspace/users/:userId/password-reset-token", () => {
  it("issues a valid reset token once, persists only its hash and completes the confirm flow", async () => {
    const fixture = createFixture();

    const response = await issueRequest(fixture.app);

    expect(response.status).toBe(201);
    const body = (await response.json()) as { resetToken: string; expiresAt: string };
    // rawToken формата существующего механизма: 32 байта hex.
    expect(body.resetToken).toMatch(/^[0-9a-f]{64}$/);
    expect(fixture.resetTokens).toHaveLength(1);
    const persisted = fixture.resetTokens[0]!;
    // Персистится ТОЛЬКО хэш (hashResetToken), raw в записи отсутствует.
    expect(persisted.tokenHash).toBe(hashResetToken(body.resetToken));
    expect(persisted.userId).toBe(TARGET_ID);
    expect(persisted.tenantId).toBe(TENANT);
    expect(persisted.consumedAt).toBeNull();
    expect(body.expiresAt).toBe(persisted.expiresAt.toISOString());
    // TTL — как у публичного password-reset/request: 60 минут.
    expect(persisted.expiresAt.getTime() - persisted.createdAt.getTime()).toBe(60 * 60 * 1000);

    // Токен реально валиден: публичный confirm-флоу меняет пароль цели.
    const confirmResponse = await fixture.app.request("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
      body: JSON.stringify({ token: body.resetToken, password: "brand-new-secret-1" })
    });
    expect(confirmResponse.status).toBe(200);
    await expect(confirmResponse.json()).resolves.toEqual({ status: "ok" });
    expect(fixture.passwordUpdates).toHaveLength(1);
    expect(fixture.passwordUpdates[0]).toMatchObject({ tenantId: TENANT, userId: TARGET_ID });
    expect(
      verifyPassword({
        password: "brand-new-secret-1",
        passwordHash: fixture.passwordUpdates[0]!.passwordHash,
        passwordSalt: fixture.passwordUpdates[0]!.passwordSalt
      })
    ).toBe(true);
    expect(fixture.revokedSessionUserIds).toEqual([TARGET_ID]);
    expect(persisted.consumedAt).not.toBeNull();
  });

  it("records an issuance audit event without leaking the raw token", async () => {
    const fixture = createFixture();

    const response = await issueRequest(fixture.app);
    const body = (await response.json()) as { resetToken: string };

    const issued = fixture.auditEvents.find(
      (event) => event.actionType === "workspace.user.password_reset_token_issued"
    );
    expect(issued).toBeDefined();
    expect(issued!.sourceEntity).toEqual({ type: "TenantUser", id: TARGET_ID });
    expect(issued!.input).toEqual({ userId: TARGET_ID });
    expect(issued!.afterState).toMatchObject({ tokenId: fixture.resetTokens[0]!.id });
    // Честность: rawToken существует в открытом виде только в HTTP-ответе.
    expect(JSON.stringify(fixture.auditEvents)).not.toContain(body.resetToken);
  });

  it("denies actors without tenant.users.manage and audits the denial", async () => {
    const fixture = createFixture({ permissions: ["tenant.users.read"] });

    const response = await issueRequest(fixture.app);

    expect(response.status).toBe(403);
    expect(fixture.resetTokens).toHaveLength(0);
    const denied = fixture.auditEvents.find(
      (event) => event.actionType === "workspace.user.password_reset_token_denied"
    );
    expect(denied).toBeDefined();
    expect(denied!.executionResult).toEqual({ status: "denied" });
  });

  it("returns 404 for a user outside the actor tenant", async () => {
    const fixture = createFixture();

    const response = await issueRequest(fixture.app, "user-beta-foreign");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "user_not_found" });
    expect(fixture.resetTokens).toHaveLength(0);
  });

  it("returns 401 without a session and 501 without persistence", async () => {
    const fixture = createFixture();
    const unauthenticated = await fixture.app.request(
      `/api/workspace/users/${TARGET_ID}/password-reset-token`,
      { method: "POST", headers: { "x-kiss-pm-action": "same-origin" } }
    );
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({ error: "session_required" });

    const withoutPersistence = createFixture({ withCreateToken: false });
    const notConfigured = await issueRequest(withoutPersistence.app);
    expect(notConfigured.status).toBe(501);
    await expect(notConfigured.json()).resolves.toEqual({
      error: "persistence_not_configured"
    });
  });
});
