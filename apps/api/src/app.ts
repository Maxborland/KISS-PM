import { type TenantUser } from "@kiss-pm/domain";
import { hashSessionToken } from "@kiss-pm/persistence";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import {
  getSessionTokenFromCookie,
  shouldUseSecureCookies
} from "./authSession";
import {
  createAuthRateLimiter,
  shouldTrustForwardedAuthHeaders
} from "./authRateLimit";
import {
  MissingAccessProfileError,
  resolveAppErrorResponse
} from "./appErrors";
import type {
  ApiTenantDataSource,
  CreateAppOptions,
  ManagementAuditEventInput
} from "./apiTypes";
import { createInMemoryTenantDataSource } from "./inMemoryTenantDataSource";
import { registerAccessRoleRoutes } from "./accessRoleRoutes";
import { registerAttachmentRoutes } from "./attachmentRoutes";
import { registerAuditRoutes } from "./auditRoutes";
import { registerAuthRoutes } from "./authRoutes";
import { registerCrmRoutes } from "./crmRoutes";
import { registerControlRoutes } from "./controlRoutes";
import { registerDevTenantRoutes } from "./devTenantRoutes";
import { registerCrmActivityRoutes } from "./crmActivityRoutes";
import { registerPositionRoutes } from "./positionRoutes";
import { registerProfileRoutes } from "./profileRoutes";
import { registerCapacityRoutes } from "./capacity/registerCapacityRoutes";
import { registerPlanningRoutes } from "./planningRoutes";
import { registerAbsencesRoutes } from "./absencesRoutes";
import { registerOrgStructureRoutes } from "./orgStructureRoutes";
import { registerProductionCalendarRoutes } from "./productionCalendarRoutes";
import { registerProjectIntakeRoutes } from "./projectIntakeRoutes";
import { registerProjectWorkRoutes } from "./projectWorkRoutes";
import { registerScheduledTasksRoutes } from "./scheduledTasksRoutes";
import { registerSearchRoutes } from "./searchRoutes";
import { createStorageProviderFromEnv } from "./storageProvider";
import {
  isTrustedBrowserMutationRequest,
  setApiSecurityHeaders,
  trustedMutationOriginsFromEnv
} from "./requestSecurity";
import type { ApiRouteDeps } from "./routeTypes";
import { tenantAdminProfile } from "./tenantAdminProfile";
import { registerWorkspaceConfigRoutes } from "./workspaceConfigRoutes";
import { registerWorkspaceUserRoutes } from "./workspaceUserRoutes";

export type { ApiTenantDataSource, CreateAppOptions } from "./apiTypes";

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono();
  const dataSource = options.dataSource ?? createInMemoryTenantDataSource();
  const authRateLimiter = options.authRateLimiter ?? createAuthRateLimiter();
  const secureCookies = options.secureCookies ?? shouldUseSecureCookies();
  const trustedMutationOrigins =
    options.trustedMutationOrigins ?? trustedMutationOriginsFromEnv();
  const storageProvider = options.storageProvider ?? createStorageProviderFromEnv();
  const trustForwardedAuthHeaders =
    options.trustForwardedAuthHeaders ?? shouldTrustForwardedAuthHeaders();
  const enableDevTenantRoutes = options.enableDevTenantRoutes ?? false;

  app.onError((error, context) => {
    const response = resolveAppErrorResponse(error);
    return context.json(response.body, response.status);
  });

  app.use("/api/*", async (context, next) => {
    context.header("Cache-Control", "no-store, private");
    setApiSecurityHeaders(context);
    await next();
  });

  app.use("/api/*", async (context, next) => {
    if (requiresSameOriginActionHeader(context.req.method, context.req.path)) {
      const actionHeader = context.req.header("x-kiss-pm-action");
      if (actionHeader !== "same-origin") {
        return context.json({ error: "same_origin_action_required" }, 403);
      }
      if (!isTrustedBrowserMutationRequest(context.req.raw, trustedMutationOrigins)) {
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

    const auditEventId = `audit-${randomUUID()}`;
    await auditDataSource.appendAuditEvent({
      id: auditEventId,
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
      executionResult: input.executionResult ?? { status: "succeeded" },
      correlationId: randomUUID(),
      createdAt: new Date()
    });
    return auditEventId;
  }

  const routeDeps: ApiRouteDeps = {
    appendManagementAuditEvent,
    authRateLimiter,
    dataSource,
    getActor,
    getActorProfile,
    getDevActorFromHeaders,
    getSessionActorFromHeaders,
    isWorkspaceUserActive,
    runDataSourceTransaction,
    secureCookies,
    storageProvider,
    trustForwardedAuthHeaders
  };

  app.get("/health", (context) => {
    return context.json({ status: "ok", product: "KISS PM" });
  });

  app.get("/api/health/realtime", async (context) => {
    const { getPlanningRealtimeStatus } = await import("./planningRealtimeHealth.js");
    return context.json(getPlanningRealtimeStatus());
  });

  registerAuthRoutes(app, routeDeps);
  if (enableDevTenantRoutes) {
    registerDevTenantRoutes(app, routeDeps);
  }
  registerAccessRoleRoutes(app, routeDeps);
  registerAuditRoutes(app, routeDeps);
  registerControlRoutes(app, routeDeps);
  registerCrmRoutes(app, routeDeps);
  registerProjectIntakeRoutes(app, routeDeps);
  registerCrmActivityRoutes(app, routeDeps);
  registerAttachmentRoutes(app, routeDeps);
  registerSearchRoutes(app, routeDeps);
  registerPlanningRoutes(app, routeDeps);
  registerCapacityRoutes(app, routeDeps);
  registerProductionCalendarRoutes(app, routeDeps);
  registerAbsencesRoutes(app, routeDeps);
  registerOrgStructureRoutes(app, routeDeps);
  registerProjectWorkRoutes(app, routeDeps);
  registerScheduledTasksRoutes(app, routeDeps);
  registerWorkspaceConfigRoutes(app, routeDeps);
  registerWorkspaceUserRoutes(app, routeDeps);
  registerPositionRoutes(app, routeDeps);
  registerProfileRoutes(app, routeDeps);

  return app;
}

function requiresSameOriginActionHeader(method: string, path: string): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  return path !== "/api/auth/login";
}
