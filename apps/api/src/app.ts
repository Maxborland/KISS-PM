import {
  canManageAccessProfiles,
  canManagePositions,
  canManageTenantUsers,
  canManageWorkspaceTheme,
  canReadAccessProfiles,
  canReadAuditEvents,
  canReadPositions,
  canReadTenantUsers,
  canUpdateProfile,
  createAccessProfile,
  type AccessProfile
} from "@kiss-pm/access-control";
import { listTenantUsers, type TenantUser, type UserId } from "@kiss-pm/domain";
import { hashPassword, hashSessionToken, verifyPassword } from "@kiss-pm/persistence";
import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import { Hono } from "hono";
import { randomBytes, randomUUID } from "node:crypto";
import {
  buildExpiredSessionCookieHeader,
  buildSessionCookieHeader,
  getSessionTokenFromCookie,
  sessionTtlMs,
  shouldUseSecureCookies
} from "./authSession";
import {
  MissingAccessProfileError,
  resolveAppErrorResponse
} from "./appErrors";
import type {
  AccessProfileRecord,
  ApiTenantDataSource,
  AuditEventListItem,
  CreateAppOptions,
  ManagementAuditEventInput
} from "./apiTypes";
import {
  getStringField,
  isAccentColor,
  isWorkspaceTheme
} from "./parseHelpers";
import { registerWorkspaceConfigRoutes } from "./workspaceConfigRoutes";
import {
  parseAccessProfileCreateBody,
  parsePositionBody,
  parseWorkspaceUserBody,
  parseWorkspaceUserPatchBody
} from "./workspaceParsers";

const tenantAdminProfile = createAccessProfile({
  id: "tenant-admin",
  permissions: [
    "tenant.users.read",
    "tenant.users.manage",
    "tenant.access_profiles.read",
    "tenant.access_profiles.manage",
    "tenant.positions.read",
    "tenant.positions.manage",
    "tenant.workspace_config.read",
    "tenant.workspace_config.manage",
    "profile.read",
    "profile.update",
    "workspace.theme.manage",
    "tenant.audit_events.read"
  ]
});

export type { ApiTenantDataSource, CreateAppOptions } from "./apiTypes";

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono();
  const dataSource = options.dataSource ?? createInMemoryTenantDataSource();
  const secureCookies = options.secureCookies ?? shouldUseSecureCookies();

  app.onError((error, context) => {
    const response = resolveAppErrorResponse(error);
    return context.json(response.body, response.status);
  });

  app.use("/api/*", async (context, next) => {
    if (requiresSameOriginActionHeader(context.req.method, context.req.path)) {
      const actionHeader = context.req.header("x-kiss-pm-action");
      if (actionHeader !== "same-origin") {
        return context.json({ error: "same_origin_action_required" }, 403);
      }
    }

    await next();
  });

  async function getActor(userId: string | null) {
    if (!userId) return undefined;
    const actor = await dataSource.findUserById(userId);
    if (!actor) return undefined;
    return (await isWorkspaceUserActive(actor)) ? actor : undefined;
  }

  async function getSessionActor(cookieHeader: string | null) {
    if (!dataSource.findSessionByTokenHash) return undefined;

    const token = getSessionTokenFromCookie(cookieHeader);
    if (!token) return undefined;

    const session = await dataSource.findSessionByTokenHash(hashSessionToken(token));
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return undefined;
    }

    const actor = await dataSource.findUserById(session.userId);
    if (!actor) return undefined;
    return (await isWorkspaceUserActive(actor)) ? actor : undefined;
  }

  async function getSessionActorFromHeaders(cookie: string | null) {
    return getSessionActor(cookie);
  }

  async function getDevActorFromHeaders(input: {
    cookie: string | null;
    userId: string | null;
  }) {
    const sessionActor = await getSessionActor(input.cookie);
    if (sessionActor) return sessionActor;
    return getActor(input.userId);
  }

  async function getActorProfile(actor: TenantUser) {
    if (!dataSource.findAccessProfileById) {
      if (dataSource.findSessionByTokenHash || dataSource.listWorkspaceUsers) {
        throw new MissingAccessProfileError();
      }

      return tenantAdminProfile;
    }

    const profile = await dataSource.findAccessProfileById(
      actor.tenantId,
      actor.accessProfileId
    );
    if (!profile) throw new MissingAccessProfileError();

    return profile;
  }

  async function runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T> {
    if (!dataSource.withTransaction) {
      throw new Error("transaction_not_configured");
    }

    return dataSource.withTransaction(operation);
  }

  async function isWorkspaceUserActive(user: TenantUser) {
    if (!dataSource.listWorkspaceUsers) return true;

    const workspaceUser = (await dataSource.listWorkspaceUsers(user.tenantId)).find(
      (candidate) => candidate.id === user.id
    );

    return workspaceUser?.status !== "inactive";
  }

  async function appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource: ApiTenantDataSource = dataSource
  ) {
    if (!auditDataSource.appendAuditEvent) {
      throw new Error("audit_not_configured");
    }

    await auditDataSource.appendAuditEvent({
      id: `audit-${randomUUID()}`,
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actionType: input.actionType,
      sourceSurfaceId: null,
      sourceWorkflow: input.sourceWorkflow,
      sourceEntity: input.sourceEntity,
      input: input.commandInput,
      beforeState: input.beforeState,
      afterState: input.afterState,
      permissionResult: input.permissionResult,
      executionResult: {
        status: "succeeded"
      },
      correlationId: randomUUID(),
      createdAt: new Date()
    });
  }

  app.get("/health", (context) => {
    return context.json({ status: "ok", product: "KISS PM" });
  });

  app.post("/api/auth/login", async (context) => {
    if (
      !dataSource.findCredentialByEmail ||
      !dataSource.createSession
    ) {
      return context.json({ error: "auth_not_configured" }, 501);
    }

    const body = await context.req.json().catch(() => null);
    const email =
      body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string"
        ? (body as { email: string }).email.toLowerCase()
        : "";
    const password =
      body && typeof body === "object" && typeof (body as { password?: unknown }).password === "string"
        ? (body as { password: string }).password
        : "";
    const credential = await dataSource.findCredentialByEmail(email);

    if (
      !credential ||
      !verifyPassword({
        password,
        passwordHash: credential.passwordHash,
        passwordSalt: credential.passwordSalt
      })
    ) {
      return context.json({ error: "invalid_credentials" }, 401);
    }

    const actor = await dataSource.findUserById(credential.userId);
    if (!actor) {
      return context.json({ error: "user_not_found" }, 404);
    }
    if (!(await isWorkspaceUserActive(actor))) {
      return context.json({ error: "user_inactive" }, 403);
    }

    const rawToken = randomBytes(32).toString("hex");
    await dataSource.createSession({
      id: `session-${randomUUID()}`,
      tenantId: credential.tenantId,
      userId: credential.userId,
      tokenHash: hashSessionToken(rawToken),
      expiresAt: new Date(Date.now() + sessionTtlMs)
    });

    context.header("Set-Cookie", buildSessionCookieHeader(rawToken, { secure: secureCookies }));

    return context.json({
      user: toPublicUser(actor),
      workspace: {
        id: actor.tenantId
      }
    });
  });

  app.post("/api/auth/logout", async (context) => {
    if (dataSource.deleteSessionByTokenHash) {
      const token = getSessionTokenFromCookie(context.req.header("cookie") ?? null);
      if (token) {
        await dataSource.deleteSessionByTokenHash(hashSessionToken(token));
      }
    }

    context.header("Set-Cookie", buildExpiredSessionCookieHeader({ secure: secureCookies }));
    return context.json({ status: "ok" });
  });

  app.get("/api/auth/me", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "session_required" }, 401);
    }

    const profile = await getActorProfile(actor);
    const users = dataSource.listWorkspaceUsers
      ? await dataSource.listWorkspaceUsers(actor.tenantId)
      : [];
    const fullUser = users.find((user) => user.id === actor.id);

    return context.json({
      user: fullUser ?? toPublicUser(actor),
      permissions: profile.permissions,
      workspace: {
        id: actor.tenantId
      }
    });
  });

  app.get("/api/session/dev-users", async (context) => {
    const users = await dataSource.listDevUsers();

    return context.json({
      users: users.map((user) => ({
        id: user.id,
        tenantId: user.tenantId,
        name: user.name
      }))
    });
  });

  app.get("/api/session/dev-login", async (context) => {
    const userId = context.req.query("userId") ?? null;
    const actor = await getActor(userId);

    if (!actor) {
      return context.json({ error: "dev_user_not_found" }, 404);
    }

    return context.json({
      user: {
        id: actor.id,
        tenantId: actor.tenantId,
        name: actor.name
      }
    });
  });

  app.get("/api/tenant/current", async (context) => {
    const actor = await getDevActorFromHeaders({
      cookie: context.req.header("cookie") ?? null,
      userId: context.req.header("x-user-id") ?? null
    });

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    const tenant = await dataSource.findTenantById(actor.tenantId);

    if (!tenant) {
      return context.json({ error: "tenant_not_found" }, 404);
    }

    return context.json({
      tenant,
      user: {
        id: actor.id,
        tenantId: actor.tenantId,
        name: actor.name
      }
    });
  });

  app.get("/api/tenant/:tenantId/users", async (context) => {
    const actor = await getDevActorFromHeaders({
      cookie: context.req.header("cookie") ?? null,
      userId: context.req.header("x-user-id") ?? null
    });

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    const targetTenantId = context.req.param("tenantId");
    const actorProfile = await getActorProfile(actor);
    const decision = canReadTenantUsers({
      actor,
      profile: actorProfile,
      targetTenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const users = await dataSource.listUsersByTenantId(targetTenantId);

    return context.json({
      users: users.map((user) => ({
        id: user.id,
        tenantId: user.tenantId,
        name: user.name
      }))
    });
  });

  app.get("/api/tenant/current/access-profiles", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    if (!dataSource.listAccessProfilesByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canReadAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const accessProfiles = await dataSource.listAccessProfilesByTenantId(
      actor.tenantId
    );

    return context.json({ accessProfiles });
  });

  app.post("/api/tenant/current/access-profiles", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    if (
      !dataSource.createAccessProfile ||
      !dataSource.appendAuditEvent ||
      !dataSource.listAccessProfilesByTenantId
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canManageAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const body = await context.req.json().catch(() => null);
    const parsed = parseAccessProfileCreateBody(body);

    if (!parsed.ok) {
      return context.json({ error: parsed.error }, 400);
    }

    const existingProfiles = await dataSource.listAccessProfilesByTenantId(
      actor.tenantId
    );
    if (existingProfiles.some((profile) => profile.id === parsed.value.id)) {
      return context.json({ error: "access_role_id_taken" }, 409);
    }
    if (existingProfiles.some((profile) => profile.name === parsed.value.name)) {
      return context.json({ error: "access_role_name_taken" }, 409);
    }

    const accessProfile = await dataSource.createAccessProfile({
      ...parsed.value,
      tenantId: actor.tenantId
    });
    const correlationId = randomUUID();

    await dataSource.appendAuditEvent({
      id: `audit-${randomUUID()}`,
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "tenant.access_profile.created",
      sourceSurfaceId: null,
      sourceWorkflow: "tenant_admin_access_profile",
      sourceEntity: {
        type: "AccessProfile",
        id: accessProfile.id
      },
      input: parsed.value,
      beforeState: null,
      afterState: accessProfile,
      permissionResult: decision,
      executionResult: {
        status: "succeeded"
      },
      correlationId,
      createdAt: new Date()
    });

    return context.json({ accessProfile }, 201);
  });

  app.patch("/api/workspace/access-roles/:roleId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "session_required" }, 401);
    }

    if (!dataSource.updateAccessProfile || !dataSource.listAccessProfilesByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canManageAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const roleId = context.req.param("roleId");
    const beforeState =
      (await dataSource.listAccessProfilesByTenantId(actor.tenantId)).find(
        (profile) => profile.id === roleId
      ) ?? null;

    if (!beforeState) {
      return context.json({ error: "access_role_not_found" }, 404);
    }
    if (roleId === actor.accessProfileId) {
      return context.json({ error: "self_access_role_update_forbidden" }, 400);
    }

    const body = await context.req.json().catch(() => null);
    const parsed = parseAccessProfileCreateBody({
      ...(body && typeof body === "object" ? body : {}),
      id: roleId
    });

    if (!parsed.ok) {
      return context.json({ error: parsed.error }, 400);
    }

    const duplicateName = (await dataSource.listAccessProfilesByTenantId(actor.tenantId)).some(
      (profile) => profile.id !== roleId && profile.name === parsed.value.name
    );
    if (duplicateName) {
      return context.json({ error: "access_role_name_taken" }, 409);
    }

    const accessRole = await dataSource.updateAccessProfile({
      ...parsed.value,
      tenantId: actor.tenantId
    });

    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "tenant.access_profile.updated",
      sourceWorkflow: "single_workspace_access_roles",
      sourceEntity: {
        type: "AccessProfile",
        id: accessRole.id
      },
      commandInput: parsed.value,
      beforeState,
      afterState: accessRole,
      permissionResult: decision
    });

    return context.json({ accessRole });
  });

  app.delete("/api/workspace/access-roles/:roleId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "session_required" }, 401);
    }

    if (
      !dataSource.deleteAccessProfile ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.listWorkspaceUsers
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    if (actor.accessProfileId === context.req.param("roleId")) {
      return context.json({ error: "self_access_role_delete_forbidden" }, 400);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canManageAccessProfiles({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const roleId = context.req.param("roleId");
    const beforeState =
      (await dataSource.listAccessProfilesByTenantId(actor.tenantId)).find(
        (profile) => profile.id === roleId
      ) ?? null;

    if (!beforeState) {
      return context.json({ error: "access_role_not_found" }, 404);
    }

    const assignedUsers = (await dataSource.listWorkspaceUsers(actor.tenantId)).filter(
      (user) => user.accessProfileId === roleId
    );
    if (assignedUsers.length > 0) {
      return context.json({ error: "access_role_assigned" }, 409);
    }

    await dataSource.deleteAccessProfile(actor.tenantId, roleId);
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "tenant.access_profile.deleted",
      sourceWorkflow: "single_workspace_access_roles",
      sourceEntity: {
        type: "AccessProfile",
        id: roleId
      },
      commandInput: { id: roleId },
      beforeState,
      afterState: null,
      permissionResult: decision
    });

    return context.json({ status: "deleted" });
  });

  app.get("/api/tenant/current/audit-events", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );

    if (!actor) {
      return context.json({ error: "dev_session_required" }, 401);
    }

    if (!dataSource.listAuditEventsByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const actorProfile = await getActorProfile(actor);
    const decision = canReadAuditEvents({
      actor,
      profile: actorProfile,
      targetTenantId: actor.tenantId
    });

    if (!decision.allowed) {
      return context.json({ error: decision.reason }, 403);
    }

    const auditEvents = await dataSource.listAuditEventsByTenantId(actor.tenantId);

    return context.json({
      auditEvents: auditEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString()
      }))
    });
  });

  registerWorkspaceConfigRoutes(app, {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  });

  app.get("/api/workspace/users", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listWorkspaceUsers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      users: await dataSource.listWorkspaceUsers(actor.tenantId)
    });
  });

  app.post("/api/workspace/users", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createWorkspaceUser ||
      !dataSource.upsertCredential ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.listPositions ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await context.req.json().catch(() => null);
    const parsed = parseWorkspaceUserBody(body, actor.tenantId);
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

    const user = await runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.createWorkspaceUser ||
        !transactionDataSource.upsertCredential
      ) {
        throw new Error("transactional_user_create_not_configured");
      }

      const createdUser = await transactionDataSource.createWorkspaceUser(parsed.value);
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
          commandInput: { ...parsed.value, password: parsed.password ? "***" : undefined },
          beforeState: null,
          afterState: createdUser,
          permissionResult: decision
        },
        transactionDataSource
      );

      return createdUser;
    });

    return context.json({ user }, 201);
  });

  app.patch("/api/workspace/users/:userId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.updateWorkspaceUser ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.listAccessProfilesByTenantId ||
      !dataSource.listPositions ||
      !dataSource.updateCredentialEmail ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await context.req.json().catch(() => null);
    const workspaceUsers = await dataSource.listWorkspaceUsers(actor.tenantId);
    const beforeState =
      workspaceUsers.find((user) => user.id === context.req.param("userId")) ?? null;
    if (!beforeState) return context.json({ error: "user_not_found" }, 404);

    const parsed = parseWorkspaceUserPatchBody(
      body,
      actor.tenantId,
      context.req.param("userId"),
      beforeState
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      actor.id === context.req.param("userId") &&
      (parsed.value.status !== "active" ||
        parsed.value.accessProfileId !== actor.accessProfileId)
    ) {
      return context.json({ error: "self_access_change_forbidden" }, 400);
    }

    if (
      workspaceUsers.some(
        (user) => user.id !== context.req.param("userId") && user.email === parsed.value.email
      )
    ) {
      return context.json({ error: "user_email_taken" }, 409);
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
    const user = await runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.updateWorkspaceUser ||
        !transactionDataSource.updateCredentialEmail
      ) {
        throw new Error("transactional_user_update_not_configured");
      }

      const updatedUser = await transactionDataSource.updateWorkspaceUser(parsed.value);
      if (beforeState.email !== updatedUser.email) {
        await transactionDataSource.updateCredentialEmail(
          updatedUser.tenantId,
          updatedUser.id,
          updatedUser.email
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

    return context.json({ user });
  });

  app.delete("/api/workspace/users/:userId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.deleteWorkspaceUser || !dataSource.listWorkspaceUsers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const userId = context.req.param("userId") as UserId;
    if (actor.id === userId) {
      return context.json({ error: "self_user_delete_forbidden" }, 400);
    }

    const decision = canManageTenantUsers({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const beforeState =
      (await dataSource.listWorkspaceUsers(actor.tenantId)).find(
        (user) => user.id === userId
      ) ?? null;

    if (!beforeState) return context.json({ error: "user_not_found" }, 404);

    await dataSource.deleteWorkspaceUser(actor.tenantId, userId);
    await appendManagementAuditEvent({
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
    });

    return context.json({ status: "deleted" });
  });

  app.get("/api/workspace/positions", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listPositions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadPositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({ positions: await dataSource.listPositions(actor.tenantId) });
  });

  app.post("/api/workspace/positions", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.createPosition || !dataSource.listPositions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManagePositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const body = await context.req.json().catch(() => null);
    const parsed = parsePositionBody(body, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const existingPositions = await dataSource.listPositions(actor.tenantId);
    if (existingPositions.some((position) => position.id === parsed.value.id)) {
      return context.json({ error: "position_id_taken" }, 409);
    }
    if (existingPositions.some((position) => position.name === parsed.value.name)) {
      return context.json({ error: "position_name_taken" }, 409);
    }

    const position = await dataSource.createPosition(parsed.value);
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "workspace.position.created",
      sourceWorkflow: "single_workspace_positions",
      sourceEntity: {
        type: "Position",
        id: position.id
      },
      commandInput: parsed.value,
      beforeState: null,
      afterState: position,
      permissionResult: decision
    });

    return context.json({ position }, 201);
  });

  app.patch("/api/workspace/positions/:positionId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.updatePosition || !dataSource.listPositions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManagePositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const existingPositions = await dataSource.listPositions(actor.tenantId);
    const beforeState =
      existingPositions.find(
        (position) => position.id === context.req.param("positionId")
      ) ?? null;
    if (!beforeState) return context.json({ error: "position_not_found" }, 404);
    const body = await context.req.json().catch(() => null);
    const parsed = parsePositionBody(body, actor.tenantId, context.req.param("positionId"));
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (
      existingPositions.some(
        (position) => position.id !== context.req.param("positionId") && position.name === parsed.value.name
      )
    ) {
      return context.json({ error: "position_name_taken" }, 409);
    }

    const position = await dataSource.updatePosition(parsed.value);
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "workspace.position.updated",
      sourceWorkflow: "single_workspace_positions",
      sourceEntity: {
        type: "Position",
        id: position.id
      },
      commandInput: parsed.value,
      beforeState,
      afterState: position,
      permissionResult: decision
    });

    return context.json({ position });
  });

  app.delete("/api/workspace/positions/:positionId", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.deletePosition || !dataSource.listPositions || !dataSource.listWorkspaceUsers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManagePositions({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const positionId = context.req.param("positionId");
    const beforeState =
      (await dataSource.listPositions(actor.tenantId)).find(
        (position) => position.id === positionId
      ) ?? null;
    if (!beforeState) return context.json({ error: "position_not_found" }, 404);

    const assignedUsers = (await dataSource.listWorkspaceUsers(actor.tenantId)).filter(
      (user) => user.positionId === positionId
    );
    if (assignedUsers.length > 0) {
      return context.json({ error: "position_assigned" }, 409);
    }

    await dataSource.deletePosition(actor.tenantId, positionId);
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "workspace.position.deleted",
      sourceWorkflow: "single_workspace_positions",
      sourceEntity: {
        type: "Position",
        id: positionId
      },
      commandInput: { id: positionId },
      beforeState,
      afterState: null,
      permissionResult: decision
    });

    return context.json({ status: "deleted" });
  });

  app.get("/api/workspace/access-roles", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listAccessProfilesByTenantId) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const decision = canReadAccessProfiles({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      accessRoles: await dataSource.listAccessProfilesByTenantId(actor.tenantId)
    });
  });

  app.patch("/api/profile", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.updateWorkspaceUser || !dataSource.listWorkspaceUsers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canUpdateProfile({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const current = (await dataSource.listWorkspaceUsers(actor.tenantId)).find(
      (user) => user.id === actor.id
    );
    if (!current) return context.json({ error: "user_not_found" }, 404);

    const body = await context.req.json().catch(() => ({}));
    const nameInput = getStringField(body, "name");
    const phoneInput = getStringField(body, "phone");
    const telegramInput = getStringField(body, "telegram");
    const user = await dataSource.updateWorkspaceUser({
      ...current,
      name: nameInput === undefined || nameInput.length === 0 ? current.name : nameInput,
      phone: phoneInput === undefined ? current.phone : phoneInput || null,
      telegram: telegramInput === undefined ? current.telegram : telegramInput || null
    });
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "profile.updated",
      sourceWorkflow: "single_workspace_profile",
      sourceEntity: {
        type: "TenantUser",
        id: actor.id
      },
      commandInput: {
        name: nameInput,
        phone: phoneInput,
        telegram: telegramInput
      },
      beforeState: current,
      afterState: user,
      permissionResult: decision
    });

    return context.json({ user });
  });

  app.patch("/api/profile/theme", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.updateWorkspaceUser || !dataSource.listWorkspaceUsers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageWorkspaceTheme({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const current = (await dataSource.listWorkspaceUsers(actor.tenantId)).find(
      (user) => user.id === actor.id
    );
    if (!current) return context.json({ error: "user_not_found" }, 404);
    const body = await context.req.json().catch(() => ({}));
    const themeInput = getStringField(body, "theme");
    const accentInput = getStringField(body, "accentColor");
    const theme = themeInput === undefined || themeInput === "" ? current.theme : themeInput;
    const accentColor =
      accentInput === undefined || accentInput === "" ? current.accentColor : accentInput;

    if (!isWorkspaceTheme(theme)) return context.json({ error: "invalid_theme" }, 400);
    if (!isAccentColor(accentColor)) {
      return context.json({ error: "invalid_accent_color" }, 400);
    }

    const user = await dataSource.updateWorkspaceUser({
      ...current,
      theme,
      accentColor: accentColor.toLowerCase()
    });
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "profile.theme.updated",
      sourceWorkflow: "single_workspace_theme",
      sourceEntity: {
        type: "TenantUser",
        id: actor.id
      },
      commandInput: {
        theme,
        accentColor: accentColor.toLowerCase()
      },
      beforeState: current,
      afterState: user,
      permissionResult: decision
    });

    return context.json({ user });
  });

  return app;
}

function toPublicUser(user: TenantUser) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    accessProfileId: user.accessProfileId
  };
}

function requiresSameOriginActionHeader(method: string, path: string): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  return path !== "/api/auth/login";
}

function createInMemoryTenantDataSource(): ApiTenantDataSource {
  const demo = createDemoTenantDataset();
  const accessProfiles: AccessProfileRecord[] = demo.tenants.map((tenant) => ({
    id: `access-profile-${tenant.id.replace("tenant-", "")}-admin`,
    tenantId: tenant.id,
    name: "Администратор",
    permissions: tenantAdminProfile.permissions
  }));
  const auditEvents: AuditEventListItem[] = [];

  return {
    async listDevUsers() {
      return demo.users;
    },
    async findUserById(userId) {
      return demo.users.find((user) => user.id === userId);
    },
    async findTenantById(tenantId) {
      return demo.tenants.find((tenant) => tenant.id === tenantId);
    },
    async findAccessProfileById() {
      return tenantAdminProfile;
    },
    async listUsersByTenantId(tenantId) {
      return listTenantUsers(demo.users, tenantId);
    },
    async listAccessProfilesByTenantId(tenantId) {
      return accessProfiles.filter((profile) => profile.tenantId === tenantId);
    },
    async createAccessProfile(input) {
      accessProfiles.push(input);
      return input;
    },
    async appendAuditEvent(input) {
      auditEvents.unshift({
        ...input,
        sourceSurfaceId: input.sourceSurfaceId ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null
      });
    },
    async listAuditEventsByTenantId(tenantId) {
      return auditEvents.filter((event) => event.tenantId === tenantId);
    }
  };
}
