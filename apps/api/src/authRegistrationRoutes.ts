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
import type { PasswordResetTokenRecord } from "./apiTypes";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import type { TenantId, TenantUser, UserId } from "@kiss-pm/domain";

// Срок жизни токена сброса пароля: 60 минут от момента запроса.
export const passwordResetTtlMs = 60 * 60 * 1000;

// ЕДИНСТВЕННЫЙ механизм генерации reset-токена: raw = 32 случайных байта hex,
// персистится только hashResetToken(raw), TTL = passwordResetTtlMs. Его
// переиспользуют и публичный /api/auth/password-reset/request (email-доставка),
// и админская выдача токена (workspaceUserRoutes) — криптография и формат
// записи не дублируются. rawToken существует в открытом виде только в
// возвращаемом значении вызывающей стороны.
export async function issuePasswordResetToken(
  createPasswordResetToken: (input: PasswordResetTokenRecord) => Promise<void>,
  input: { tenantId: TenantId; userId: UserId; requestedIp: string | null }
): Promise<{ tokenId: string; rawToken: string; expiresAt: Date }> {
  const now = new Date();
  const rawToken = randomBytes(32).toString("hex");
  const tokenId = `password-reset-${randomUUID()}`;
  const expiresAt = new Date(now.getTime() + passwordResetTtlMs);
  await createPasswordResetToken({
    id: tokenId,
    tenantId: input.tenantId,
    userId: input.userId,
    tokenHash: hashResetToken(rawToken),
    expiresAt,
    consumedAt: null,
    requestedIp: input.requestedIp,
    createdAt: now
  });
  return { tokenId, rawToken, expiresAt };
}

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
      !dataSource.createPosition ||
      !dataSource.createAccessProfile ||
      !dataSource.createWorkspaceUser ||
      !dataSource.createProjectType ||
      !dataSource.createPipeline ||
      !dataSource.createDealStage ||
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
    const { email, password, name, workspaceName } = parsed.value;

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
      const tenantName = workspaceName ?? deriveTenantName(name, email);
      const rawSessionToken = randomBytes(32).toString("hex");
      const positionId = tenantId + "-position-generalist";

      const createdUser = await dataSource.withTransaction(async (tx) => {
        if (
          !tx.createTenant ||
          !tx.createPosition ||
          !tx.createAccessProfile ||
          !tx.createWorkspaceUser ||
          !tx.createProjectType ||
          !tx.createPipeline ||
          !tx.createDealStage ||
          !tx.upsertCredential ||
          !tx.createSession
        ) {
          throw new Error("transactional_registration_not_configured");
        }

        await tx.createTenant({ id: tenantId, name: tenantName });
        await tx.createPosition({
          id: positionId,
          tenantId,
          name: "Специалист",
          description: "Базовая роль для ресурсного спроса"
        });
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
          positionId
        });
        await tx.upsertCredential({
          userId,
          tenantId,
          email,
          ...hashPassword(password)
        });
        // Базовый набор системных статусов задач (как в dev-seed): без них
        // resolveCreateTaskStatus не найдёт статус категории "new" и первая
        // задача владельца упадёт 400 task_status_not_found. Сидируем только при
        // наличии tx.createTaskStatus (опциональная возможность data-source).
        if (tx.createTaskStatus) {
          for (const status of defaultTaskStatuses(tenantId)) {
            await tx.createTaskStatus(status);
          }
        }
        await tx.createProjectType({
          id: "project-type-default",
          tenantId,
          name: "Базовый проект",
          description: "Тип проекта по умолчанию для первого цикла продаж",
          status: "active"
        });
        const pipelineId = `${tenantId}-pipeline-default`;
        await tx.createPipeline({
          id: pipelineId,
          tenantId,
          name: "Основная воронка",
          description: null,
          isDefault: true,
          sortOrder: 1,
          status: "active"
        });
        for (const [index, stageName] of ["Новая", "Переговоры", "Договор"].entries()) {
          await tx.createDealStage({
            id: `${pipelineId}-stage-${index + 1}`,
            tenantId,
            pipelineId,
            name: stageName,
            sortOrder: index + 1,
            status: "active"
          });
        }
        // createPipeline записал пустой lifecycleGraphMetadata (initialStageId: null,
        // stages: []) — после сида стадий пересобираем граф тем же путём, что и
        // штатный роут создания стадии, иначе переходы по воронке не работают.
        await tx.refreshCrmPipelineLifecycleGraph?.(tenantId, pipelineId);
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
            commandInput: { email, name, workspaceName: tenantName, password: "***" },
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
      // reset-специфичный email-bucket: иначе recordFailure от reset-спама копится в ТОТ ЖЕ
      // email-bucket, что и /api/auth/login, и легитимный юзер ловит too_many_login_attempts
      // без единой попытки пароля. IP/global-лимиты остаются общими (через ip ниже).
      email: `reset:${email}`,
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
        const { rawToken } = await issuePasswordResetToken(
          dataSource.createPasswordResetToken,
          {
            tenantId: credential.tenantId,
            userId: credential.userId,
            requestedIp: rateLimitInput.ip ?? null
          }
        );
        await emailProvider.sendPasswordReset({
          email,
          rawToken,
          resetUrl: buildResetUrl(context, rawToken)
        });
      }
      // Каждый reset-request считаем попыткой (recordFailure), а НЕ успехом:
      // recordSuccess удаляет email-bucket, обнуляя накопление к maxFailures,
      // что позволило бы генерировать неограниченно токенов/писем для известного
      // адреса. recordFailure инкрементит bucket к блокировке; резерв освобождаем
      // через опцию reserved, сохраняя семантику reserveAttempt.
      await deps.authRateLimiter.recordFailure(rateLimitInput, {
        reserved: reservedAttempt
      });
      // delivery — свойство ИНСТАЛЛЯЦИИ (настроен ли канал почты), не аккаунта:
      // anti-enumeration не нарушается — ответ одинаков для любого email.
      // "none" (in-memory provider) → UI честно предупреждает, что письмо не придёт.
      const delivery =
        "provider" in emailProvider && emailProvider.provider === "smtp" ? "email" : "none";
      return context.json({ status: "ok", delivery }, 202);
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
      !dataSource.deleteOtherPasswordResetTokensByUserId ||
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

      // Погашение токена выполняем ВНУТРИ транзакции и первым шагом: атомарный
      // UPDATE ... WHERE consumed_at IS NULL возвращает число строк. pre-check выше
      // ловит обычный повтор, но две параллельные confirm-операции с одним валидным
      // токеном обе проходят pre-check; здесь побеждает ровно одна (1 строка),
      // вторая получает 0 и откатывается без смены пароля.
      const consumed = await dataSource.withTransaction(async (tx) => {
        if (
          !tx.updateCredentialPassword ||
          !tx.markPasswordResetTokenConsumed ||
          !tx.deleteOtherPasswordResetTokensByUserId ||
          !tx.deleteSessionsByUserId
        ) {
          throw new Error("transactional_password_reset_not_configured");
        }

        const affected = await tx.markPasswordResetTokenConsumed(
          record.tenantId,
          record.id,
          now
        );
        if (affected === 0) {
          // Токен уже погашен параллельным запросом — пароль не трогаем.
          return false;
        }

        await tx.updateCredentialPassword(
          record.tenantId,
          record.userId,
          hashPassword(password)
        );
        // Инвалидируем прочие токены сброса, сохраняя consumed-токен как evidence для стабильного reset_token_used.
        await tx.deleteOtherPasswordResetTokensByUserId(record.tenantId, record.userId, record.id);
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

        return true;
      });

      if (!consumed) {
        await deps.authRateLimiter.recordFailure(rateLimitInput, {
          reserved: reservedAttempt
        });
        return context.json({ error: "reset_token_used" }, 400);
      }

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

// Ссылка на форму подтверждения сброса на фронте. При web -> API rewrite URL запроса
// содержит внутренний origin API, поэтому используем browser Origin, уже проверенный
// same-origin middleware. Для server-to-server вызовов без Origin оставляем request origin.
function buildResetUrl(context: Context, rawToken: string): string {
  const originHeader = context.req.header("origin");
  const origin = originHeader
    ? new URL(originHeader).origin
    : new URL(context.req.url).origin;
  return `${origin}/password-reset/confirm?token=${encodeURIComponent(rawToken)}`;
}

// Системные статусы задач нового тенанта — повторяют дефолты dev-seed
// (createDefaultTaskStatuses). Обязателен хотя бы статус категории "new", иначе
// getRequiredStatusByCategory вернёт undefined и create-task вернёт 400.
function defaultTaskStatuses(tenantId: string) {
  // PK task_statuses_pkey = (tenant_id, id), поэтому константные id безопасны
  // для каждого нового тенанта (коллизий между тенантами нет).
  return [
    { id: "task-status-new", tenantId, name: "Новая", category: "new" as const, sortOrder: 10, status: "active" as const, isSystem: true },
    { id: "task-status-waiting", tenantId, name: "Ожидает", category: "waiting" as const, sortOrder: 20, status: "active" as const, isSystem: false },
    { id: "task-status-in-progress", tenantId, name: "В работе", category: "in_progress" as const, sortOrder: 30, status: "active" as const, isSystem: false },
    { id: "task-status-review", tenantId, name: "На контроле", category: "review" as const, sortOrder: 40, status: "active" as const, isSystem: false },
    { id: "task-status-done", tenantId, name: "Выполнено", category: "done" as const, sortOrder: 50, status: "active" as const, isSystem: true }
  ];
}
