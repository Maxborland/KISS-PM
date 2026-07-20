import { describe, expect, it, vi } from "vitest";
import type { Permission } from "@kiss-pm/access-control";
import { hashPassword, hashResetToken } from "@kiss-pm/persistence";
import { createApp } from "./app";
import { createInMemoryEmailProvider, type InvitationEmailInput, type SmtpEmailProvider } from "./emailProvider";
import type {
  AccessProfileRecord,
  ApiTenantDataSource,
  PasswordResetTokenRecord,
  PositionRecord,
  UserCredentialRecord,
  WorkspaceUserRecord
} from "./apiTypes";

/* ============================================================
   Инвайт-флоу (БЛОК 3): POST /api/workspace/invitations →
   POST /api/auth/invitation/accept → POST /api/auth/login.
   Stateful in-memory data-source: приглашённый юзер создаётся
   status:"inactive" без пароля, приём приглашения задаёт пароль
   и активирует, после чего вход проходит.
   ============================================================ */

const TENANT = "tenant-alpha";
const ADMIN_ID = "user-alpha-admin";
const ADMIN_PROFILE = "profile-admin";
const VIEWER_PROFILE = "profile-viewer";
const sessionCookie = "kiss_pm_session=" + "a".repeat(64);
const mutationHeaders = {
  cookie: sessionCookie,
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin"
};
const publicHeaders = {
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin"
};

function adminUser(): WorkspaceUserRecord {
  return {
    id: ADMIN_ID,
    tenantId: TENANT,
    email: "admin@kiss-pm.local",
    name: "Анна Админ",
    accessProfileId: ADMIN_PROFILE,
    positionId: null,
    positionName: null,
    phone: null,
    telegram: null,
    status: "active",
    theme: "light",
    accentColor: "#0f766e"
  };
}

function createFixture(
  options: {
    permissions?: Permission[];
    emailProvider?: ReturnType<typeof createInMemoryEmailProvider> | SmtpEmailProvider;
    domainAllowlist?: string[];
  } = {}
) {
  const permissions = options.permissions ?? ["tenant.users.manage"];
  const users = new Map<string, WorkspaceUserRecord>([[ADMIN_ID, adminUser()]]);
  const credentials = new Map<string, UserCredentialRecord>(); // ключ — email
  const resetTokens = new Map<string, PasswordResetTokenRecord>(); // ключ — id
  const accessProfiles = new Map<string, AccessProfileRecord>([
    [ADMIN_PROFILE, { id: ADMIN_PROFILE, tenantId: TENANT, name: "Владелец", permissions }],
    // Вторая роль нужна, чтобы проверить понижение прав админом до приёма приглашения.
    [VIEWER_PROFILE, { id: VIEWER_PROFILE, tenantId: TENANT, name: "Наблюдатель", permissions: ["tenant.users.read"] }]
  ]);
  const positions = new Map<string, PositionRecord>([
    ["position-engineer", { id: "position-engineer", tenantId: TENANT, name: "Инженер", description: null }]
  ]);
  const sessions = new Map<string, unknown>();
  const auditEvents: Array<{ actionType?: string; afterState?: unknown }> = [];

  const dataSource: Partial<ApiTenantDataSource> = {
    async findSessionByTokenHash() {
      // Любой предъявленный cookie резолвится в активного admin-актора.
      return {
        id: "session-admin",
        tenantId: TENANT,
        userId: ADMIN_ID,
        tokenHash: "ignored",
        expiresAt: new Date("2099-01-01T00:00:00.000Z")
      };
    },
    async findUserById(userId) {
      return users.get(userId);
    },
    async findTenantById(tenantId) {
      return tenantId === TENANT ? { id: TENANT, name: "Бюро Север" } : undefined;
    },
    async findAccessProfileById(tenantId, accessProfileId) {
      const profile = accessProfiles.get(accessProfileId);
      return profile && profile.tenantId === tenantId
        ? { id: profile.id, permissions: profile.permissions }
        : undefined;
    },
    async listWorkspaceUsers(tenantId) {
      return [...users.values()].filter((user) => user.tenantId === tenantId);
    },
    async listAccessProfilesByTenantId(tenantId) {
      return [...accessProfiles.values()].filter((profile) => profile.tenantId === tenantId);
    },
    async listPositions(tenantId) {
      return [...positions.values()].filter((position) => position.tenantId === tenantId);
    },
    async getTenantSecurityPolicy() {
      return {
        twoFactorRequired: false,
        sessionTimeoutHours: 24,
        ssoSamlEnabled: false,
        domainAllowlist: options.domainAllowlist ?? []
      };
    },
    async createWorkspaceUser(input) {
      const record: WorkspaceUserRecord = { ...input, positionName: null };
      users.set(record.id, record);
      return record;
    },
    async updateWorkspaceUser(input) {
      const record: WorkspaceUserRecord = { ...input, positionName: null };
      users.set(record.id, record);
      return record;
    },
    async findCredentialByEmail(email) {
      return credentials.get(email.toLowerCase());
    },
    async upsertCredential(input) {
      const email = input.email.toLowerCase();
      const existing = credentials.get(email);
      // Воспроизводим ГЛОБАЛЬНЫЙ uniqueIndex user_credentials_email_uidx: тот же
      // email под другим userId — нарушение уникальности (Postgres 23505).
      if (existing && existing.userId !== input.userId) {
        throw Object.assign(new Error("duplicate key value violates unique constraint"), {
          code: "23505",
          constraint: "user_credentials_email_uidx"
        });
      }
      credentials.set(email, { ...input, email });
    },
    async updateCredentialEmail(tenantId, userId, email) {
      for (const [key, credential] of credentials) {
        if (credential.tenantId === tenantId && credential.userId === userId) {
          credentials.delete(key);
          credentials.set(email.toLowerCase(), { ...credential, email: email.toLowerCase() });
        }
      }
    },
    async deleteSessionsByUserId() {},
    async deletePasswordResetTokensByUserId(tenantId, userId) {
      for (const [id, token] of resetTokens) {
        if (token.tenantId === tenantId && token.userId === userId) {
          resetTokens.delete(id);
        }
      }
    },
    async createSession(input) {
      sessions.set(input.tokenHash, { ...input });
    },
    async createPasswordResetToken(input) {
      resetTokens.set(input.id, { ...input });
    },
    async findPasswordResetTokenByHash(tokenHash) {
      return [...resetTokens.values()].find((token) => token.tokenHash === tokenHash);
    },
    async markPasswordResetTokenConsumed(tenantId, id, consumedAt) {
      const token = resetTokens.get(id);
      if (token && token.tenantId === tenantId && token.consumedAt === null) {
        resetTokens.set(id, { ...token, consumedAt });
        return 1;
      }
      return 0;
    },
    async deleteOtherPasswordResetTokensByUserId(tenantId, userId, preservedTokenId) {
      for (const [id, token] of resetTokens) {
        if (token.tenantId === tenantId && token.userId === userId && id !== preservedTokenId) {
          resetTokens.delete(id);
        }
      }
    },
    async appendAuditEvent(input) {
      auditEvents.push(input as { actionType?: string; afterState?: unknown });
    },
    async withTransaction(operation) {
      return operation(dataSource as ApiTenantDataSource);
    }
  };

  const app = createApp({
    dataSource: dataSource as ApiTenantDataSource,
    ...(options.emailProvider ? { emailProvider: options.emailProvider } : {})
  });
  return { app, state: { users, credentials, resetTokens, auditEvents } };
}

function invite(app: ReturnType<typeof createFixture>["app"], body: Record<string, unknown>) {
  return app.request("/api/workspace/invitations", {
    method: "POST",
    headers: mutationHeaders,
    body: JSON.stringify(body)
  });
}

function accept(app: ReturnType<typeof createFixture>["app"], body: Record<string, unknown>) {
  return app.request("/api/auth/invitation/accept", {
    method: "POST",
    headers: publicHeaders,
    body: JSON.stringify(body)
  });
}

function login(app: ReturnType<typeof createFixture>["app"], email: string, password: string) {
  return app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

function patchUser(
  app: ReturnType<typeof createFixture>["app"],
  userId: string,
  body: Record<string, unknown>
) {
  return app.request(`/api/workspace/users/${userId}`, {
    method: "PATCH",
    headers: mutationHeaders,
    body: JSON.stringify(body)
  });
}

function requestPasswordReset(app: ReturnType<typeof createFixture>["app"], email: string) {
  return app.request("/api/auth/password-reset/request", {
    method: "POST",
    headers: publicHeaders,
    body: JSON.stringify({ email })
  });
}

const invitee = { email: "new@kiss-pm.local", name: "Пётр Приглашённый", accessProfileId: ADMIN_PROFILE };

describe("POST /api/workspace/invitations", () => {
  it("создаёт inactive-пользователя без пароля и возвращает токен при delivery:none", async () => {
    const { app, state } = createFixture();

    const response = await invite(app, invitee);
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.delivery).toBe("none");
    expect(payload.invitationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.expiresAt).toEqual(expect.any(String));
    expect(payload.user.status).toBe("inactive");
    expect(payload.user.email).toBe("new@kiss-pm.local");

    // Пользователь создан без credential; токен персистится только как хэш.
    expect(state.credentials.has("new@kiss-pm.local")).toBe(false);
    const token = [...state.resetTokens.values()][0];
    expect(token?.tokenHash).toBe(hashResetToken(payload.invitationToken));
    expect(token?.userId).toBe(payload.user.id);
    // Аудит фиксирует факт приглашения без rawToken.
    const audit = state.auditEvents.find((event) => event.actionType === "workspace.user.invited");
    expect(audit).toBeDefined();
    expect(JSON.stringify(audit)).not.toContain(payload.invitationToken);
  });

  it("отправляет письмо и НЕ возвращает токен при delivery:email (smtp)", async () => {
    const sendInvitation = vi.fn(async (_input: InvitationEmailInput) => undefined);
    const emailProvider: SmtpEmailProvider = {
      provider: "smtp",
      sendPasswordReset: async () => undefined,
      sendNotificationDigest: async () => undefined,
      sendInvitation
    };
    const { app } = createFixture({ emailProvider });

    const response = await invite(app, invitee);
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.delivery).toBe("email");
    expect(payload.invitationToken).toBeUndefined();
    expect(sendInvitation).toHaveBeenCalledTimes(1);
    const sent = sendInvitation.mock.calls[0]![0];
    expect(sent.email).toBe("new@kiss-pm.local");
    expect(sent.acceptUrl).toContain("/invite/accept?token=");
    expect(sent.rawToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it("деградирует до delivery:none и возвращает токен, если SMTP падает после коммита", async () => {
    const sendInvitation = vi.fn(async (_input: InvitationEmailInput) => {
      throw new Error("smtp_unreachable");
    });
    const emailProvider: SmtpEmailProvider = {
      provider: "smtp",
      sendPasswordReset: async () => undefined,
      sendNotificationDigest: async () => undefined,
      sendInvitation
    };
    const { app, state } = createFixture({ emailProvider });

    const response = await invite(app, invitee);
    // Транзакция уже закоммичена — падение письма НЕ должно давать 500 и оставлять
    // сотрудника в лимбе; отдаём токен админу для ручной передачи.
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.delivery).toBe("none");
    expect(payload.deliveryFailed).toBe(true);
    expect(payload.invitationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(sendInvitation).toHaveBeenCalledTimes(1);
    // Пользователь и токен всё равно созданы — повтор инвайта упёрся бы в 409.
    expect([...state.users.values()].some((user) => user.email === "new@kiss-pm.local")).toBe(true);
    expect(
      [...state.resetTokens.values()].some(
        (token) => token.tokenHash === hashResetToken(payload.invitationToken)
      )
    ).toBe(true);
  });

  it("отдаёт invitation в in-memory provider (для демо/ручной передачи)", async () => {
    const emailProvider = createInMemoryEmailProvider();
    const { app } = createFixture({ emailProvider });
    await invite(app, invitee);
    expect(emailProvider.lastInvitation?.email).toBe("new@kiss-pm.local");
  });

  it("возвращает 409 user_email_taken для занятого email", async () => {
    const { app } = createFixture();
    await invite(app, invitee);
    const dup = await invite(app, invitee);
    expect(dup.status).toBe(409);
    await expect(dup.json()).resolves.toEqual({ error: "user_email_taken" });
  });

  it("возвращает 400 invalid_access_role для несуществующей роли", async () => {
    const { app } = createFixture();
    const response = await invite(app, { ...invitee, accessProfileId: "role-ghost" });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_access_role" });
  });

  it("возвращает 400 email_domain_not_allowed вне allowlist", async () => {
    const { app } = createFixture({ domainAllowlist: ["kiss-pm.dev"] });
    const response = await invite(app, invitee);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "email_domain_not_allowed" });
  });

  it("возвращает 403 без права tenant.users.manage", async () => {
    const { app } = createFixture({ permissions: ["tenant.users.read"] });
    const response = await invite(app, invitee);
    expect(response.status).toBe(403);
  });
});

describe("POST /api/auth/invitation/accept → login", () => {
  it("задаёт пароль, активирует пользователя и пускает его в систему", async () => {
    const { app, state } = createFixture();
    const inviteResponse = await invite(app, invitee);
    const { invitationToken, user } = await inviteResponse.json();

    // До приёма приглашения вход невозможен (нет пароля / inactive).
    const earlyLogin = await login(app, invitee.email, "supersecret1");
    expect(earlyLogin.status).toBe(401); // credential ещё нет → invalid_credentials

    const acceptResponse = await accept(app, { token: invitationToken, password: "supersecret1" });
    expect(acceptResponse.status).toBe(200);
    await expect(acceptResponse.json()).resolves.toEqual({ status: "ok" });

    expect(state.users.get(user.id)?.status).toBe("active");
    expect(state.credentials.has(invitee.email)).toBe(true);
    expect([...state.resetTokens.values()][0]?.consumedAt).not.toBeNull();

    const okLogin = await login(app, invitee.email, "supersecret1");
    expect(okLogin.status).toBe(200);
    expect(okLogin.headers.get("set-cookie")).toContain("kiss_pm_session=");
  });

  it("возвращает 403 user_inactive при входе приглашённого до приёма", async () => {
    const { app, state } = createFixture();
    const inviteResponse = await invite(app, invitee);
    const { user } = await inviteResponse.json();
    // Симулируем ручную выдачу пароля без активации — credential есть, но inactive.
    state.credentials.set(invitee.email, {
      userId: user.id,
      tenantId: TENANT,
      email: invitee.email,
      ...hashPassword("supersecret1")
    });
    const response = await login(app, invitee.email, "supersecret1");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "user_inactive" });
  });

  it("возвращает 400 invitation_token_used при повторном приёме", async () => {
    const { app } = createFixture();
    const { invitationToken } = await (await invite(app, invitee)).json();
    await accept(app, { token: invitationToken, password: "supersecret1" });
    const second = await accept(app, { token: invitationToken, password: "supersecret2" });
    expect(second.status).toBe(400);
    await expect(second.json()).resolves.toEqual({ error: "invitation_token_used" });
  });

  it("возвращает 400 invalid_invitation_token для неизвестного токена", async () => {
    const { app } = createFixture();
    const response = await accept(app, { token: "f".repeat(64), password: "supersecret1" });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_invitation_token" });
  });

  it("возвращает 400 invitation_token_expired для просроченного токена", async () => {
    const { app, state } = createFixture();
    await invite(app, invitee);
    const [id, token] = [...state.resetTokens.entries()][0]!;
    state.resetTokens.set(id, { ...token, expiresAt: new Date(Date.now() - 1000) });
    // rawToken неизвестен снаружи (хранится хэш) — подставляем известный хэш заново.
    const raw = "b".repeat(64);
    state.resetTokens.set(id, { ...token, tokenHash: hashResetToken(raw), expiresAt: new Date(Date.now() - 1000) });
    const response = await accept(app, { token: raw, password: "supersecret1" });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invitation_token_expired" });
  });

  it("возвращает 400 invitation_not_pending для уже активного пользователя", async () => {
    const { app, state } = createFixture();
    // Токен для активного admin — приём приглашения к нему неприменим.
    const raw = "c".repeat(64);
    state.resetTokens.set("token-admin", {
      id: "token-admin",
      tenantId: TENANT,
      userId: ADMIN_ID,
      tokenHash: hashResetToken(raw),
      expiresAt: new Date(Date.now() + 3_600_000),
      consumedAt: null,
      requestedIp: null,
      createdAt: new Date()
    });
    const response = await accept(app, { token: raw, password: "supersecret1" });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invitation_not_pending" });
  });

  it("возвращает 400 weak_password для короткого пароля", async () => {
    const { app } = createFixture();
    const { invitationToken } = await (await invite(app, invitee)).json();
    const response = await accept(app, { token: invitationToken, password: "short" });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "weak_password" });
  });
});

/* ============================================================
   Регрессии предпрод-ревью: F1 (обход оффбординга), F2 (откат
   правок админа), F3 (кросс-тенантный email ломает приглашение).
   ============================================================ */

describe("оффбординг: деактивация закрывает путь через invitation/accept (F1)", () => {
  it("деактивированный сотрудник НЕ возвращает себе доступ новым reset-токеном", async () => {
    const { app, state } = createFixture();

    // 1. Сотрудник приглашён и принял приглашение — у него есть пароль и status:"active".
    const { invitationToken, user } = await (await invite(app, invitee)).json();
    expect((await accept(app, { token: invitationToken, password: "supersecret1" })).status).toBe(200);
    expect(state.users.get(user.id)?.status).toBe("active");

    // 2. Админ проводит оффбординг: status → "inactive".
    expect((await patchUser(app, user.id, { status: "inactive" })).status).toBe(200);
    expect(state.users.get(user.id)?.status).toBe("inactive");

    // 3. Уволенный запрашивает сброс пароля. Ответ всегда 202 (anti-enumeration),
    //    но токен деактивированному пользователю выдаваться НЕ должен.
    expect((await requestPasswordReset(app, invitee.email)).status).toBe(202);
    expect([...state.resetTokens.values()].filter((token) => token.consumedAt === null)).toHaveLength(0);

    // 4. Даже если токен всё же существует (например, выдан админом до увольнения),
    //    приём приглашения им невозможен: у пользователя уже есть credential,
    //    то есть это НЕ ожидающее приглашение, а reset-токен.
    const raw = "d".repeat(64);
    state.resetTokens.set("token-offboarded", {
      id: "token-offboarded",
      tenantId: TENANT,
      userId: user.id,
      tokenHash: hashResetToken(raw),
      expiresAt: new Date(Date.now() + 3_600_000),
      consumedAt: null,
      requestedIp: null,
      createdAt: new Date()
    });
    const bypass = await accept(app, { token: raw, password: "attacker-pass-1" });
    expect(bypass.status).toBe(400);
    await expect(bypass.json()).resolves.toEqual({ error: "invitation_not_pending" });
    // Статус не восстановлен, пароль не переписан.
    expect(state.users.get(user.id)?.status).toBe("inactive");
    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: invitee.email, password: "attacker-pass-1" })
    });
    expect(login.status).toBe(401);
  });

  it("деактивация удаляет невыданные токены сброса (deletePasswordResetTokensByUserId)", async () => {
    const { app, state } = createFixture();
    const { invitationToken, user } = await (await invite(app, invitee)).json();
    await accept(app, { token: invitationToken, password: "supersecret1" });
    // Живой невостребованный токен на момент увольнения.
    state.resetTokens.set("token-live", {
      id: "token-live",
      tenantId: TENANT,
      userId: user.id,
      tokenHash: hashResetToken("e".repeat(64)),
      expiresAt: new Date(Date.now() + 3_600_000),
      consumedAt: null,
      requestedIp: null,
      createdAt: new Date()
    });

    await patchUser(app, user.id, { status: "inactive" });

    // Отзыв доступа обязан отзывать и токены восстановления.
    expect([...state.resetTokens.values()].some((token) => token.userId === user.id)).toBe(false);
  });

  it("password-reset/request не выдаёт токен неактивному пользователю, но отвечает 202", async () => {
    const { app, state } = createFixture();
    const { invitationToken, user } = await (await invite(app, invitee)).json();
    await accept(app, { token: invitationToken, password: "supersecret1" });
    await patchUser(app, user.id, { status: "inactive" });
    state.resetTokens.clear();

    const response = await requestPasswordReset(app, invitee.email);

    // Ответ неотличим от запроса на несуществующий адрес (anti-enumeration).
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: "ok", delivery: "none" });
    expect(state.resetTokens.size).toBe(0);
  });
});

describe("приём приглашения не откатывает правки админа (F2)", () => {
  it("сохраняет accessProfileId, изменённый админом после отправки приглашения", async () => {
    const { app, state } = createFixture();
    const { invitationToken, user } = await (await invite(app, invitee)).json();
    expect(state.users.get(user.id)?.accessProfileId).toBe(ADMIN_PROFILE);

    // Админ заметил ошибку и понизил роль ДО приёма приглашения.
    const patched = await patchUser(app, user.id, { accessProfileId: VIEWER_PROFILE });
    expect(patched.status).toBe(200);
    expect(state.users.get(user.id)?.accessProfileId).toBe(VIEWER_PROFILE);

    const acceptResponse = await accept(app, { token: invitationToken, password: "supersecret1" });
    expect(acceptResponse.status).toBe(200);

    // Приём приглашения владеет только status/credential — понижение прав держится.
    expect(state.users.get(user.id)?.accessProfileId).toBe(VIEWER_PROFILE);
    expect(state.users.get(user.id)?.status).toBe("active");
  });

  it("пишет credential на актуальный email, а не на устаревший снимок", async () => {
    const { app, state } = createFixture();
    const { invitationToken, user } = await (await invite(app, invitee)).json();

    // Админ исправил опечатку в email до приёма приглашения.
    const patched = await patchUser(app, user.id, { email: "fixed@kiss-pm.local" });
    expect(patched.status).toBe(200);

    expect((await accept(app, { token: invitationToken, password: "supersecret1" })).status).toBe(200);

    expect(state.credentials.has("fixed@kiss-pm.local")).toBe(true);
    expect(state.credentials.has(invitee.email)).toBe(false);
    // Вход идёт по актуальному адресу.
    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "fixed@kiss-pm.local", password: "supersecret1" })
    });
    expect(login.status).toBe(200);
  });
});

describe("кросс-тенантный email не ломает приглашение (F3)", () => {
  it("возвращает 409 на приглашение адреса, занятого в другом тенанте", async () => {
    const { app, state } = createFixture();
    // Тот же email уже зарегистрирован в ЧУЖОМ тенанте (глобальный uniqueIndex).
    state.credentials.set(invitee.email, {
      userId: "user-beta-owner",
      tenantId: "tenant-beta",
      email: invitee.email,
      ...hashPassword("foreign-secret-1")
    });

    const response = await invite(app, invitee);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "user_email_taken" });
    // Приглашённый пользователь-«призрак» не создан.
    expect([...state.users.values()].some((user) => user.email === invitee.email)).toBe(false);
  });

  it("сравнивает занятость email без учёта регистра", async () => {
    const { app, state } = createFixture();
    state.credentials.set(invitee.email, {
      userId: "user-beta-owner",
      tenantId: "tenant-beta",
      email: invitee.email,
      ...hashPassword("foreign-secret-1")
    });

    const response = await invite(app, { ...invitee, email: "NEW@kiss-pm.local" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "user_email_taken" });
  });

  it("отдаёт честный 409 вместо 500 и сохраняет токен, если email заняли после приглашения", async () => {
    const { app, state } = createFixture();
    const { invitationToken, user } = await (await invite(app, invitee)).json();

    // Гонка: адрес заняли в другом тенанте уже ПОСЛЕ выдачи приглашения.
    state.credentials.set(invitee.email, {
      userId: "user-beta-owner",
      tenantId: "tenant-beta",
      email: invitee.email,
      ...hashPassword("foreign-secret-1")
    });

    const response = await accept(app, { token: invitationToken, password: "supersecret1" });

    // Раньше здесь был неперехваченный 23505 → 500, и токен оставался непогашенным
    // навсегда (каждый повтор снова 500).
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "user_email_taken" });
    // Токен НЕ погашен — после исправления email админом приглашение ещё рабочее.
    const token = [...state.resetTokens.values()].find((item) => item.userId === user.id);
    expect(token?.consumedAt).toBeNull();
    expect(state.users.get(user.id)?.status).toBe("inactive");
  });
});
