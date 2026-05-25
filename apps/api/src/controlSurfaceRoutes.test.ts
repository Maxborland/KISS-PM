import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import type {
  ControlSurfaceDefinition,
  ControlSurfaceRecord,
  ControlSurfaceVersionRecord,
  TenantUser
} from "@kiss-pm/domain";

import { createApp } from "./app";
import type { ApiTenantDataSource, AuditEventListItem } from "./apiTypes";

describe("control surface routes", () => {
  it("saves, previews, publishes and rolls back a versioned surface with audit", async () => {
    const state = createSurfaceDataSource();
    const app = createApp({ dataSource: state.dataSource });
    const definition = createDefinition();

    const createResponse = await app.request("/api/tenant/current/control-surfaces", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ definition })
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { surface: ControlSurfaceRecord };
    expect(created.surface.status).toBe("draft");

    const previewResponse = await app.request(`/api/tenant/current/control-surfaces/${definition.id}/preview`, {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({})
    });
    expect(previewResponse.status).toBe(200);
    await expect(previewResponse.json()).resolves.toMatchObject({
      validation: { canPublish: true, issues: [] },
      preview: { dataSource: "project_delivery", viewType: "gantt", visibleFieldCount: 1 }
    });

    const publishResponse = await app.request(`/api/tenant/current/control-surfaces/${definition.id}/publish`, {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({})
    });
    expect(publishResponse.status).toBe(200);
    const published = (await publishResponse.json()) as {
      surface: ControlSurfaceRecord;
      version: ControlSurfaceVersionRecord;
      auditEventId: string;
    };
    expect(published.surface.currentVersion).toBe(1);
    expect(published.version.version).toBe(1);
    expect(published.version.auditEventId).toBe(published.auditEventId);

    await app.request("/api/tenant/current/control-surfaces", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ definition: { ...definition, name: "Project Delivery v2" } })
    });
    await app.request(`/api/tenant/current/control-surfaces/${definition.id}/publish`, {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({})
    });

    const rollbackResponse = await app.request(`/api/tenant/current/control-surfaces/${definition.id}/rollback`, {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ version: 1 })
    });
    expect(rollbackResponse.status).toBe(200);
    const rollback = (await rollbackResponse.json()) as {
      surface: ControlSurfaceRecord;
      version: ControlSurfaceVersionRecord;
      auditEventId: string;
    };
    expect(rollback.surface.currentVersion).toBe(3);
    expect(rollback.surface.publishedDefinition?.name).toBe("Project Delivery");
    expect(rollback.version.auditEventId).toBe(rollback.auditEventId);
    expect(state.auditEvents.map((event) => event.actionType)).toEqual(
      expect.arrayContaining([
        "control_surface.draft_saved",
        "control_surface.published",
        "control_surface.rolled_back"
      ])
    );
  });

  it("returns guided presets and hides archived surfaces from default list", async () => {
    const state = createSurfaceDataSource();
    const app = createApp({ dataSource: state.dataSource });

    const presetsResponse = await app.request("/api/tenant/current/control-surfaces/presets", {
      headers: { cookie: "kiss_pm_session=session-alpha" }
    });
    expect(presetsResponse.status).toBe(200);
    const presetsBody = (await presetsResponse.json()) as {
      presets: Array<{ definition: ControlSurfaceDefinition; validation: { canPublish: boolean } }>;
    };
    expect(presetsBody.presets.length).toBeGreaterThanOrEqual(3);
    expect(presetsBody.presets.every((preset) => preset.validation.canPublish)).toBe(true);

    const definition = createDefinition();
    await app.request("/api/tenant/current/control-surfaces", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ definition })
    });
    const archiveResponse = await app.request(`/api/tenant/current/control-surfaces/${definition.id}`, {
      method: "DELETE",
      headers: mutationHeaders()
    });
    expect(archiveResponse.status).toBe(200);

    const draftSaveResponse = await app.request("/api/tenant/current/control-surfaces", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({
        definition: { ...definition, name: "Implicit unarchive attempt" }
      })
    });
    expect(draftSaveResponse.status).toBe(409);
    await expect(draftSaveResponse.json()).resolves.toEqual({ error: "control_surface_archived" });

    const listResponse = await app.request("/api/tenant/current/control-surfaces", {
      headers: { cookie: "kiss_pm_session=session-alpha" }
    });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({ surfaces: [] });

    const archivedListResponse = await app.request(
      "/api/tenant/current/control-surfaces?includeArchived=true",
      { headers: { cookie: "kiss_pm_session=session-alpha" } }
    );
    expect(archivedListResponse.status).toBe(200);
    await expect(archivedListResponse.json()).resolves.toMatchObject({
      surfaces: [expect.objectContaining({ id: definition.id, status: "archived" })]
    });
  });

  it("blocks publish when the draft definition is invalid", async () => {
    const state = createSurfaceDataSource();
    const app = createApp({ dataSource: state.dataSource });
    const definition = createDefinition({ fields: [] });
    await app.request("/api/tenant/current/control-surfaces", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ definition })
    });

    const response = await app.request(`/api/tenant/current/control-surfaces/${definition.id}/publish`, {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({})
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "control_surface_publish_blocked",
      validation: {
        canPublish: false,
        issues: [expect.objectContaining({ code: "visible_field_required" })]
      }
    });
  });

  it("requires explicit control surface manage/publish permissions", async () => {
    const state = createSurfaceDataSource({
      permissions: ["tenant.control_surfaces.read"]
    });
    const app = createApp({ dataSource: state.dataSource });

    const response = await app.request("/api/tenant/current/control-surfaces", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ definition: createDefinition() })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        actionType: "control_surface.draft_save_denied",
        executionResult: { status: "denied" }
      })
    ]);
  });

  it("requires read permission and separately blocks publish without publish permission", async () => {
    const noReadState = createSurfaceDataSource({ permissions: [] });
    const noReadApp = createApp({ dataSource: noReadState.dataSource });

    const listResponse = await noReadApp.request("/api/tenant/current/control-surfaces", {
      headers: { cookie: "kiss_pm_session=session-alpha" }
    });
    expect(listResponse.status).toBe(403);
    await expect(listResponse.json()).resolves.toEqual({ error: "permission_missing" });

    const noPublishState = createSurfaceDataSource({
      permissions: ["tenant.control_surfaces.read", "tenant.control_surfaces.manage"]
    });
    const noPublishApp = createApp({ dataSource: noPublishState.dataSource });
    const definition = createDefinition();
    await noPublishApp.request("/api/tenant/current/control-surfaces", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({ definition })
    });

    const publishResponse = await noPublishApp.request(
      `/api/tenant/current/control-surfaces/${definition.id}/publish`,
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({})
      }
    );

    expect(publishResponse.status).toBe(403);
    await expect(publishResponse.json()).resolves.toEqual({ error: "permission_missing" });
    expect(noPublishState.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "control_surface.publish_denied",
          executionResult: { status: "denied" }
        })
      ])
    );
  });

  it("hides draft definitions and version history from read-only users", async () => {
    const state = createSurfaceDataSource({ permissions: ["tenant.control_surfaces.read"] });
    const app = createApp({ dataSource: state.dataSource });
    const publishedDefinition = createDefinition();
    await state.dataSource.upsertControlSurfaceDraft?.({
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      definition: publishedDefinition
    });
    await state.dataSource.publishControlSurface?.({
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      surfaceId: publishedDefinition.id,
      auditEventId: "audit-published"
    });
    await state.dataSource.upsertControlSurfaceDraft?.({
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      definition: { ...publishedDefinition, name: "Unpublished draft name" }
    });
    await state.dataSource.upsertControlSurfaceDraft?.({
      tenantId: "tenant-alpha",
      actorUserId: "user-alpha-admin",
      definition: { ...createDefinition(), id: "surface-draft-only", code: "draft-only" }
    });

    const listResponse = await app.request("/api/tenant/current/control-surfaces", {
      headers: { cookie: "kiss_pm_session=session-alpha" }
    });
    expect(listResponse.status).toBe(200);
    const listBody = (await listResponse.json()) as { surfaces: Array<Record<string, unknown>> };
    expect(listBody.surfaces).toHaveLength(1);
    expect(listBody.surfaces[0]).toMatchObject({
      id: publishedDefinition.id,
      status: "published",
      publishedDefinition: expect.objectContaining({ name: "Project Delivery" })
    });
    expect(listBody.surfaces[0]).not.toHaveProperty("draftDefinition");

    const detailResponse = await app.request(
      `/api/tenant/current/control-surfaces/${publishedDefinition.id}`,
      { headers: { cookie: "kiss_pm_session=session-alpha" } }
    );
    expect(detailResponse.status).toBe(200);
    const detailBody = (await detailResponse.json()) as {
      surface: Record<string, unknown>;
      versions?: unknown;
    };
    expect(detailBody).not.toHaveProperty("versions");
    expect(detailBody.surface).not.toHaveProperty("draftDefinition");
    expect(detailBody.surface.publishedDefinition).toMatchObject({ name: "Project Delivery" });

    const draftDetailResponse = await app.request(
      "/api/tenant/current/control-surfaces/surface-draft-only",
      { headers: { cookie: "kiss_pm_session=session-alpha" } }
    );
    expect(draftDetailResponse.status).toBe(404);
    await expect(draftDetailResponse.json()).resolves.toEqual({ error: "control_surface_not_found" });
  });

  it("does not crash on malformed action bindings and returns validation issues", async () => {
    const state = createSurfaceDataSource();
    const app = createApp({ dataSource: state.dataSource });
    const response = await app.request("/api/tenant/current/control-surfaces", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({
        definition: createDefinition({
          actions: [
            {
              id: "bad",
              label: "Bad",
              actionKey: "open_gantt",
              scope: "row"
            } as ControlSurfaceDefinition["actions"][number]
          ]
        })
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      validation: {
        canPublish: false,
        issues: [
          expect.objectContaining({
            code: "action_permissions_invalid",
            path: "actions.0.requiredPermissions"
          }),
          expect.objectContaining({
            code: "action_permission_missing",
            path: "actions.0.requiredPermissions"
          })
        ]
      }
    });
  });
});

function createSurfaceDataSource(input: { permissions?: AccessProfile["permissions"] } = {}) {
  const actor: TenantUser = {
    id: "user-alpha-admin",
    tenantId: "tenant-alpha",
    name: "Анна Администратор",
    accessProfileId: "profile-alpha"
  };
  const profile: AccessProfile = {
    id: "profile-alpha",
    permissions:
      input.permissions ?? [
        "tenant.control_surfaces.read",
        "tenant.control_surfaces.manage",
        "tenant.control_surfaces.publish"
      ]
  };
  const surfaces: ControlSurfaceRecord[] = [];
  const versions: ControlSurfaceVersionRecord[] = [];
  const auditEvents: AuditEventListItem[] = [];

  const dataSource: ApiTenantDataSource = {
    async listDevUsers() {
      return [actor];
    },
    async findUserById(userId) {
      return userId === actor.id ? actor : undefined;
    },
    async findTenantById(tenantId) {
      return tenantId === actor.tenantId ? { id: tenantId, name: "Альфа Проект" } : undefined;
    },
    async listUsersByTenantId() {
      return [actor];
    },
    async findAccessProfileById() {
      return profile;
    },
    async findSessionByTokenHash() {
      return {
        id: "session-alpha",
        tenantId: actor.tenantId,
        userId: actor.id,
        tokenHash: "hash",
        expiresAt: new Date("2030-01-01T00:00:00.000Z")
      };
    },
    async withTransaction(operation) {
      return operation(dataSource);
    },
    async listControlSurfaces(tenantId) {
      return surfaces.filter((surface) => surface.tenantId === tenantId);
    },
    async findControlSurface(tenantId, surfaceId) {
      return surfaces.find((surface) => surface.tenantId === tenantId && surface.id === surfaceId);
    },
    async upsertControlSurfaceDraft({ tenantId, actorUserId, definition, ownerUserId }) {
      const existing = surfaces.find(
        (surface) => surface.tenantId === tenantId && surface.id === definition.id
      );
      const now = new Date("2026-05-25T10:00:00.000Z").toISOString();
      if (existing) {
        if (existing.status === "archived") {
          throw new Error("control_surface_archived");
        }
        existing.name = definition.name;
        existing.description = definition.description;
        existing.ownerUserId = ownerUserId ?? existing.ownerUserId;
        existing.draftDefinition = definition;
        existing.updatedByUserId = actorUserId;
        existing.updatedAt = now;
        return existing;
      }
      const surface: ControlSurfaceRecord = {
        id: definition.id,
        tenantId,
        code: definition.code,
        name: definition.name,
        description: definition.description,
        ownerUserId: ownerUserId ?? null,
        status: "draft",
        currentVersion: 0,
        draftVersion: 1,
        draftDefinition: definition,
        publishedDefinition: null,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        archivedAt: null
      };
      surfaces.push(surface);
      return surface;
    },
    async publishControlSurface({ tenantId, surfaceId, actorUserId, auditEventId }) {
      const surface = surfaces.find((candidate) => candidate.tenantId === tenantId && candidate.id === surfaceId);
      if (!surface) throw new Error("control_surface_not_found");
      const version: ControlSurfaceVersionRecord = {
        tenantId,
        surfaceId,
        version: surface.draftVersion,
        definition: surface.draftDefinition,
        publishedByUserId: actorUserId,
        auditEventId: auditEventId ?? null,
        createdAt: "2026-05-25T10:05:00.000Z"
      };
      versions.push(version);
      surface.status = "published";
      surface.currentVersion = surface.draftVersion;
      surface.draftVersion += 1;
      surface.publishedDefinition = surface.draftDefinition;
      surface.publishedAt = version.createdAt;
      return { surface, version };
    },
    async listControlSurfaceVersions(tenantId, surfaceId) {
      return versions.filter((version) => version.tenantId === tenantId && version.surfaceId === surfaceId);
    },
    async rollbackControlSurfaceToVersion({ tenantId, surfaceId, version, actorUserId, auditEventId }) {
      const surface = surfaces.find((candidate) => candidate.tenantId === tenantId && candidate.id === surfaceId);
      const target = versions.find(
        (candidate) =>
          candidate.tenantId === tenantId && candidate.surfaceId === surfaceId && candidate.version === version
      );
      if (!surface || !target) return undefined;
      const rollbackVersion: ControlSurfaceVersionRecord = {
        tenantId,
        surfaceId,
        version: surface.currentVersion + 1,
        definition: target.definition,
        publishedByUserId: actorUserId,
        auditEventId: auditEventId ?? null,
        createdAt: "2026-05-25T10:10:00.000Z"
      };
      versions.push(rollbackVersion);
      surface.currentVersion = rollbackVersion.version;
      surface.draftVersion = rollbackVersion.version + 1;
      surface.draftDefinition = target.definition;
      surface.publishedDefinition = target.definition;
      return { surface, version: rollbackVersion };
    },
    async archiveControlSurface({ tenantId, surfaceId, actorUserId }) {
      const surface = surfaces.find((candidate) => candidate.tenantId === tenantId && candidate.id === surfaceId);
      if (!surface) return undefined;
      surface.status = "archived";
      surface.updatedByUserId = actorUserId;
      surface.archivedAt = "2026-05-25T10:15:00.000Z";
      return surface;
    },
    async appendAuditEvent(input) {
      auditEvents.unshift({
        ...input,
        sourceSurfaceId: input.sourceSurfaceId ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null
      });
    }
  };

  return { dataSource, auditEvents };
}

function mutationHeaders() {
  return {
    "content-type": "application/json",
    cookie: "kiss_pm_session=session-alpha",
    "x-kiss-pm-action": "same-origin"
  };
}

function createDefinition(
  patch: Partial<ControlSurfaceDefinition> = {}
): ControlSurfaceDefinition {
  return {
    id: "surface-delivery",
    tenantId: "tenant-alpha",
    code: "project-delivery",
    name: "Project Delivery",
    description: null,
    dataSource: "project_delivery",
    entityType: "project",
    viewType: "gantt",
    fields: [{ id: "title", label: "Название", sourceField: "title", visible: true }],
    filters: [],
    groupings: [],
    widgets: [],
    severityRules: [],
    drilldowns: [],
    actions: [
      {
        id: "open-gantt",
        label: "Открыть график",
        actionKey: "open_gantt",
        scope: "row",
        requiredPermissions: ["tenant.project_plan.read"]
      }
    ],
    requiredPermissions: ["tenant.projects.read"],
    savedViewPolicy: "user",
    auditPolicy: "publish_only",
    ...patch
  };
}
