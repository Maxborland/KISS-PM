import {
  canManageTenantUsers,
  canReadProjectPlan,
  canReadTenantUsers,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { Context } from "hono";
import type { TenantId, TenantUser, UserId } from "@kiss-pm/domain";
import { hashPassword } from "@kiss-pm/persistence";
import { getClientIp } from "./authRateLimit";
import { issuePasswordResetToken } from "./authRegistrationRoutes";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { readLimitedJsonBody } from "./jsonBody";
import { authorizeRoute } from "./routeAuth";
import { parseUserIdParam } from "./routeParamParsers";
import { workspaceUserUniqueConflict } from "./uniqueConstraintConflicts";
import type { ApiTenantDataSource, WorkspaceUserRecord } from "./apiTypes";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import {
  parseWorkspaceInvitationBody,
  parseWorkspaceUserBody,
  parseWorkspaceUserPatchBody
} from "./workspaceParsers";

export function canReadWorkspaceUserDirectory(
  input: Parameters<typeof canReadTenantUsers>[0]
): PolicyDecision {
  const direct = canReadTenantUsers(input);
  return direct.allowed ? direct : canReadProjectPlan(input);
}
export function workspaceUserDirectoryEntry(
  user: WorkspaceUserRecord,
  includePrivateFields: boolean,
  accessProfileName?: string
) {
  if (includePrivateFields) return accessProfileName ? { ...user, accessProfileName } : user;
  return {
    id: user.id,
    name: user.name,
    positionId: user.positionId,
    positionName: user.positionName
  };
}

export function workspaceUserDirectoryResponse(
  users: WorkspaceUserRecord[],
  includePrivateFields: boolean,
  accessProfiles: Array<{ id: string; name: string }> = []
) {
  return {
    privateFieldsIncluded: includePrivateFields,
    users: users.map((user) => workspaceUserDirectoryEntry(
      user,
      includePrivateFields,
      accessProfiles.find((profile) => profile.id === user.accessProfileId)?.name
    ))
  };
}

export function registerWorkspaceUserRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    emailProvider,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  } = deps;

  app.get("/api/workspace/users", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canReadWorkspaceUserDirectory,
      capabilities: ["listWorkspaceUsers", "listAccessProfilesByTenantId"],
      onDenied: ({ actor, decision }) =>
        appendWorkspaceUserDeniedAudit(deps, actor, {
          actionType: "workspace.user.read_denied",
          entityId: "users",
          commandInput: { resource: "users" },
          decision
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, profile, dataSource } = auth.value;
    const includePrivateFields = canReadTenantUsers({
      actor,
      profile,
      targetTenantId: actor.tenantId
    }).allowed;

    const [users, accessProfiles] = await Promise.all([
      dataSource.listWorkspaceUsers(actor.tenantId),
      dataSource.listAccessProfilesByTenantId(actor.tenantId)
    ]);
    return context.json(
      workspaceUserDirectoryResponse(
        users,
        includePrivateFields,
        accessProfiles
      )
    );
  });

  app.post("/api/workspace/users", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canManageTenantUsers,
      capabilities: [
        "createWorkspaceUser",
        "upsertCredential",
        "listWorkspaceUsers",
        "listAccessProfilesByTenantId",
        "listPositions",
        "withTransaction",
        "appendAuditEvent"
      ],
      onDenied: ({ actor, decision }) =>
        appendWorkspaceUserDeniedAudit(deps, actor, {
          actionType: "workspace.user.create_denied",
          entityId: "new",
          commandInput: { operation: "create_user" },
          decision
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseWorkspaceUserBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (!parsed.password || parsed.password.length < 8) {
      return context.json({ error: "invalid_user_password" }, 400);
    }
    const existingUsers = await dataSource.listWorkspaceUsers(actor.tenantId);
    if (existingUsers.some((user) => user.id === parsed.value.id)) {
      return context.json({ error: "user_id_taken" }, 409);
    }
    if (existingUsers.some((user) => user.email === parsed.value.email)) {
      return context.json({ error: "user_email_taken" }, 409);
    }
    if (!(await emailDomainAllowed(dataSource, actor.tenantId, parsed.value.email))) {
      return context.json({ error: "email_domain_not_allowed" }, 400);
    }
    if (
      !(await dataSource.listAccessProfilesByTenantId(actor.tenantId)).some(
        (profile) => profile.id === parsed.value.accessProfileId
      )
    ) {
      return context.json({ error: "invalid_access_role" }, 400);
    }
    if (parsed.value.positionId) {
      const positionExists = (await dataSource.listPositions(actor.tenantId)).some(
        (position) => position.id === parsed.value.positionId
      );
      if (!positionExists) {
        return context.json({ error: "invalid_position" }, 400);
      }
    }

    let user: TenantUser;
    try {
      user = await runDataSourceTransaction(async (transactionDataSource) => {
        if (
          !transactionDataSource.createWorkspaceUser ||
          !transactionDataSource.upsertCredential
        ) {
          throw new Error("transactional_user_create_not_configured");
        }

        const createdUser = await transactionDataSource.createWorkspaceUser(
          parsed.value
        );
        if (parsed.password) {
          await transactionDataSource.upsertCredential({
            userId: createdUser.id,
            tenantId: createdUser.tenantId,
            email: createdUser.email,
            ...hashPassword(parsed.password)
          });
        }

        await appendManagementAuditEvent(
          {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "workspace.user.created",
            sourceWorkflow: "single_workspace_users",
            sourceEntity: {
              type: "TenantUser",
              id: createdUser.id
            },
            commandInput: {
              ...parsed.value,
              password: parsed.password ? "***" : undefined
            },
            beforeState: null,
            afterState: createdUser,
            permissionResult: decision
          },
          transactionDataSource
        );

        return createdUser;
      });
    } catch (error) {
      const conflict = workspaceUserUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ user }, 201);
  });

  // POST /api/workspace/invitations — приглашение сотрудника по email БЕЗ пароля
  // (под canManageTenantUsers). Создаётся пользователь status:"inactive" (войти
  // не сможет: isWorkspaceUserActive → 403 user_inactive) + одноразовый invite-токен
  // ТЕМ ЖЕ механизмом, что и сброс пароля (issuePasswordResetToken: hashResetToken +
  // passwordResetTtlMs). Письмо-приглашение уходит через emailProvider со ссылкой на
  // /invite/accept. Пароль сотрудник задаёт сам на POST /api/auth/invitation/accept.
  // Честная деградация: если канал почты не настроен (delivery:"none", in-memory
  // provider) — rawToken возвращается в ответе для ручной передачи (как admin
  // reset-token). При delivery:"email" токен в ответе НЕ отдаётся.
  app.post("/api/workspace/invitations", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canManageTenantUsers,
      capabilities: [
        "createWorkspaceUser",
        "createPasswordResetToken",
        "findCredentialByEmail",
        "listWorkspaceUsers",
        "listAccessProfilesByTenantId",
        "listPositions",
        "withTransaction",
        "appendAuditEvent"
      ],
      onDenied: ({ actor, decision }) =>
        appendWorkspaceUserDeniedAudit(deps, actor, {
          actionType: "workspace.user.invite_denied",
          entityId: "new",
          commandInput: { operation: "invite_user" },
          decision
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseWorkspaceInvitationBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const existingUsers = await dataSource.listWorkspaceUsers(actor.tenantId);
    if (existingUsers.some((user) => user.id === parsed.value.id)) {
      return context.json({ error: "user_id_taken" }, 409);
    }
    // Занятость email — по общим правилам (см. workspaceEmailTaken): регистро-
    // независимо внутри тенанта + ГЛОБАЛЬНО по credential. Без глобальной части
    // инвайт на чужой адрес отвечал 201, а /api/auth/invitation/accept затем падал
    // 23505 → 500, и приглашение становилось нерабочим навсегда.
    // Порт здесь гарантирован capabilities маршрута ("findCredentialByEmail").
    if (
      await workspaceEmailTaken(dataSource.findCredentialByEmail, {
        email: parsed.value.email,
        existingUsers
      })
    ) {
      return context.json({ error: "user_email_taken" }, 409);
    }
    if (!(await emailDomainAllowed(dataSource, actor.tenantId, parsed.value.email))) {
      return context.json({ error: "email_domain_not_allowed" }, 400);
    }
    if (
      !(await dataSource.listAccessProfilesByTenantId(actor.tenantId)).some(
        (profile) => profile.id === parsed.value.accessProfileId
      )
    ) {
      return context.json({ error: "invalid_access_role" }, 400);
    }
    if (parsed.value.positionId) {
      const positionExists = (await dataSource.listPositions(actor.tenantId)).some(
        (position) => position.id === parsed.value.positionId
      );
      if (!positionExists) {
        return context.json({ error: "invalid_position" }, 400);
      }
    }

    let outcome: { user: WorkspaceUserRecord; rawToken: string; expiresAt: Date };
    try {
      outcome = await runDataSourceTransaction(async (transactionDataSource) => {
        if (
          !transactionDataSource.createWorkspaceUser ||
          !transactionDataSource.createPasswordResetToken
        ) {
          throw new Error("transactional_user_invite_not_configured");
        }

        const createdUser = await transactionDataSource.createWorkspaceUser(parsed.value);
        const token = await issuePasswordResetToken(
          transactionDataSource.createPasswordResetToken,
          {
            tenantId: actor.tenantId,
            userId: createdUser.id,
            requestedIp: getClientIp(context.req.raw.headers, {
              trustForwardedHeaders: deps.trustForwardedAuthHeaders
            })
          }
        );

        await appendManagementAuditEvent(
          {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "workspace.user.invited",
            sourceWorkflow: "single_workspace_users",
            sourceEntity: {
              type: "TenantUser",
              id: createdUser.id
            },
            // Честность аудита: фиксируем факт приглашения (юзер + tokenId + срок),
            // rawToken в audit-payload отсутствует принципиально.
            commandInput: { ...parsed.value },
            beforeState: null,
            afterState: {
              user: createdUser,
              tokenId: token.tokenId,
              expiresAt: token.expiresAt.toISOString()
            },
            permissionResult: decision
          },
          transactionDataSource
        );

        return { user: createdUser, rawToken: token.rawToken, expiresAt: token.expiresAt };
      });
    } catch (error) {
      const conflict = workspaceUserUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    // delivery — свойство ИНСТАЛЛЯЦИИ (настроен ли канал почты), не аккаунта.
    let delivery: "email" | "none" =
      "provider" in emailProvider && emailProvider.provider === "smtp" ? "email" : "none";
    // Транзакция уже закоммичена (inactive-юзер + токен), поэтому падение отправки
    // НЕ должно отдавать 500 и оставлять сотрудника в лимбе (повтор инвайта упрётся
    // в user_email_taken, а сырой токен админ так и не получит). Деградируем честно:
    // при delivery:"email" помечаем delivery:"none" + deliveryFailed и возвращаем
    // токен админу. In-memory-провайдер (delivery:"none") всё равно вызываем — он
    // фиксирует lastInvitation для демо/ручной передачи, а токен возвращается ниже.
    let deliveryFailed = false;
    const workspace = await dataSource.findTenantById?.(actor.tenantId);
    try {
      await emailProvider.sendInvitation({
        email: outcome.user.email,
        rawToken: outcome.rawToken,
        acceptUrl: buildInvitationAcceptUrl(context, outcome.rawToken),
        ...(workspace?.name ? { workspaceName: workspace.name } : {}),
        ...(actor.name ? { invitedByName: actor.name } : {})
      });
    } catch {
      if (delivery === "email") {
        delivery = "none";
        deliveryFailed = true;
      }
    }

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json(
      {
        user: outcome.user,
        delivery,
        // deliveryFailed отличает «канал не настроен» от «письмо не ушло» —
        // в обоих случаях токен ниже возвращается, но UI покажет разный текст.
        ...(deliveryFailed ? { deliveryFailed: true } : {}),
        // Токен возвращаем в открытом виде ТОЛЬКО когда письмо не уйдёт
        // (delivery:"none") — иначе он существует лишь как хэш в БД.
        ...(delivery === "none"
          ? { invitationToken: outcome.rawToken, expiresAt: outcome.expiresAt.toISOString() }
          : {})
      },
      201
    );
  });

  app.patch("/api/workspace/users/:userId", async (context) => {
    const parsedUserId = parseUserIdParam(context.req.param("userId"));
    if (!parsedUserId.ok) return context.json({ error: parsedUserId.error }, 400);
    const userId = parsedUserId.value;
    const auth = await authorizeRoute(context, deps, {
      permission: canManageTenantUsers,
      capabilities: [
        "updateWorkspaceUser",
        "listWorkspaceUsers",
        "listAccessProfilesByTenantId",
        "listPositions",
        "updateCredentialEmail",
        "withTransaction",
        "appendAuditEvent"
      ],
      onDenied: ({ actor, decision }) =>
        appendWorkspaceUserDeniedAudit(deps, actor, {
          actionType: "workspace.user.update_denied",
          entityId: userId,
          commandInput: { userId },
          decision
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const workspaceUsers = await dataSource.listWorkspaceUsers(actor.tenantId);
    const beforeState =
      workspaceUsers.find((user) => user.id === userId) ?? null;
    if (!beforeState) return context.json({ error: "user_not_found" }, 404);

    const parsed = parseWorkspaceUserPatchBody(
      body.value,
      actor.tenantId,
      userId,
      beforeState
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      actor.id === userId &&
      (parsed.value.status !== "active" ||
        parsed.value.accessProfileId !== actor.accessProfileId)
    ) {
      return context.json({ error: "self_access_change_forbidden" }, 400);
    }

    // Глобальная часть правила занятости email требует findCredentialByEmail.
    // Порт НЕ объявлен в capabilities маршрута намеренно: capability-проба даёт
    // 501 ДО RBAC-шага и тем самым съела бы 403-ветку у неполных источников.
    // Поэтому проверяем здесь, после преамбулы, и тоже громко — молча ослабить
    // правило до «как было» нельзя, иначе оно опять разъедется с инвайтом.
    if (!dataSource.findCredentialByEmail) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    // Те же правила занятости email, что и на пути инвайта: расхождение давало
    // 409 из generic-catch по 23505 вместо точной предпроверки (см. workspaceEmailTaken).
    if (
      await workspaceEmailTaken(dataSource.findCredentialByEmail, {
        email: parsed.value.email,
        existingUsers: workspaceUsers,
        excludeUserId: userId
      })
    ) {
      return context.json({ error: "user_email_taken" }, 409);
    }
    // Оффбординг обязан отзывать токены сброса пароля (см. транзакцию ниже).
    // Требуем порт РОВНО когда контроль применяется — деактивация без
    // возможности отозвать токены обязана быть отказом, а не тихим 200.
    if (
      beforeState.status === "active" &&
      parsed.value.status !== "active" &&
      !dataSource.deletePasswordResetTokensByUserId
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    // Смена email тоже обязана уважать домен-allowlist политики безопасности.
    if (
      beforeState.email !== parsed.value.email &&
      !(await emailDomainAllowed(dataSource, actor.tenantId, parsed.value.email))
    ) {
      return context.json({ error: "email_domain_not_allowed" }, 400);
    }
    if (
      !(await dataSource.listAccessProfilesByTenantId(actor.tenantId)).some(
        (profile) => profile.id === parsed.value.accessProfileId
      )
    ) {
      return context.json({ error: "invalid_access_role" }, 400);
    }
    if (parsed.value.positionId) {
      const positionExists = (await dataSource.listPositions(actor.tenantId)).some(
        (position) => position.id === parsed.value.positionId
      );
      if (!positionExists) {
        return context.json({ error: "invalid_position" }, 400);
      }
    }
    let user: TenantUser;
    try {
      user = await runDataSourceTransaction(async (transactionDataSource) => {
        if (
          !transactionDataSource.updateWorkspaceUser ||
          !transactionDataSource.updateCredentialEmail
        ) {
          throw new Error("transactional_user_update_not_configured");
        }

        const updatedUser = await transactionDataSource.updateWorkspaceUser(
          parsed.value
        );
        if (beforeState.email !== updatedUser.email) {
          await transactionDataSource.updateCredentialEmail(
            updatedUser.tenantId,
            updatedUser.id,
            updatedUser.email
          );
        }
        if (
          shouldRevokeSessionsAfterUserUpdate(beforeState, updatedUser) &&
          transactionDataSource.deleteSessionsByUserId
        ) {
          await transactionDataSource.deleteSessionsByUserId(
            updatedUser.tenantId,
            updatedUser.id
          );
        }
        // Оффбординг обязан отзывать НЕ ТОЛЬКО сессии: невостребованный токен
        // восстановления пароля переживал деактивацию и позволял уволенному
        // задать новый пароль. Отзыв доступа = отзыв всех токенов доступа.
        if (beforeState.status === "active" && updatedUser.status !== "active") {
          // Падаем громко, как transactional_invitation_accept_not_configured в
          // authRegistrationRoutes: пропустить отзыв «потому что порта нет» —
          // значит молча вернуть 200 с живым токеном уволенного сотрудника.
          if (!transactionDataSource.deletePasswordResetTokensByUserId) {
            throw new Error("transactional_user_offboarding_not_configured");
          }
          await transactionDataSource.deletePasswordResetTokensByUserId(
            updatedUser.tenantId,
            updatedUser.id
          );
        }

        await appendManagementAuditEvent(
          {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "workspace.user.updated",
            sourceWorkflow: "single_workspace_users",
            sourceEntity: {
              type: "TenantUser",
              id: updatedUser.id
            },
            commandInput: parsed.value,
            beforeState,
            afterState: updatedUser,
            permissionResult: decision
          },
          transactionDataSource
        );

        return updatedUser;
      });
    } catch (error) {
      const conflict = workspaceUserUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ user });
  });

  // POST /api/workspace/users/:userId/password-reset-token — админская выдача
  // токена сброса пароля (для инсталляций с delivery:none, где письмо не придёт).
  // Токен генерируется ТЕМ ЖЕ механизмом, что и публичный password-reset/request
  // (issuePasswordResetToken: hashResetToken + passwordResetTtlMs); rawToken
  // возвращается РОВНО ОДИН РАЗ в ответе и нигде больше не существует в открытом
  // виде — в аудит пишется только факт выдачи (tokenId + срок), без rawToken.
  app.post("/api/workspace/users/:userId/password-reset-token", async (context) => {
    const parsedUserId = parseUserIdParam(context.req.param("userId"));
    if (!parsedUserId.ok) return context.json({ error: parsedUserId.error }, 400);
    const userId = parsedUserId.value;
    const auth = await authorizeRoute(context, deps, {
      permission: canManageTenantUsers,
      capabilities: [
        "createPasswordResetToken",
        "listWorkspaceUsers",
        "withTransaction",
        "appendAuditEvent"
      ],
      onDenied: ({ actor, decision }) =>
        appendWorkspaceUserDeniedAudit(deps, actor, {
          actionType: "workspace.user.password_reset_token_denied",
          entityId: userId,
          commandInput: { userId },
          decision
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    // Только пользователь СВОЕГО тенанта: чужой/несуществующий id → 404.
    const targetUser =
      (await dataSource.listWorkspaceUsers(actor.tenantId)).find(
        (user) => user.id === userId
      ) ?? null;
    if (!targetUser) return context.json({ error: "user_not_found" }, 404);

    const issued = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createPasswordResetToken) {
        throw new Error("transactional_password_reset_token_not_configured");
      }

      const token = await issuePasswordResetToken(
        transactionDataSource.createPasswordResetToken,
        {
          tenantId: actor.tenantId,
          userId: targetUser.id,
          requestedIp: getClientIp(context.req.raw.headers, {
            trustForwardedHeaders: deps.trustForwardedAuthHeaders
          })
        }
      );

      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "workspace.user.password_reset_token_issued",
          sourceWorkflow: "single_workspace_users",
          sourceEntity: {
            type: "TenantUser",
            id: targetUser.id
          },
          // Честность аудита: фиксируем факт выдачи (tokenId + срок), rawToken
          // в audit-payload отсутствует принципиально.
          commandInput: { userId: targetUser.id },
          beforeState: null,
          afterState: {
            tokenId: token.tokenId,
            expiresAt: token.expiresAt.toISOString()
          },
          permissionResult: decision
        },
        transactionDataSource
      );

      return token;
    });

    return context.json(
      {
        resetToken: issued.rawToken,
        expiresAt: issued.expiresAt.toISOString()
      },
      201
    );
  });

  app.delete("/api/workspace/users/:userId", async (context) => {
    const parsedUserId = parseUserIdParam(context.req.param("userId"));
    if (!parsedUserId.ok) return context.json({ error: parsedUserId.error }, 400);
    const userId = parsedUserId.value as UserId;
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.deleteWorkspaceUser ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    if (actor.id === userId) {
      return context.json({ error: "self_user_delete_forbidden" }, 400);
    }

    const decision = canManageTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendWorkspaceUserDeniedAudit(deps, actor, {
        actionType: "workspace.user.delete_denied",
        entityId: userId,
        commandInput: { userId },
        decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState =
      (await dataSource.listWorkspaceUsers(actor.tenantId)).find(
        (user) => user.id === userId
      ) ?? null;

    if (!beforeState) return context.json({ error: "user_not_found" }, 404);

    await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.deleteWorkspaceUser) {
        throw new Error("transactional_user_delete_not_configured");
      }

      await transactionDataSource.deleteWorkspaceUser(actor.tenantId, userId);
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "workspace.user.deleted",
          sourceWorkflow: "single_workspace_users",
          sourceEntity: {
            type: "TenantUser",
            id: userId
          },
          commandInput: { id: userId },
          beforeState,
          afterState: null,
          permissionResult: decision
        },
        transactionDataSource
      );
    });

    invalidateCapacityCacheForTenant(actor.tenantId);
    return context.json({ status: "deleted" });
  });
}

// Ссылка на страницу принятия приглашения на фронте. Как и buildResetUrl:
// при web→API rewrite request-URL содержит внутренний origin API, поэтому берём
// browser Origin (уже проверен same-origin middleware); для server-to-server без
// Origin — origin запроса.
function buildInvitationAcceptUrl(context: Context, rawToken: string): string {
  const originHeader = context.req.header("origin");
  const origin = originHeader
    ? new URL(originHeader).origin
    : new URL(context.req.url).origin;
  return `${origin}/invite/accept?token=${encodeURIComponent(rawToken)}`;
}

async function appendWorkspaceUserDeniedAudit(
  deps: ApiRouteDeps,
  actor: TenantUser,
  input: {
    actionType: string;
    entityId: string;
    commandInput: Record<string, unknown>;
    decision: PolicyDecision;
  }
) {
  if (!deps.dataSource.appendAuditEvent) return;
  await deps.appendManagementAuditEvent({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    actionType: input.actionType,
    sourceWorkflow: "single_workspace_users",
    sourceEntity: {
      type: "TenantUser",
      id: input.entityId
    },
    commandInput: input.commandInput,
    beforeState: null,
    afterState: null,
    permissionResult: input.decision,
    executionResult: { status: "denied" }
  });
}

function shouldRevokeSessionsAfterUserUpdate(
  before: {
    accessProfileId: string;
    email: string;
    status: string;
  },
  after: {
    accessProfileId: string;
    email: string;
    status: string;
  }
): boolean {
  return (
    before.accessProfileId !== after.accessProfileId ||
    before.email !== after.email ||
    before.status !== after.status
  );
}

/**
 * Единые правила занятости email для ОБОИХ путей записи (инвайт и обновление).
 * Раньше правила расходились: инвайт сверял регистронезависимо и глобально, а
 * PATCH — точным равенством внутри тенанта, поэтому смена адреса на "A@x.com"
 * при живом "a@x.com" (или на адрес чужого тенанта) проскакивала предпроверку и
 * ловилась только 23505 из updateCredentialEmail, спасённым generic-catch.
 *
 * 1) Сравнение регистронезависимое: upsertCredential/updateCredentialEmail
 *    приводят email к нижнему регистру, поэтому "A@x" и "a@x" — один адрес для
 *    уникального индекса.
 * 2) Проверка credential ГЛОБАЛЬНАЯ: user_credentials_email_uidx уникален по
 *    ВСЕМ тенантам, а не в пределах текущего.
 *
 * excludeUserId — обновляемый пользователь: собственный адрес не считается
 * занятым (иначе PATCH без смены email всегда падал бы в 409).
 */
async function workspaceEmailTaken(
  findCredentialByEmail: NonNullable<ApiTenantDataSource["findCredentialByEmail"]>,
  input: {
    email: string;
    existingUsers: WorkspaceUserRecord[];
    excludeUserId?: string;
  }
): Promise<boolean> {
  const email = input.email.toLowerCase();
  const takenByTenantUser = input.existingUsers.some(
    (user) => user.id !== input.excludeUserId && user.email.toLowerCase() === email
  );
  if (takenByTenantUser) return true;
  const credential = await findCredentialByEmail(email);
  return credential !== undefined && credential.userId !== input.excludeUserId;
}

// Домен email против политики безопасности тенанта (G6-01: allowlist теперь
// применяется, а не только сохраняется). Пустой список = ограничений нет.
async function emailDomainAllowed(
  dataSource: ApiRouteDeps["dataSource"],
  tenantId: TenantId,
  email: string
): Promise<boolean> {
  if (!dataSource.getTenantSecurityPolicy) return true;
  const policy = await dataSource.getTenantSecurityPolicy(tenantId);
  if (policy.domainAllowlist.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return policy.domainAllowlist.includes(domain);
}
