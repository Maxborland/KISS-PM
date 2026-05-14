import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

import { createPhase2RuntimeState } from "./phase2Runtime";
import type { Phase2RuntimeSession, Phase2RuntimeState } from "./phase2Runtime";

type ApiErrorCode =
  | "unauthenticated"
  | "permission_denied"
  | "tenant_mismatch"
  | "unsupported_scope"
  | "validation_error"
  | "not_found"
  | "conflict"
  | "test_mode_only";

export type CreateApiAppOptions = {
  allowTestFixtureReset?: boolean;
};

const scopeSchema = z.enum(["own", "project", "tenant", "all"]);

const upsertAccessProfileSchema = z.object({
  id: z.string().trim().min(1).optional(),
  version: z.number().int().positive().optional(),
  systemKey: z.string().trim().min(1),
  label: z.string().trim().min(1),
  permissions: z.array(z.string().trim().min(1)).min(1),
  scopeRules: z
    .array(
      z.object({
        permissionKey: z.string().trim().min(1),
        scope: scopeSchema,
        constraints: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
      })
    )
    .min(1),
  active: z.boolean()
});

const updateTenantLabelSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  expectedConfigurationVersion: z.number().int().positive()
});

const permissionDiagnosticsSchema = z.object({
  permissionKey: z.string().trim().min(1),
  targetEntityType: z.string().trim().min(1),
  targetEntityId: z.string().trim().min(1).optional(),
  targetTenantId: z.string().trim().min(1).optional(),
  requestedScope: z.string().trim().min(1).optional()
});

function errorDto(code: ApiErrorCode, message: string) {
  return { code, message };
}

function mapPolicyReasonToErrorCode(reasonCode: string): ApiErrorCode {
  if (reasonCode === "tenant_mismatch") return "tenant_mismatch";
  if (reasonCode === "unsupported_scope") return "unsupported_scope";
  return "permission_denied";
}

function accessProfileDto(profile: {
  id: string;
  tenantId: string;
  systemKey: string;
  label: string;
  permissions: string[];
  scopeRules: Array<{ permissionKey: string; scope: string; constraints?: Record<string, string | number | boolean> }>;
  active: boolean;
  version: number;
  updatedAt: string;
}) {
  return {
    id: profile.id,
    tenantId: profile.tenantId,
    systemKey: profile.systemKey,
    label: profile.label,
    permissions: [...profile.permissions],
    scopeRules: profile.scopeRules.map((rule) => ({
      permissionKey: rule.permissionKey,
      scope: rule.scope,
      ...(rule.constraints !== undefined ? { constraints: { ...rule.constraints } } : {})
    })),
    active: profile.active,
    version: profile.version,
    updatedAt: profile.updatedAt
  };
}

function auditEventDto(event: {
  id: string;
  tenantId: string;
  actorId: string;
  actionKey: string;
  target: { entityType: string; entityId: string };
  result: string;
  timestamp: string;
  correlationId: string;
  details?: unknown;
}) {
  return {
    id: event.id,
    tenantId: event.tenantId,
    actorId: event.actorId,
    actionKey: event.actionKey,
    target: { ...event.target },
    result: event.result,
    timestamp: event.timestamp,
    correlationId: event.correlationId,
    ...(event.details !== undefined ? { details: event.details } : {})
  };
}

async function parseJson(context: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    throw new Error("invalid_json");
  }
}

function requireSession(runtime: Phase2RuntimeState, testUserId: string | undefined): Phase2RuntimeSession {
  const session = runtime.resolveSession(testUserId);
  if (!session) {
    throw new Error("unauthenticated");
  }

  return session;
}

function assertAllowed(
  runtime: Phase2RuntimeState,
  session: Phase2RuntimeSession,
  permissionKey: string,
  target: { entityType: string; tenantId: string; entityId?: string },
  requestedScope?: string
) {
  const evaluation = runtime.evaluatePolicy({
    session,
    permissionKey,
    target,
    ...(requestedScope !== undefined ? { requestedScope } : {})
  });

  if (!evaluation.allowed) {
    const code = mapPolicyReasonToErrorCode(evaluation.reasonCode);
    throw Object.assign(new Error(code), { code, status: 403 });
  }

  return evaluation;
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const app = new Hono();
  let runtime = createPhase2RuntimeState();

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "kiss-pm-api"
    })
  );

  app.get("/tenants/current", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant.read", {
        entityType: "tenant",
        tenantId: session.user.tenantId,
        entityId: session.tenant.id
      });

      return context.json({
        tenant: {
          id: session.tenant.id,
          label: session.tenant.label,
          configurationVersion: session.labelSet.configurationVersion
        },
        actor: {
          id: session.user.id,
          displayName: session.user.displayName,
          accessProfileId: session.user.accessProfileId
        },
        labels: { ...session.labelSet.labels },
        permissions: [...session.profile.permissions]
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/admin/access-profiles", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "access_profile.read", {
        entityType: "accessProfile",
        tenantId: session.user.tenantId
      });

      return context.json({
        profiles: runtime.listProfiles(session.user.tenantId).map(accessProfileDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/admin/access-profiles", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "access_profile.write", {
        entityType: "accessProfile",
        tenantId: session.user.tenantId
      });

      const body = upsertAccessProfileSchema.parse(await parseJson(context));
      const profileId = body.id ?? `profile-${body.systemKey}-${session.user.tenantId}`;
      const existingProfile = runtime.getProfile(session.user.tenantId, profileId);

      if (existingProfile && body.version !== existingProfile.version) {
        return context.json(errorDto("conflict", "Версия профиля доступа устарела"), 409);
      }

      const permissionCatalog = runtime.permissionCatalog.filter((permission) => body.permissions.includes(permission.key));
      if (permissionCatalog.length !== body.permissions.length) {
        return context.json(errorDto("validation_error", "Запрошено неизвестное разрешение"), 400);
      }

      const profile = runtime.saveProfile({
        id: profileId,
        tenantId: session.user.tenantId,
        systemKey: body.systemKey,
        label: body.label,
        permissions: body.permissions,
        scopeRules: body.scopeRules.map((rule) => ({
          permissionKey: rule.permissionKey,
          scope: rule.scope,
          ...(rule.constraints !== undefined ? { constraints: rule.constraints } : {})
        })),
        active: body.active,
        version: existingProfile ? existingProfile.version + 1 : 1,
        updatedAt: runtime.now()
      });

      runtime.appendAuditEvent({
        session,
        actionKey: "access_profile.upsert",
        target: { entityType: "accessProfile", entityId: profile.id },
        details: {
          before: existingProfile ? accessProfileDto(existingProfile) : undefined,
          after: accessProfileDto(profile)
        }
      });

      return context.json(accessProfileDto(profile), existingProfile ? 200 : 201);
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/admin/labels", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "tenant_labels.write", {
        entityType: "tenantLabelSet",
        tenantId: session.user.tenantId
      });

      const body = updateTenantLabelSchema.parse(await parseJson(context));
      if (!Object.hasOwn(session.labelSet.labels, body.key)) {
        return context.json(errorDto("validation_error", "Метка не настроена для тенанта"), 400);
      }

      const result = runtime.updateLabelSet(session.user.tenantId, body);
      runtime.appendAuditEvent({
        session,
        actionKey: "tenant_label.update",
        target: { entityType: "tenantLabel", entityId: result.trace.changedLabel.key },
        details: {
          before: { label: result.trace.changedLabel.beforeLabel },
          after: { label: result.trace.changedLabel.afterLabel },
          previousConfigurationVersion: result.trace.previousConfigurationVersion,
          newConfigurationVersion: result.trace.configurationVersion,
          changedLabel: result.trace.changedLabel
        }
      });

      return context.json({
        tenantId: result.trace.tenantId,
        configurationVersion: result.trace.configurationVersion,
        previousConfigurationVersion: result.trace.previousConfigurationVersion,
        changedLabel: result.trace.changedLabel,
        labels: result.trace.labels
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/admin/permissions/evaluate", async (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "permission.diagnostics.read", {
        entityType: "permissionDiagnostics",
        tenantId: session.user.tenantId
      });

      const body = permissionDiagnosticsSchema.parse(await parseJson(context));
      const resolvedTargetTenantId = resolveDiagnosticsTargetTenantId(runtime, session, body);
      if (resolvedTargetTenantId === undefined) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      const evaluation = runtime.evaluatePolicy({
        session,
        permissionKey: body.permissionKey,
        target: {
          entityType: body.targetEntityType,
          tenantId: resolvedTargetTenantId
        },
        ...(body.requestedScope !== undefined ? { requestedScope: body.requestedScope } : {})
      });

      return context.json({
        allowed: evaluation.allowed,
        reasonCode: evaluation.reasonCode,
        ...(evaluation.scope !== undefined ? { scope: evaluation.scope } : {}),
        trace: evaluation.trace
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/tenant-isolation-probes/:probeId", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      const probeId = context.req.param("probeId");
      const probe = runtime.getProbe(probeId);
      if (!probe || probe.tenantId !== session.user.tenantId) {
        return context.json(errorDto("not_found", "Объект не найден"), 404);
      }

      assertAllowed(runtime, session, "tenant_probe.read", {
        entityType: "tenantIsolationProbe",
        tenantId: probe.tenantId,
        entityId: probe.id
      });

      return context.json({
        id: probe.id,
        tenantId: probe.tenantId,
        label: probe.label
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.get("/audit/events", (context) => {
    try {
      const session = requireSession(runtime, context.req.query("testUser"));
      assertAllowed(runtime, session, "audit.read", {
        entityType: "auditEvent",
        tenantId: session.user.tenantId
      });

      return context.json({
        events: runtime.auditStore.listByTenant(session.user.tenantId).map(auditEventDto)
      });
    } catch (error) {
      return handleRouteError(context, error);
    }
  });

  app.post("/test-fixtures/reset", (context) => {
    if (!options.allowTestFixtureReset) {
      return context.json(errorDto("test_mode_only", "Сброс фикстур доступен только в тестовом режиме"), 403);
    }

    runtime = createPhase2RuntimeState();
    return context.json({ status: "reset" });
  });

  return app;
}

export type ApiApp = ReturnType<typeof createApiApp>;

function hasModelErrorCode(error: Error): error is Error & { code: "validation_error" | "conflict" } {
  return "code" in error && (error.code === "validation_error" || error.code === "conflict");
}

function handleRouteError(context: Context, error: unknown) {
  if (error instanceof z.ZodError || (error instanceof Error && error.message === "invalid_json")) {
    return context.json(errorDto("validation_error", "Некорректный запрос"), 400);
  }

  if (error instanceof Error && error.message === "unauthenticated") {
    return context.json(errorDto("unauthenticated", "Требуется тестовый пользователь"), 401);
  }

  if (typeof error === "object" && error !== null && "code" in error && "status" in error) {
    const typedError = error as { code: ApiErrorCode; status: 403 };
    return context.json(errorDto(typedError.code, "Доступ запрещен"), typedError.status);
  }

  if (error instanceof Error && error.name === "TenantConfigModelError" && hasModelErrorCode(error)) {
    const code = error.code === "conflict" ? "conflict" : "validation_error";
    return context.json(
      errorDto(code, code === "conflict" ? "Конфликт версии конфигурации" : "Некорректный запрос"),
      code === "conflict" ? 409 : 400
    );
  }

  if (error instanceof Error && error.name === "AccessControlModelError" && hasModelErrorCode(error)) {
    const code = error.code === "conflict" ? "conflict" : "validation_error";
    return context.json(
      errorDto(code, code === "conflict" ? "Конфликт версии профиля доступа" : "Некорректный запрос"),
      code === "conflict" ? 409 : 400
    );
  }

  return context.json(errorDto("validation_error", "Не удалось обработать запрос"), 400);
}

function resolveDiagnosticsTargetTenantId(
  runtime: Phase2RuntimeState,
  session: Phase2RuntimeSession,
  body: z.infer<typeof permissionDiagnosticsSchema>
): string | undefined {
  if (body.targetEntityType === "tenantIsolationProbe" && body.targetEntityId !== undefined) {
    return runtime.getProbe(body.targetEntityId)?.tenantId;
  }

  return body.targetTenantId ?? session.user.tenantId;
}
