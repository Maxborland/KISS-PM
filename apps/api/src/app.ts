import { type TenantUser } from "@kiss-pm/domain";
import { hashSessionToken } from "@kiss-pm/persistence";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import {
  getSessionTokenFromCookie,
  shouldUseSecureCookies
} from "./authSession";
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
import { registerAuditRoutes } from "./auditRoutes";
import { registerAuthRoutes } from "./authRoutes";
import { registerDevTenantRoutes } from "./devTenantRoutes";
import { registerPositionRoutes } from "./positionRoutes";
import { registerProfileRoutes } from "./profileRoutes";
import type { ApiRouteDeps } from "./routeTypes";
import { tenantAdminProfile } from "./tenantAdminProfile";
import { registerWorkspaceConfigRoutes } from "./workspaceConfigRoutes";
import { registerWorkspaceUserRoutes } from "./workspaceUserRoutes";

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

  const routeDeps: ApiRouteDeps = {
    appendManagementAuditEvent,
    dataSource,
    getActor,
    getActorProfile,
    getDevActorFromHeaders,
    getSessionActorFromHeaders,
    isWorkspaceUserActive,
    runDataSourceTransaction,
    secureCookies
  };

  app.get("/health", (context) => {
    return context.json({ status: "ok", product: "KISS PM" });
  });

  registerAuthRoutes(app, routeDeps);
  registerDevTenantRoutes(app, routeDeps);
  registerAccessRoleRoutes(app, routeDeps);
  registerAuditRoutes(app, routeDeps);
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
