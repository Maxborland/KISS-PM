import { describe, expect, it } from "vitest";
import { hashPassword, hashResetToken, verifyPassword } from "@kiss-pm/persistence";
import { createApp } from "./app";
import { createInMemoryEmailProvider } from "./emailProvider";
import type {
  ApiTenantDataSource,
  PasswordResetTokenRecord,
  UserCredentialRecord,
  UserSessionRecord
} from "./apiTypes";
import type { AccessProfileRecord, WorkspaceUserRecord } from "./apiTypes";

const sameOriginHeaders = {
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin"
};

// Минимальный stateful in-memory dataSource, покрывающий auth-методы регистрации/сброса.
// Воспроизводит харнесс app.test.ts (инъекция через createApp({ dataSource })),
// но держит реальное состояние (тенанты/юзеры/креды/сессии/токены сброса).
function createAuthFakeDataSource() {
  const tenants = new Map<string, { id: string; name: string }>();
  const accessProfiles = new Map<string, AccessProfileRecord>();
  const users = new Map<string, WorkspaceUserRecord>();
  const credentials = new Map<string, UserCredentialRecord>(); // ключ — email
  const sessions = new Map<string, UserSessionRecord>(); // ключ — tokenHash
  const resetTokens = new Map<string, PasswordResetTokenRecord>(); // ключ — id

  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() {
      return [];
    },
    async findUserById(userId) {
      return users.get(userId);
    },
    async findTenantById(tenantId) {
      return tenants.get(tenantId);
    },
    async findAccessProfileById(tenantId, accessProfileId) {
      const profile = accessProfiles.get(accessProfileId);
      return profile && profile.tenantId === tenantId ? profile : undefined;
    },
    async listUsersByTenantId(tenantId) {
      return [...users.values()].filter((user) => user.tenantId === tenantId);
    },
    async listWorkspaceUsers(tenantId) {
      return [...users.values()].filter((user) => user.tenantId === tenantId);
    },
    async createTenant(input) {
      tenants.set(input.id, { id: input.id, name: input.name });
    },
    async createAccessProfile(input) {
      accessProfiles.set(input.id, input);
      return input;
    },
    async createWorkspaceUser(input) {
      const record: WorkspaceUserRecord = { ...input, positionName: null };
      users.set(record.id, record);
      return record;
    },
    async findCredentialByEmail(email) {
      return credentials.get(email);
    },
    async upsertCredential(input) {
      credentials.set(input.email, { ...input });
    },
    async updateCredentialPassword(tenantId, userId, input) {
      for (const [email, credential] of credentials) {
        if (credential.tenantId === tenantId && credential.userId === userId) {
          credentials.set(email, { ...credential, ...input });
        }
      }
    },
    async createSession(input) {
      sessions.set(input.tokenHash, { ...input });
    },
    async findSessionByTokenHash(tokenHash) {
      return sessions.get(tokenHash);
    },
    async deleteSessionByTokenHash(tokenHash) {
      sessions.delete(tokenHash);
    },
    async deleteSessionsByUserId(tenantId, userId) {
      for (const [tokenHash, session] of sessions) {
        if (session.tenantId === tenantId && session.userId === userId) {
          sessions.delete(tokenHash);
        }
      }
    },
    async createPasswordResetToken(input) {
      resetTokens.set(input.id, { ...input });
    },
    async findPasswordResetTokenByHash(tokenHash) {
      return [...resetTokens.values()].find((token) => token.tokenHash === tokenHash);
    },
    async markPasswordResetTokenConsumed(tenantId, id, consumedAt) {
      // Атомарное single-use: консьюмим только непогашенный токен; возвращаем число затронутых строк.
      const token = resetTokens.get(id);
      if (token && token.tenantId === tenantId && token.consumedAt === null) {
        resetTokens.set(id, { ...token, consumedAt });
        return 1;
      }
      return 0;
    },
    async deletePasswordResetTokensByUserId(tenantId, userId) {
      for (const [id, token] of resetTokens) {
        if (token.tenantId === tenantId && token.userId === userId) {
          resetTokens.delete(id);
        }
      }
    },
    async appendAuditEvent() {
      return;
    },
    async withTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    }
  };

  return {
    dataSource: dataSource as ApiTenantDataSource,
    state: { tenants, accessProfiles, users, credentials, sessions, resetTokens }
  };
}

describe("POST /api/auth/register", () => {
  it("создаёт тенант, владельца, кред и сессию (201 + Set-Cookie)", async () => {
    const { dataSource, state } = createAuthFakeDataSource();
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({
        email: "owner@example.com",
        password: "supersecret",
        name: "Иван Владелец"
      })
    });

    expect(response.status).toBe(201);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("kiss_pm_session=");
    expect(setCookie).toContain("HttpOnly");
    const payload = await response.json();
    expect(payload.user.name).toBe("Иван Владелец");
    expect(payload.workspace.id).toBe(payload.user.tenantId);

    expect(state.tenants.size).toBe(1);
    expect(state.users.size).toBe(1);
    expect(state.credentials.has("owner@example.com")).toBe(true);
    expect(state.sessions.size).toBe(1);
    // У владельца полный admin-набор прав.
    const profile = [...state.accessProfiles.values()][0];
    expect(profile?.name).toBe("Владелец");
    expect(profile?.permissions).toContain("tenant.users.manage");
  });

  it("возвращает 409 email_taken для занятого email", async () => {
    const { dataSource, state } = createAuthFakeDataSource();
    state.credentials.set("owner@example.com", {
      userId: "user-existing",
      tenantId: "tenant-existing",
      email: "owner@example.com",
      ...hashPassword("supersecret")
    });
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({
        email: "owner@example.com",
        password: "supersecret",
        name: "Иван Владелец"
      })
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "email_taken" });
    expect(state.tenants.size).toBe(0);
  });

  it("возвращает 400 weak_password для слабого пароля", async () => {
    const { dataSource } = createAuthFakeDataSource();
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({
        email: "owner@example.com",
        password: "short",
        name: "Иван Владелец"
      })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "weak_password" });
  });

  it("возвращает 400 invalid_registration_payload для битого тела", async () => {
    const { dataSource } = createAuthFakeDataSource();
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({ email: "not-an-email", password: "supersecret", name: "X" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_registration_payload"
    });
  });

  it("возвращает 403 без заголовка same-origin", async () => {
    const { dataSource } = createAuthFakeDataSource();
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "supersecret",
        name: "Иван Владелец"
      })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "same_origin_action_required"
    });
  });
});

describe("POST /api/auth/password-reset/request", () => {
  it("всегда возвращает 202 и шлёт rawToken для существующего email", async () => {
    const { dataSource, state } = createAuthFakeDataSource();
    state.credentials.set("owner@example.com", {
      userId: "user-1",
      tenantId: "tenant-1",
      email: "owner@example.com",
      ...hashPassword("supersecret")
    });
    const emailProvider = createInMemoryEmailProvider();
    const app = createApp({ dataSource, emailProvider });

    const response = await app.request("/api/auth/password-reset/request", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({ email: "owner@example.com" })
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: "ok", delivery: "none" });
    expect(state.resetTokens.size).toBe(1);
    expect(emailProvider.lastPasswordReset?.email).toBe("owner@example.com");
    expect(emailProvider.lastPasswordReset?.rawToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it("возвращает 202 без создания токена для несуществующего email", async () => {
    const { dataSource, state } = createAuthFakeDataSource();
    const emailProvider = createInMemoryEmailProvider();
    const app = createApp({ dataSource, emailProvider });

    const response = await app.request("/api/auth/password-reset/request", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({ email: "missing@example.com" })
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: "ok", delivery: "none" });
    expect(state.resetTokens.size).toBe(0);
    expect(emailProvider.lastPasswordReset).toBeNull();
  });

  it("возвращает 400 invalid_email для битого email", async () => {
    const { dataSource } = createAuthFakeDataSource();
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/password-reset/request", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({ email: "not-an-email" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_email" });
  });
});

describe("POST /api/auth/password-reset/confirm", () => {
  function seedResetToken(
    state: ReturnType<typeof createAuthFakeDataSource>["state"],
    overrides: Partial<PasswordResetTokenRecord> = {}
  ) {
    const rawToken = "a".repeat(64);
    state.credentials.set("owner@example.com", {
      userId: "user-1",
      tenantId: "tenant-1",
      email: "owner@example.com",
      ...hashPassword("oldpassword")
    });
    state.sessions.set("sha256:session-1", {
      id: "session-1",
      tenantId: "tenant-1",
      userId: "user-1",
      tokenHash: "sha256:session-1",
      expiresAt: new Date(Date.now() + 60_000)
    });
    state.resetTokens.set("token-1", {
      id: "token-1",
      tenantId: "tenant-1",
      userId: "user-1",
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      requestedIp: null,
      createdAt: new Date(),
      ...overrides
    });
    return rawToken;
  }

  it("меняет пароль, гасит сессии и помечает токен использованным (200)", async () => {
    const { dataSource, state } = createAuthFakeDataSource();
    const rawToken = seedResetToken(state);
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({ token: rawToken, password: "brandnewpass" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    const credential = state.credentials.get("owner@example.com");
    expect(credential).toBeDefined();
    expect(
      verifyPassword({
        password: "brandnewpass",
        passwordHash: credential!.passwordHash,
        passwordSalt: credential!.passwordSalt
      })
    ).toBe(true);
    expect(state.sessions.size).toBe(0);
    // Токены сброса пользователя удалены (инвалидация прочих).
    expect(state.resetTokens.size).toBe(0);
  });

  it("возвращает 400 invalid_reset_token для неизвестного токена", async () => {
    const { dataSource } = createAuthFakeDataSource();
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({ token: "b".repeat(64), password: "brandnewpass" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_reset_token" });
  });

  it("возвращает 400 token_expired для истёкшего токена", async () => {
    const { dataSource, state } = createAuthFakeDataSource();
    const rawToken = seedResetToken(state, {
      expiresAt: new Date(Date.now() - 1000)
    });
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({ token: rawToken, password: "brandnewpass" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "token_expired" });
  });

  it("возвращает 400 reset_token_used для уже использованного токена", async () => {
    const { dataSource, state } = createAuthFakeDataSource();
    const rawToken = seedResetToken(state, { consumedAt: new Date() });
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({ token: rawToken, password: "brandnewpass" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "reset_token_used" });
  });

  it("возвращает 400 weak_password при слабом новом пароле", async () => {
    const { dataSource, state } = createAuthFakeDataSource();
    const rawToken = seedResetToken(state);
    const app = createApp({ dataSource });

    const response = await app.request("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: sameOriginHeaders,
      body: JSON.stringify({ token: rawToken, password: "short" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "weak_password" });
  });
});
