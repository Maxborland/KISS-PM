import { describe, expect, it } from "vitest";
import type { Permission } from "@kiss-pm/access-control";
import { createApp } from "./app";
import type {
  AccessProfileRecord,
  ApiTenantDataSource,
  PasswordResetTokenRecord,
  UserCredentialRecord,
  WorkspaceUserRecord
} from "./apiTypes";

/* ============================================================
   Регрессия PATCH /api/workspace/users/:userId:

   D2 — оффбординг отзывает токены сброса пароля как КОНТРОЛЬ безопасности:
        отсутствие порта deletePasswordResetTokensByUserId обязано быть
        громким отказом (501/500), а не 200 с живым токеном уволенного.
   D3 — правила занятости email одни и те же на обоих путях записи
        (инвайт и обновление): регистронезависимо внутри тенанта +
        ГЛОБАЛЬНО по credential (user_credentials_email_uidx уникален
        по всем тенантам).
   ============================================================ */

const TENANT = "tenant-alpha";
const OTHER_TENANT = "tenant-beta";
const ADMIN_ID = "user-alpha-admin";
const TARGET_ID = "user-alpha-target";
const PROFILE = "profile-admin";
const sessionCookie = "kiss_pm_session=" + "a".repeat(64);
const mutationHeaders = {
  cookie: sessionCookie,
  "content-type": "application/json",
  "x-kiss-pm-action": "same-origin"
};

function workspaceUser(
  id: string,
  name: string,
  overrides: Partial<WorkspaceUserRecord> = {}
): WorkspaceUserRecord {
  return {
    id,
    tenantId: TENANT,
    email: `${id}@kiss-pm.local`,
    name,
    accessProfileId: PROFILE,
    positionId: null,
    positionName: null,
    phone: null,
    telegram: null,
    status: "active",
    theme: "light",
    accentColor: "#0f766e",
    ...overrides
  };
}

function createFixture(
  options: {
    permissions?: Permission[];
    /** Убирает порт отзыва токенов из источника (неполная инсталляция). */
    withRevokeResetTokens?: boolean;
    /** Порт есть снаружи, но пропадает внутри транзакции — проверка tx-гарда. */
    dropRevokeInsideTransaction?: boolean;
    /** Дополнительные пользователи тенанта (для коллизий email). */
    extraUsers?: WorkspaceUserRecord[];
    /** Чужие credential — эмуляция ГЛОБАЛЬНОГО уникального индекса. */
    foreignCredentials?: UserCredentialRecord[];
  } = {}
) {
  const permissions: Permission[] = options.permissions ?? ["tenant.users.manage"];
  const users = new Map<string, WorkspaceUserRecord>([
    [ADMIN_ID, workspaceUser(ADMIN_ID, "Анна Админ")],
    [TARGET_ID, workspaceUser(TARGET_ID, "Тарас Цель")],
    ...(options.extraUsers ?? []).map(
      (user) => [user.id, user] as [string, WorkspaceUserRecord]
    )
  ]);
  const credentials = new Map<string, UserCredentialRecord>(
    (options.foreignCredentials ?? []).map((credential) => [
      credential.email.toLowerCase(),
      credential
    ])
  );
  for (const user of users.values()) {
    credentials.set(user.email.toLowerCase(), {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email.toLowerCase(),
      passwordHash: "hash",
      passwordSalt: "salt"
    } as UserCredentialRecord);
  }
  const accessProfiles = new Map<string, AccessProfileRecord>([
    [PROFILE, { id: PROFILE, tenantId: TENANT, name: "Владелец", permissions }]
  ]);
  const resetTokens = new Map<string, PasswordResetTokenRecord>([
    [
      "token-target",
      {
        id: "token-target",
        tenantId: TENANT,
        userId: TARGET_ID,
        tokenHash: "hash-target",
        requestedIp: null,
        consumedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2099-01-01T00:00:00.000Z")
      } as PasswordResetTokenRecord
    ]
  ]);
  const auditEvents: Array<{ actionType?: string }> = [];

  const revokeResetTokens = async (tenantId: string, userId: string) => {
    for (const [id, token] of resetTokens) {
      if (token.tenantId === tenantId && token.userId === userId) resetTokens.delete(id);
    }
  };

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
      return users.get(userId);
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
    async listPositions() {
      return [];
    },
    async findCredentialByEmail(email) {
      return credentials.get(email.toLowerCase());
    },
    async updateWorkspaceUser(input) {
      const record: WorkspaceUserRecord = { ...input, positionName: null };
      users.set(record.id, record);
      return record;
    },
    async updateCredentialEmail(tenantId, userId, email) {
      const next = email.toLowerCase();
      const existing = credentials.get(next);
      // Воспроизводим ГЛОБАЛЬНЫЙ user_credentials_email_uidx: тот же email под
      // другим userId — 23505. Именно этим «спасался» PATCH до фикса D3.
      if (existing && existing.userId !== userId) {
        throw Object.assign(new Error("duplicate key value violates unique constraint"), {
          code: "23505",
          constraint: "user_credentials_email_uidx"
        });
      }
      // Снимок до мутации: delete+set внутри for-of по Map переставляет ключ в
      // конец итерации и зацикливает обход.
      for (const [key, credential] of [...credentials]) {
        if (credential.tenantId === tenantId && credential.userId === userId) {
          credentials.delete(key);
          credentials.set(next, { ...credential, email: next });
        }
      }
    },
    async deleteSessionsByUserId() {},
    async appendAuditEvent(input) {
      auditEvents.push(input as { actionType?: string });
    },
    async withTransaction(operation) {
      if (options.dropRevokeInsideTransaction) {
        const { deletePasswordResetTokensByUserId: _dropped, ...withoutPort } = dataSource;
        return operation(withoutPort as ApiTenantDataSource);
      }
      return operation(dataSource as ApiTenantDataSource);
    }
  };
  if (options.withRevokeResetTokens !== false) {
    dataSource.deletePasswordResetTokensByUserId = revokeResetTokens;
  }

  const app = createApp({ dataSource: dataSource as ApiTenantDataSource });
  return { app, state: { users, credentials, resetTokens, auditEvents } };
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

describe("D2 — оффбординг не отзывает токены молча", () => {
  it("отвечает 501 и не деактивирует, когда источник не умеет отзывать токены сброса", async () => {
    const fixture = createFixture({ withRevokeResetTokens: false });

    const response = await patchUser(fixture.app, TARGET_ID, { status: "inactive" });

    // До фикса: 200 при живом токене уволенного — контроль безопасности
    // «пропускался» по truthiness-проверке порта.
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "persistence_not_configured" });
    expect(fixture.state.users.get(TARGET_ID)!.status).toBe("active");
    expect(fixture.state.resetTokens.has("token-target")).toBe(true);
  });

  it("падает громко, когда порт пропадает внутри транзакции", async () => {
    const fixture = createFixture({ dropRevokeInsideTransaction: true });

    const response = await patchUser(fixture.app, TARGET_ID, { status: "inactive" });

    // Транзакционный гард — как transactional_invitation_accept_not_configured
    // в authRegistrationRoutes: лучше 500 из общего обработчика, чем 200 с
    // невыполненным отзывом токенов.
    expect(response.status).toBe(500);
    expect(fixture.state.resetTokens.has("token-target")).toBe(true);
  });

  it("на полном источнике деактивация проходит и отзывает токены сброса", async () => {
    const fixture = createFixture();

    const response = await patchUser(fixture.app, TARGET_ID, { status: "inactive" });

    expect(response.status).toBe(200);
    expect(fixture.state.users.get(TARGET_ID)!.status).toBe("inactive");
    expect(fixture.state.resetTokens.has("token-target")).toBe(false);
  });

  it("не трогает токены, когда пользователь остаётся активным", async () => {
    const fixture = createFixture();

    const response = await patchUser(fixture.app, TARGET_ID, { name: "Тарас Обновлённый" });

    expect(response.status).toBe(200);
    expect(fixture.state.resetTokens.has("token-target")).toBe(true);
  });
});

describe("D3 — правила занятости email одинаковы на обоих путях записи", () => {
  it("409 при коллизии с адресом другого пользователя тенанта в ином регистре", async () => {
    const fixture = createFixture({
      extraUsers: [
        workspaceUser("user-alpha-legacy", "Лев Легаси", { email: "Shared@kiss-pm.local" })
      ]
    });

    const response = await patchUser(fixture.app, TARGET_ID, { email: "shared@kiss-pm.local" });

    // До фикса точное сравнение "shared@..." !== "Shared@..." пропускало
    // предпроверку, и 409 приходил лишь из generic-catch по 23505.
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "user_email_taken" });
    expect(fixture.state.users.get(TARGET_ID)!.email).toBe(`${TARGET_ID}@kiss-pm.local`);
  });

  it("409 при коллизии с credential ЧУЖОГО тенанта (глобальный уникальный индекс)", async () => {
    const fixture = createFixture({
      foreignCredentials: [
        {
          userId: "user-beta-owner",
          tenantId: OTHER_TENANT,
          email: "foreign@kiss-pm.local",
          passwordHash: "hash",
          passwordSalt: "salt"
        } as UserCredentialRecord
      ]
    });

    const response = await patchUser(fixture.app, TARGET_ID, { email: "foreign@kiss-pm.local" });

    // Проверка внутри тенанта такую коллизию не видит вовсе — нужна глобальная.
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "user_email_taken" });
    expect(fixture.state.users.get(TARGET_ID)!.email).toBe(`${TARGET_ID}@kiss-pm.local`);
  });

  it("собственный адрес пользователя занятым не считается", async () => {
    const fixture = createFixture();

    // Смена без изменения email и смена регистра своего же адреса — не 409.
    const unchanged = await patchUser(fixture.app, TARGET_ID, { name: "Тарас Тот Же" });
    expect(unchanged.status).toBe(200);

    const sameAddressOtherCase = await patchUser(fixture.app, TARGET_ID, {
      email: `${TARGET_ID}@KISS-PM.local`
    });
    expect(sameAddressOtherCase.status).toBe(200);
  });

  it("свободный адрес принимается и переносится в credential", async () => {
    const fixture = createFixture();

    const response = await patchUser(fixture.app, TARGET_ID, { email: "fresh@kiss-pm.local" });

    expect(response.status).toBe(200);
    expect(fixture.state.users.get(TARGET_ID)!.email).toBe("fresh@kiss-pm.local");
    expect(fixture.state.credentials.get("fresh@kiss-pm.local")?.userId).toBe(TARGET_ID);
  });
});
