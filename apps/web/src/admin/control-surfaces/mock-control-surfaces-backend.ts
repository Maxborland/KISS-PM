/* ============================================================
   Contract-grounded mock backend для control-surfaces (Storybook / тесты).

   ЧЕСТНОСТЬ: in-memory мок реального REST-контракта controlSurfaceRoutes:
     GET  /api/tenant/current/control-surfaces[?includeArchived=true]
     GET  /api/tenant/current/control-surfaces/:id
     POST /api/tenant/current/control-surfaces/:id/preview
     POST /api/tenant/current/control-surfaces/:id/publish
     POST /api/tenant/current/control-surfaces/:id/rollback
   Компонент работает через настоящий createControlSurfacesClient (с fetchImpl),
   поэтому переключение на боевой API = смена apiOrigin. Валидация и коды
   (control_surface_publish_blocked / control_surface_archived / *_not_found)
   зеркалят apps/api. Публикация и откат реально мутируют состояние и версии,
   а квитанция (auditEventId) — как у боевого appendManagementAuditEvent.
   ============================================================ */

import {
  createDefaultControlSurfacePresets,
  validateControlSurfaceDefinition,
  type ControlSurfaceDefinition,
  type ControlSurfaceRecord,
  type ControlSurfaceVersionRecord
} from "@kiss-pm/domain";

const TENANT = "tenant-alpha";
const ACTOR = "user-anna";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  json({ error, ...extra }, status);

const previewOf = (definition: ControlSurfaceDefinition) => ({
  dataSource: definition.dataSource,
  entityType: definition.entityType,
  viewType: definition.viewType,
  visibleFieldCount: definition.fields.filter((field) => field.visible).length,
  actionCount: definition.actions.length
});

const auditId = (): string => {
  const c: Crypto | undefined = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  return c && typeof c.randomUUID === "function"
    ? `audit-${c.randomUUID()}`
    : `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

type Store = { surfaces: ControlSurfaceRecord[]; versions: ControlSurfaceVersionRecord[] };

function seed(): Store {
  const presets = createDefaultControlSurfacePresets(TENANT);
  const surfaces: ControlSurfaceRecord[] = [];
  const versions: ControlSurfaceVersionRecord[] = [];
  const t = (iso: string) => new Date(iso).toISOString();

  const [intake, kpi, third] = presets;

  // Поверхность A: опубликована (2 версии), черновик == опубликованному (нет ожидающих правок).
  if (intake) {
    surfaces.push({
      id: intake.id,
      tenantId: TENANT,
      code: intake.code,
      name: intake.name,
      description: intake.description,
      ownerUserId: ACTOR,
      status: "published",
      currentVersion: 2,
      draftVersion: 3,
      draftDefinition: intake,
      publishedDefinition: intake,
      createdByUserId: ACTOR,
      updatedByUserId: ACTOR,
      createdAt: t("2026-05-01T09:00:00.000Z"),
      updatedAt: t("2026-05-20T09:00:00.000Z"),
      publishedAt: t("2026-05-20T09:00:00.000Z"),
      archivedAt: null
    });
    versions.push(
      { tenantId: TENANT, surfaceId: intake.id, version: 1, definition: intake, publishedByUserId: ACTOR, auditEventId: "audit-intake-1", createdAt: t("2026-05-10T09:00:00.000Z") },
      { tenantId: TENANT, surfaceId: intake.id, version: 2, definition: intake, publishedByUserId: ACTOR, auditEventId: "audit-intake-2", createdAt: t("2026-05-20T09:00:00.000Z") }
    );
  }

  // Поверхность B: опубликована v1, черновик с ожидающими правками (можно опубликовать v2).
  if (kpi) {
    const draft: ControlSurfaceDefinition = { ...kpi, name: `${kpi.name} (черновик v2)` };
    surfaces.push({
      id: kpi.id,
      tenantId: TENANT,
      code: kpi.code,
      name: kpi.name,
      description: kpi.description,
      ownerUserId: ACTOR,
      status: "published",
      currentVersion: 1,
      draftVersion: 2,
      draftDefinition: draft,
      publishedDefinition: kpi,
      createdByUserId: ACTOR,
      updatedByUserId: ACTOR,
      createdAt: t("2026-05-02T09:00:00.000Z"),
      updatedAt: t("2026-05-21T09:00:00.000Z"),
      publishedAt: t("2026-05-15T09:00:00.000Z"),
      archivedAt: null
    });
    versions.push({ tenantId: TENANT, surfaceId: kpi.id, version: 1, definition: kpi, publishedByUserId: ACTOR, auditEventId: "audit-kpi-1", createdAt: t("2026-05-15T09:00:00.000Z") });
  }

  // Поверхность C: только черновик (никогда не публиковалась), но невалидна — публикация заблокирована.
  if (third) {
    const invalidDraft: ControlSurfaceDefinition = { ...third, id: "surface-draft-invalid", code: "draft-invalid", name: "Черновик без видимых полей", fields: [] };
    surfaces.push({
      id: invalidDraft.id,
      tenantId: TENANT,
      code: invalidDraft.code,
      name: invalidDraft.name,
      description: invalidDraft.description,
      ownerUserId: ACTOR,
      status: "draft",
      currentVersion: 0,
      draftVersion: 1,
      draftDefinition: invalidDraft,
      publishedDefinition: null,
      createdByUserId: ACTOR,
      updatedByUserId: ACTOR,
      createdAt: t("2026-05-22T09:00:00.000Z"),
      updatedAt: t("2026-05-22T09:00:00.000Z"),
      publishedAt: null,
      archivedAt: null
    });
  }

  return { surfaces, versions };
}

export function createMockControlSurfacesFetch(): typeof fetch {
  const db = seed();
  const find = (id: string) => db.surfaces.find((surface) => surface.id === id);

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]!;
    const query = new URL(url, "http://x").searchParams;
    const base = "/api/tenant/current/control-surfaces";

    // Список поверхностей.
    if (path === base && method === "GET") {
      const includeArchived = query.get("includeArchived") === "true";
      const surfaces = db.surfaces.filter((surface) => includeArchived || surface.status !== "archived");
      return json({ surfaces });
    }

    const idMatch = /^\/api\/tenant\/current\/control-surfaces\/([^/]+)$/.exec(path);
    const actionMatch = /^\/api\/tenant\/current\/control-surfaces\/([^/]+)\/(preview|publish|rollback)$/.exec(path);

    // Карточка + версии.
    if (idMatch && method === "GET") {
      const surface = find(decodeURIComponent(idMatch[1]!));
      if (!surface) return err("control_surface_not_found", 404);
      const versions = db.versions.filter((version) => version.surfaceId === surface.id);
      return json({ surface, versions });
    }

    // Предпросмотр чернового определения.
    if (actionMatch && actionMatch[2] === "preview" && method === "POST") {
      const surface = find(decodeURIComponent(actionMatch[1]!));
      if (!surface) return err("control_surface_not_found", 404);
      const validation = validateControlSurfaceDefinition(surface.draftDefinition);
      return json({ validation, preview: previewOf(surface.draftDefinition) });
    }

    // Публикация хранимого черновика.
    if (actionMatch && actionMatch[2] === "publish" && method === "POST") {
      const surface = find(decodeURIComponent(actionMatch[1]!));
      if (!surface) return err("control_surface_not_found", 404);
      if (surface.status === "archived") return err("control_surface_archived", 409);
      const validation = validateControlSurfaceDefinition(surface.draftDefinition);
      if (!validation.canPublish) return err("control_surface_publish_blocked", 409, { validation });
      const nowIso = new Date().toISOString();
      const version: ControlSurfaceVersionRecord = {
        tenantId: TENANT,
        surfaceId: surface.id,
        version: surface.draftVersion,
        definition: surface.draftDefinition,
        publishedByUserId: ACTOR,
        auditEventId: auditId(),
        createdAt: nowIso
      };
      db.versions.push(version);
      surface.status = "published";
      surface.currentVersion = surface.draftVersion;
      surface.draftVersion += 1;
      surface.publishedDefinition = surface.draftDefinition;
      surface.publishedAt = nowIso;
      surface.updatedAt = nowIso;
      return json({ surface, version, validation, auditEventId: version.auditEventId });
    }

    // Откат к выбранной версии.
    if (actionMatch && actionMatch[2] === "rollback" && method === "POST") {
      const surface = find(decodeURIComponent(actionMatch[1]!));
      if (!surface) return err("control_surface_version_not_found", 404);
      if (surface.status === "archived") return err("control_surface_archived", 409);
      let requested: unknown = null;
      if (init?.body) {
        try {
          requested = JSON.parse(String(init.body));
        } catch {
          return err("invalid_json", 400);
        }
      }
      const version = (requested as { version?: unknown } | null)?.version;
      if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
        return err("control_surface_invalid", 400);
      }
      const target = db.versions.find((candidate) => candidate.surfaceId === surface.id && candidate.version === version);
      if (!target) return err("control_surface_version_not_found", 404);
      const nowIso = new Date().toISOString();
      const rollbackVersion: ControlSurfaceVersionRecord = {
        tenantId: TENANT,
        surfaceId: surface.id,
        version: surface.currentVersion + 1,
        definition: target.definition,
        publishedByUserId: ACTOR,
        auditEventId: auditId(),
        createdAt: nowIso
      };
      db.versions.push(rollbackVersion);
      surface.currentVersion = rollbackVersion.version;
      surface.draftVersion = rollbackVersion.version + 1;
      surface.draftDefinition = target.definition;
      surface.publishedDefinition = target.definition;
      surface.updatedAt = nowIso;
      return json({ surface, version: rollbackVersion, auditEventId: rollbackVersion.auditEventId });
    }

    return err("not_found", 404);
  };

  return mockFetch;
}
