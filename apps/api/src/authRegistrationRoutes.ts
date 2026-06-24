import {
  parseRegistrationInput,
  parseResetConfirmInput,
  parseResetRequestInput
} from "@kiss-pm/domain";
import { hashPassword, hashResetToken, hashSessionToken } from "@kiss-pm/persistence";
import { createTenantAdminSeedProfile } from "@kiss-pm/persistence";
import { randomBytes, randomUUID } from "node:crypto";
import type { Context } from "hono";
import { getClientIp } from "./authRateLimit";
import { buildSessionCookieHeader, sessionTtlMs } from "./authSession";
import { readLimitedJsonBody } from "./jsonBody";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import type { TenantUser } from "@kiss-pm/domain";

// Срок жизни токена сброса пароля: 60 минут от момента запроса.
const passwordResetTtlMs = 60 * 60 * 1000;

// Гонка регистрации одного email (TOCTOU): pre-check прошёл, но глобальный uniqueIndex
// user_credentials_email_uidx отверг параллельную вставку. Распознаём нарушение уникальности
// (Postgres 23505), чтобы вернуть чистый 409 email_taken вместо 500 (house-паттерн, как
// isActiveSessionConflictError). Обходим error.cause на случай обёрток драйвера.
function isCredentialEmailConflict(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 8; depth += 1) {
    const rec = current as { code?: unknown; constraint?: unknown; constraint_name?: unknown; message?: unknown; cause?: unknown };
    if (rec.code === "23505") {
      const marker = String(rec.constraint ?? rec.constraint_name ?? rec.message ?? "");
      if (marker.includes("user_credentials_email_uidx")) return true;
    }
    current = rec.cause;
  }
  return false;
}

// Регистрирует ручки самостоятельной регистрации нового тенанта и сброса пароля.
// Все три — обычные мутации: требуют заголовок x-kiss-pm-action:same-origin
// (в исключения requiresSameOriginActionHeader НЕ добавляются).
export function registerAuthRegistrationRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    emailProvider,
    secureCookies,
    trustForwardedAuthHeaders
  } = deps;

  // POST /api/auth/register — создание НОВОГО тенанта + владельца + авто-логин.
  app.post("/api/auth/register", async (context) => {
    if (
      !dataSource.findCredentialByEmail ||
      !dataSource.createTenant ||
      !dataSource.createAccessProfile ||
      !dataSource.createWorkspaceUser ||
      !dataSource.upsertCredential ||
      !dataSource.createSession ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "auth_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseRegistrationInput(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const { email, password, name } = parsed.value;

    const rateLimitInput = {
      email,
      ip: getClientIp(context.req.raw.headers, {
        trustForwardedHeaders: trustForwardedAuthHeaders
      })
    };
    const reservedAttempt = Boolean(deps.authRateLimiter.reserveAttempt);
    const rateLimitDecision = deps.authRateLimiter.reserveAttempt
      ? await deps.authRateLimiter.reserveAttempt(rateLimitInput)
      : await deps.authRateLimiter.check(rateLimitInput);
    if (!rateLimitDecision.allowed) {
      context.header("Retry-After", String(rateLimitDecision.retryAfterSeconds));
      return context.json({ error: "too_many_requests" }, 429);
    }

    try {
      // Глобальная проверка занятости email (по всем тенантам).
      const existingCredential = await dataSource.findCredentialByEmail(email);
      if (existingCredential) {
        await deps.authRateLimiter.recordFailure(rateLimitInput, {
          reserved: reservedAttempt
        });
        return context.json({ error: "email_taken" }, 409);
      }

      const tenantId = `tenant-${randomUUID()}`;
      const accessProfileId = `access-profile-${randomUUID()}`;
      const userId = `user-${randomUUID()}`;
      const tenantName = deriveTenantName(name, email);
      const rawSessionToken = randomBytes(32).toString("hex");

      const createdUser = await dataSource.withTransaction(async (tx) => {
        if (
          !tx.createTenant ||
          !tx.createAccessProfile ||
          !tx.createWorkspaceUser ||
          !tx.upsertCredential ||
          !tx.createSession
        ) {
          throw new Error("transactional_registration_not_configured");
        }

        await tx.createTenant({ id: tenantId, name: tenantName });
        // Роль владельца с полным admin-набором прав (переиспользуем seed-хелпер).
        await tx.createAccessProfile(
          createTenantAdminSeedProfile({
            id: accessProfileId,
            tenantId,
            name: "Владелец"
          })
        );
        const user = await tx.createWorkspaceUser({
          id: userId,
          tenantId,
          accessProfileId,
          email,
          name,
          status: "active",
          theme: "light",
          accentColor: "#0f766e",
          phone: null,
          telegram: null,
          positionId: null
        });
        await tx.upsertCredential({
          userId,
          tenantId,
          email,
          ...hashPassword(password)
        });
        // Авто-логин: выдаём сессию так же, как в /api/auth/login.
        await tx.createSession({
          id: `session-${randomUUID()}`,
          tenantId,
          userId,
          tokenHash: hashSessionToken(rawSessionToken),
          expiresAt: new Date(Date.now() + sessionTtlMs)
        });

        await appendManagementAuditEvent(
          {
            tenantId,
            actorUserId: userId,
            actionType: "auth.registered",
            sourceWorkflow: "auth_self_registration",
            sourceEntity: { type: "Tenant", id: tenantId },
            commandInput: { email, name, password: "***" },
            beforeState: null,
            afterState: { tenantId, userId, accessProfileId },
            permissionResult: { allowed: true }
          },
          tx
        );

        return user;
      });

      await deps.authRateLimiter.recordSuccess(rateLimitInput, {
        reserved: reservedAttempt
      });

      context.header(
        "Set-Cookie",
        buildSessionCookieHeader(rawSessionToken, { secure: secureCookies })
      );

      return context.json(
        {
          user: toPublicUser(createdUser),
          workspace: { id: tenantId }
        },
        201
      );
    } catch (error) {
      // Гонка по email (параллельная регистрация одного адреса): отдаём 409 email_taken, как на
      // не-гоночном пути (recordFailure расходует резерв). Транзакция уже откатилась — частичного тенанта нет.
      if (isCredentialEmailConflict(error)) {
        await deps.authRateLimiter.recordFailure(rateLimitInput, { reserved: reservedAttempt });
        return context.json({ error: "email_taken" }, 409);
      }
      if (reservedAttempt) {
        await deps.authRateLimiter.releaseReservedAttempt?.(rateLimitInput);
      }
      throw error;
    }
  });

  // POST /api/auth/password-reset/request — выдача токена сброса (anti-enumeration).
  app.post("/api/auth/password-reset/request", async (context) => {
    if (
      !dataSource.findCredentialByEmail ||
      !dataSource.createPasswordResetToken
    ) {
      return context.json({ error: "auth_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseResetRequestInput(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const { email } = parsed.value;

    const rateLimitInput = {
      email,
      ip: getClientIp(context.req.raw.headers, {
        trustForwardedHeaders: trustForwardedAuthHeaders
      })
    };
    const reservedAttempt = Boolean(deps.authRateLimiter.reserveAttempt);
    const rateLimitDecision = deps.authRateLimiter.reserveAttempt
      ? await deps.authRateLimiter.reserveAttempt(rateLimitInput)
      : await deps.authRateLimiter.check(rateLimitInput);
    if (!rateLimitDecision.allowed) {
      context.header("Retry-After", String(rateLimitDecision.retryAfterSeconds));
      return context.json({ error: "too_many_requests" }, 429);
    }

    try {
      const credential = await dataSource.findCredentialByEmail(email);
      // Токен создаём и письмо шлём только если email существует. Ответ всегда 202 —
      // не раскрываем наличие/отсутствие аккаунта (anti-enumeration).
      if (credential) {
        const now = new Date();
        const rawToken = randomBytes(32).toString("hex");
        await dataSource.createPasswordResetToken({
          id: `password-reset-${randomUUID()}`,
          tenantId: credential.tenantId,
          userId: credential.userId,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(now.getTime() + passwordResetTtlMs),
          consumedAt: null,
          requestedIp: rateLimitInput.ip ?? null,
          createdAt: now
        });
        await emailProvider.sendPasswordReset({
          email,
          rawToken,
          resetUrl: buildResetUrl(context, rawToken)
        });
      }
      await deps.authRateLimiter.recordSuccess(rateLimitInput, {
        reserved: reservedAttempt
      });
      return context.json({ status: "ok" }, 202);
    } catch (error) {
      if (reservedAttempt) {
        await deps.authRateLimiter.releaseReservedAttempt?.(rateLimitInput);
      }
      throw error;
    }
  });

  // POST /api/auth/password-reset/confirm — смена пароля по токену + разлогин всех сессий.
  app.post("/api/auth/password-reset/confirm", async (context) => {
    if (
      !dataSource.findPasswordResetTokenByHash ||
      !dataSource.updateCredentialPassword ||
      !dataSource.markPasswordResetTokenConsumed ||
      !dataSource.deletePasswordResetTokensByUserId ||
      !dataSource.deleteSessionsByUserId ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "auth_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseResetConfirmInput(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const { token, password } = parsed.value;

    // Rate-limit по хэшу токена (email тут неизвестен заранее).
    const rateLimitInput = {
      email: `reset-confirm:${hashResetToken(token)}`,
      ip: getClientIp(context.req.raw.headers, {
        trustForwardedHeaders: trustForwardedAuthHeaders
      })
    };
    const reservedAttempt = Boolean(deps.authRateLimiter.reserveAttempt);
    const rateLimitDecision = deps.authRateLimiter.reserveAttempt
      ? await deps.authRateLimiter.reserveAttempt(rateLimitInput)
      : await deps.authRateLimiter.check(rateLimitInput);
    if (!rateLimitDecision.allowed) {
      context.header("Retry-After", String(rateLimitDecision.retryAfterSeconds));
      return context.json({ error: "too_many_requests" }, 429);
    }

    try {
      const record = await dataSource.findPasswordResetTokenByHash(
        hashResetToken(token)
      );
      const now = new Date();
      if (!record) {
        await deps.authRateLimiter.recordFailure(rateLimitInput, {
          reserved: reservedAttempt
        });
        return context.json({ error: "invalid_reset_token" }, 400);
      }
      if (record.consumedAt !== null) {
        await deps.authRateLimiter.recordFailure(rateLimitInput, {
          reserved: reservedAttempt
        });
        return context.json({ error: "reset_token_used" }, 400);
      }
      if (record.expiresAt.getTime() <= now.getTime()) {
        await deps.authRateLimiter.recordFailure(rateLimitInput, {
          reserved: reservedAttempt
        });
        return context.json({ error: "token_expired" }, 400);
      }

      await dataSource.withTransaction(async (tx) => {
        if (
          !tx.updateCredentialPassword ||
          !tx.markPasswordResetTokenConsumed ||
          !tx.deletePasswordResetTokensByUserId ||
          !tx.deleteSessionsByUserId
        ) {
          throw new Error("transactional_password_reset_not_configured");
        }

        await tx.updateCredentialPassword(
          record.tenantId,
          record.userId,
          hashPassword(password)
        );
        await tx.markPasswordResetTokenConsumed(record.tenantId, record.id, now);
        // Инвалидируем прочие токены сброса и разлогиниваем все сессии пользователя.
        await tx.deletePasswordResetTokensByUserId(record.tenantId, record.userId);
        await tx.deleteSessionsByUserId(record.tenantId, record.userId);

        await appendManagementAuditEvent(
          {
            tenantId: record.tenantId,
            actorUserId: record.userId,
            actionType: "auth.password_reset",
            sourceWorkflow: "auth_password_reset",
            sourceEntity: { type: "UserCredential", id: record.userId },
            commandInput: { tokenId: record.id },
            beforeState: null,
            afterState: { userId: record.userId },
            permissionResult: { allowed: true }
          },
          tx
        );
      });

      await deps.authRateLimiter.recordSuccess(rateLimitInput, {
        reserved: reservedAttempt
      });

      return context.json({ status: "ok" });
    } catch (error) {
      if (reservedAttempt) {
        await deps.authRateLimiter.releaseReservedAttempt?.(rateLimitInput);
      }
      throw error;
    }
  });
}

// Публичная форма пользователя — как в /api/auth/login.
function toPublicUser(user: TenantUser) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    accessProfileId: user.accessProfileId
  };
}

// Имя нового тенанта: из имени владельца, иначе из доменной части email.
function deriveTenantName(ownerName: string, email: string): string {
  const trimmed = ownerName.trim();
  if (trimmed.length > 0) return trimmed;
  const domain = email.split("@")[1];
  return domain && domain.length > 0 ? domain : email;
}

// Ссылка на форму подтверждения сброса на фронте, относительно текущего origin запроса.
function buildResetUrl(context: Context, rawToken: string): string {
  const origin = new URL(context.req.url).origin;
  return `${origin}/auth/reset-password?token=${rawToken}`;
}
