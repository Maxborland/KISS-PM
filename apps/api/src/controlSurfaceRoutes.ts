import { randomUUID } from "node:crypto";

import {
  canManageControlSurfaces,
  canPublishControlSurfaces,
  canReadControlSurfaces
} from "@kiss-pm/access-control";
import {
  createDefaultControlSurfacePresets,
  validateControlSurfaceDefinition,
  type ControlSurfaceDefinition,
  type ControlSurfaceRecord
} from "@kiss-pm/domain";

import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import { readLimitedJsonBody } from "./jsonBody";

export function registerControlSurfaceRoutes(app: ApiApp, deps: ApiRouteDeps) {
  app.get("/api/tenant/current/control-surfaces", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listControlSurfaces) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = canReadControlSurfaces({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "control_surface.read_denied",
        surfaceId: "__list__",
        permissionResult: decision
      });
      return context.json({ error: decision.reason }, 403);
    }
    const canReadBuilderState = canReadControlSurfaceBuilderState({ actor, profile });

    const includeArchived = context.req.query("includeArchived") === "true";
    const surfaces = (await deps.dataSource.listControlSurfaces(actor.tenantId))
      .filter((surface) => includeArchived || surface.status !== "archived")
      .filter((surface) => canReadBuilderState || surface.status === "published")
      .map((surface) => canReadBuilderState ? surface : toPublishedSurfaceReadModel(surface, profile))
      .filter((surface): surface is ControlSurfaceRecord | PublishedControlSurfaceReadModel => Boolean(surface));
    return context.json({ surfaces });
  });

  app.get("/api/tenant/current/control-surfaces/presets", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    const decision = canReadControlSurfaces({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "control_surface.presets_read_denied",
        surfaceId: "__presets__",
        permissionResult: decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    return context.json({
      presets: createDefaultControlSurfacePresets(actor.tenantId).map((definition) => ({
        definition,
        validation: validateControlSurfaceDefinition(definition)
      }))
    });
  });

  app.get("/api/tenant/current/control-surfaces/:surfaceId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.findControlSurface || !deps.dataSource.listControlSurfaceVersions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = canReadControlSurfaces({ actor, profile, targetTenantId: actor.tenantId });
    const surfaceId = context.req.param("surfaceId");
    if (!decision.allowed) {
      await appendDeniedAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "control_surface.read_denied",
        surfaceId,
        permissionResult: decision
      });
      return context.json({ error: decision.reason }, 403);
    }
    const canReadBuilderState = canReadControlSurfaceBuilderState({ actor, profile });

    const surface = await deps.dataSource.findControlSurface(actor.tenantId, surfaceId);
    if (!surface) return context.json({ error: "control_surface_not_found" }, 404);
    if (!canReadBuilderState) {
      const publishedSurface = toPublishedSurfaceReadModel(surface, profile);
      if (!publishedSurface) return context.json({ error: "control_surface_not_found" }, 404);
      return context.json({ surface: publishedSurface });
    }
    const versions = await deps.dataSource.listControlSurfaceVersions(actor.tenantId, surface.id);
    return context.json({ surface, versions });
  });

  app.post("/api/tenant/current/control-surfaces", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.upsertControlSurfaceDraft || !deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = canManageControlSurfaces({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "control_surface.draft_save_denied",
        surfaceId: "__new__",
        permissionResult: decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseSurfaceDefinitionBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const validation = validateControlSurfaceDefinition(parsed.value);
    const surface = await deps.dataSource.upsertControlSurfaceDraft({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      definition: parsed.value,
      ownerUserId: parseOwnerUserId(body.value)
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "control_surface_archived") {
        return "control_surface_archived" as const;
      }
      throw error;
    });
    if (surface === "control_surface_archived") {
      return context.json({ error: "control_surface_archived" }, 409);
    }
    const auditEventId = await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "control_surface.draft_saved",
      sourceWorkflow: "control_surfaces",
      sourceEntity: { type: "ControlSurface", id: surface.id },
      commandInput: { definition: parsed.value },
      beforeState: null,
      afterState: { surface, validation },
      permissionResult: decision,
      executionResult: { status: "succeeded" }
    });

    return context.json({ surface, validation, auditEventId }, 201);
  });

  app.post("/api/tenant/current/control-surfaces/:surfaceId/preview", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.findControlSurface) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = canManageControlSurfaces({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "control_surface.preview_denied",
        surfaceId: context.req.param("surfaceId"),
        permissionResult: decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseOptionalSurfaceDefinitionBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const stored = await deps.dataSource.findControlSurface(actor.tenantId, context.req.param("surfaceId"));
    if (!stored && !parsed.value) return context.json({ error: "control_surface_not_found" }, 404);
    const definition = parsed.value ?? stored?.draftDefinition;
    if (!definition) return context.json({ error: "control_surface_not_found" }, 404);

    const validation = validateControlSurfaceDefinition(definition);
    return context.json({
      validation,
      preview: {
        dataSource: definition.dataSource,
        entityType: definition.entityType,
        viewType: definition.viewType,
        visibleFieldCount: definition.fields.filter(
          (field: ControlSurfaceDefinition["fields"][number]) => field.visible
        ).length,
        actionCount: definition.actions.length
      }
    });
  });

  app.post("/api/tenant/current/control-surfaces/:surfaceId/publish", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.findControlSurface ||
      !deps.dataSource.publishControlSurface ||
      !deps.dataSource.appendAuditEvent ||
      !deps.dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = canPublishControlSurfaces({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "control_surface.publish_denied",
        surfaceId: context.req.param("surfaceId"),
        permissionResult: decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const surfaceId = context.req.param("surfaceId");
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.findControlSurface || !transactionDataSource.publishControlSurface) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      const before = await transactionDataSource.findControlSurface(actor.tenantId, surfaceId);
      if (!before) return { ok: false as const, status: 404, error: "control_surface_not_found" };
      if (before.status === "archived") {
        await appendControlSurfaceFailureAuditIfConfigured(deps, transactionDataSource, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "control_surface.publish_conflict",
          surfaceId,
          commandInput: { surfaceId },
          beforeState: { surface: before },
          permissionResult: decision,
          reason: "control_surface_archived"
        });
        return { ok: false as const, status: 409, error: "control_surface_archived" };
      }
      const validation = validateControlSurfaceDefinition(before.draftDefinition);
      if (!validation.canPublish) {
        await appendControlSurfaceFailureAuditIfConfigured(deps, transactionDataSource, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "control_surface.publish_blocked",
          surfaceId,
          commandInput: { surfaceId, draftVersion: before.draftVersion },
          beforeState: { surface: before },
          permissionResult: decision,
          reason: "control_surface_publish_blocked",
          validation
        });
        return {
          ok: false as const,
          status: 409,
          error: "control_surface_publish_blocked",
          validation
        };
      }
      const auditEventId = `audit-${randomUUID()}`;
      const published = await transactionDataSource.publishControlSurface({
        tenantId: actor.tenantId,
        surfaceId,
        actorUserId: actor.id,
        auditEventId
      });
      await deps.appendManagementAuditEvent(
        {
          auditEventId,
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "control_surface.published",
          sourceWorkflow: "control_surfaces",
          sourceEntity: { type: "ControlSurface", id: surfaceId },
          commandInput: { surfaceId, draftVersion: before.draftVersion },
          beforeState: { surface: before },
          afterState: { surface: published.surface, version: published.version },
          permissionResult: decision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return { ok: true as const, body: { ...published, validation, auditEventId } };
    });

    if (!result.ok) {
      if (result.status === 409) {
        if (result.error === "control_surface_archived") {
          return context.json({ error: result.error }, 409);
        }
        return context.json({ error: result.error, validation: result.validation }, 409);
      }
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      return context.json({ error: result.error }, 400);
    }
    return context.json(result.body);
  });

  app.post("/api/tenant/current/control-surfaces/:surfaceId/rollback", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.rollbackControlSurfaceToVersion || !deps.dataSource.appendAuditEvent || !deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = canPublishControlSurfaces({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "control_surface.rollback_denied",
        surfaceId: context.req.param("surfaceId"),
        permissionResult: decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const version = parseVersion(body.value);
    if (version === null) return context.json({ error: "control_surface_invalid" }, 400);
    const surfaceId = context.req.param("surfaceId");
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.findControlSurface || !transactionDataSource.rollbackControlSurfaceToVersion) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      const before = await transactionDataSource.findControlSurface(actor.tenantId, surfaceId);
      if (!before) return { ok: false as const, status: 404, error: "control_surface_version_not_found" };
      if (before.status === "archived") {
        await appendControlSurfaceFailureAuditIfConfigured(deps, transactionDataSource, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "control_surface.rollback_conflict",
          surfaceId,
          commandInput: { surfaceId, version },
          beforeState: { surface: before },
          permissionResult: decision,
          reason: "control_surface_archived"
        });
        return { ok: false as const, status: 409, error: "control_surface_archived" };
      }
      const auditEventId = `audit-${randomUUID()}`;
      const rollback = await transactionDataSource.rollbackControlSurfaceToVersion({
        tenantId: actor.tenantId,
        surfaceId,
        version,
        actorUserId: actor.id,
        auditEventId
      });
      if (!rollback) {
        await appendControlSurfaceFailureAuditIfConfigured(deps, transactionDataSource, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "control_surface.rollback_failed",
          surfaceId,
          commandInput: { surfaceId, version },
          beforeState: { surface: before },
          permissionResult: decision,
          reason: "control_surface_version_not_found"
        });
        return { ok: false as const, status: 404, error: "control_surface_version_not_found" };
      }
      await deps.appendManagementAuditEvent(
        {
          auditEventId,
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "control_surface.rolled_back",
          sourceWorkflow: "control_surfaces",
          sourceEntity: { type: "ControlSurface", id: surfaceId },
          commandInput: { surfaceId, version },
          beforeState: { surface: before },
          afterState: { surface: rollback.surface, version: rollback.version },
          permissionResult: decision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return { ok: true as const, body: { ...rollback, auditEventId } };
    });
    if (!result.ok) {
      if (result.status === 409) return context.json({ error: result.error }, 409);
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      return context.json({ error: result.error }, 400);
    }
    return context.json(result.body);
  });

  app.delete("/api/tenant/current/control-surfaces/:surfaceId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.archiveControlSurface || !deps.dataSource.appendAuditEvent || !deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = canPublishControlSurfaces({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await appendDeniedAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "control_surface.archive_denied",
        surfaceId: context.req.param("surfaceId"),
        permissionResult: decision
      });
      return context.json({ error: decision.reason }, 403);
    }

    const surfaceId = context.req.param("surfaceId");
    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.findControlSurface || !transactionDataSource.archiveControlSurface) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      const before = await transactionDataSource.findControlSurface(actor.tenantId, surfaceId);
      const surface = await transactionDataSource.archiveControlSurface({
        tenantId: actor.tenantId,
        surfaceId,
        actorUserId: actor.id
      });
      if (!before || !surface) {
        await appendControlSurfaceFailureAuditIfConfigured(deps, transactionDataSource, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "control_surface.archive_failed",
          surfaceId,
          commandInput: { surfaceId },
          beforeState: before ? { surface: before } : null,
          permissionResult: decision,
          reason: "control_surface_not_found"
        });
        return { ok: false as const, status: 404, error: "control_surface_not_found" };
      }
      const auditEventId = await deps.appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "control_surface.archived",
          sourceWorkflow: "control_surfaces",
          sourceEntity: { type: "ControlSurface", id: surfaceId },
          commandInput: { surfaceId },
          beforeState: { surface: before },
          afterState: { surface },
          permissionResult: decision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return { ok: true as const, body: { surface, auditEventId } };
    });
    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      return context.json({ error: result.error }, 400);
    }
    return context.json(result.body);
  });
}

function parseSurfaceDefinitionBody(
  input: unknown,
  tenantId: string
): { ok: true; value: ControlSurfaceDefinition } | { ok: false; error: string } {
  const candidate = extractDefinition(input);
  if (!candidate) return { ok: false, error: "control_surface_invalid" };
  const definition = normalizeDefinition(candidate, tenantId);
  if (!definition) return { ok: false, error: "control_surface_invalid" };
  return { ok: true, value: definition };
}

function parseOptionalSurfaceDefinitionBody(
  input: unknown,
  tenantId: string
): { ok: true; value: ControlSurfaceDefinition | null } | { ok: false; error: string } {
  if (!isObject(input) || !("definition" in input)) return { ok: true, value: null };
  return parseSurfaceDefinitionBody(input, tenantId);
}

function extractDefinition(input: unknown): Record<string, unknown> | null {
  if (!isObject(input)) return null;
  const nested = input.definition;
  if (isObject(nested)) return nested;
  return input;
}

function normalizeDefinition(
  candidate: Record<string, unknown>,
  tenantId: string
): ControlSurfaceDefinition | null {
  const id = stringField(candidate, "id");
  const code = stringField(candidate, "code");
  const name = stringField(candidate, "name");
  if (!id || !code || !name) return null;
  return {
    id,
    tenantId,
    code,
    name,
    description: nullableStringField(candidate, "description"),
    dataSource: candidate.dataSource as ControlSurfaceDefinition["dataSource"],
    entityType: candidate.entityType as ControlSurfaceDefinition["entityType"],
    viewType: candidate.viewType as ControlSurfaceDefinition["viewType"],
    fields: Array.isArray(candidate.fields) ? (candidate.fields as ControlSurfaceDefinition["fields"]) : [],
    filters: Array.isArray(candidate.filters) ? (candidate.filters as ControlSurfaceDefinition["filters"]) : [],
    groupings: Array.isArray(candidate.groupings)
      ? (candidate.groupings as ControlSurfaceDefinition["groupings"])
      : [],
    widgets: Array.isArray(candidate.widgets) ? (candidate.widgets as ControlSurfaceDefinition["widgets"]) : [],
    severityRules: Array.isArray(candidate.severityRules)
      ? (candidate.severityRules as ControlSurfaceDefinition["severityRules"])
      : [],
    drilldowns: Array.isArray(candidate.drilldowns)
      ? (candidate.drilldowns as ControlSurfaceDefinition["drilldowns"])
      : [],
    actions: Array.isArray(candidate.actions) ? (candidate.actions as ControlSurfaceDefinition["actions"]) : [],
    requiredPermissions: Array.isArray(candidate.requiredPermissions)
      ? (candidate.requiredPermissions as string[])
      : [],
    savedViewPolicy:
      candidate.savedViewPolicy === "none" || candidate.savedViewPolicy === "tenant"
        ? candidate.savedViewPolicy
        : "user",
    auditPolicy: candidate.auditPolicy === "all_mutations" ? "all_mutations" : "publish_only"
  };
}

function parseOwnerUserId(input: unknown): string | null {
  if (!isObject(input)) return null;
  return nullableStringField(input, "ownerUserId");
}

function parseVersion(input: unknown): number | null {
  if (!isObject(input) || typeof input.version !== "number" || !Number.isInteger(input.version) || input.version < 1) {
    return null;
  }
  return input.version;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function nullableStringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  if (value === null || value === undefined) return null;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

type PublishedControlSurfaceReadModel = Pick<
  ControlSurfaceRecord,
  | "id"
  | "tenantId"
  | "code"
  | "name"
  | "description"
  | "ownerUserId"
  | "status"
  | "currentVersion"
  | "publishedDefinition"
  | "createdAt"
  | "updatedAt"
  | "publishedAt"
>;

function canReadControlSurfaceBuilderState(input: {
  actor: Parameters<typeof canManageControlSurfaces>[0]["actor"];
  profile: Parameters<typeof canManageControlSurfaces>[0]["profile"];
}): boolean {
  const policyInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };
  return (
    canManageControlSurfaces(policyInput).allowed ||
    canPublishControlSurfaces(policyInput).allowed
  );
}

function toPublishedSurfaceReadModel(
  surface: ControlSurfaceRecord,
  profile: Parameters<typeof canManageControlSurfaces>[0]["profile"]
): PublishedControlSurfaceReadModel | null {
  if (surface.status !== "published" || !surface.publishedDefinition) return null;
  const grantedPermissions = new Set<string>(profile.permissions);
  const canReadSurface = surface.publishedDefinition.requiredPermissions.every((permission) =>
    grantedPermissions.has(permission)
  );
  if (!canReadSurface) return null;
  return {
    id: surface.id,
    tenantId: surface.tenantId,
    code: surface.code,
    name: surface.name,
    description: surface.description,
    ownerUserId: surface.ownerUserId,
    status: "published",
    currentVersion: surface.currentVersion,
    publishedDefinition: {
      ...surface.publishedDefinition,
      actions: surface.publishedDefinition.actions.filter((action) =>
        action.requiredPermissions.every((permission) => grantedPermissions.has(permission))
      )
    },
    createdAt: surface.createdAt,
    updatedAt: surface.updatedAt,
    publishedAt: surface.publishedAt
  };
}

async function appendDeniedAuditIfConfigured(
  deps: ApiRouteDeps,
  input: {
    tenantId: string;
    actorUserId: string;
    actionType: string;
    surfaceId: string;
    permissionResult: Record<string, unknown>;
  }
) {
  if (!deps.dataSource.appendAuditEvent) return;
  await deps.appendManagementAuditEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actionType: input.actionType,
    sourceWorkflow: "control_surfaces",
    sourceEntity: { type: "ControlSurface", id: input.surfaceId },
    commandInput: { surfaceId: input.surfaceId },
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: { status: "denied" }
  });
}

async function appendControlSurfaceFailureAuditIfConfigured(
  deps: ApiRouteDeps,
  auditDataSource: ApiRouteDeps["dataSource"],
  input: {
    tenantId: string;
    actorUserId: string;
    actionType: string;
    surfaceId: string;
    commandInput: Record<string, unknown>;
    beforeState: Record<string, unknown> | null;
    permissionResult: Record<string, unknown>;
    reason: string;
    validation?: Record<string, unknown>;
  }
) {
  if (!auditDataSource.appendAuditEvent) return;
  await deps.appendManagementAuditEvent(
    {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actionType: input.actionType,
      sourceWorkflow: "control_surfaces",
      sourceEntity: { type: "ControlSurface", id: input.surfaceId },
      commandInput: input.commandInput,
      beforeState: input.beforeState,
      afterState: null,
      permissionResult: input.permissionResult,
      executionResult: {
        status: "failed",
        reason: input.reason,
        ...(input.validation ? { validation: input.validation } : {})
      }
    },
    auditDataSource
  );
}
