import { and, asc, desc, eq, or } from "drizzle-orm";

import type {
  ControlSurfaceDefinition,
  ControlSurfaceRecord,
  ControlSurfaceVersionRecord
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { controlSurfaceDefinitions, controlSurfaceVersions } from "./schema";

export type { ControlSurfaceRecord, ControlSurfaceVersionRecord } from "@kiss-pm/domain";

export type ControlSurfaceDraftInput = {
  tenantId: string;
  actorUserId: string;
  definition: ControlSurfaceDefinition;
  ownerUserId?: string | null;
};

export type ControlSurfacePublishInput = {
  tenantId: string;
  surfaceId: string;
  actorUserId: string;
  auditEventId?: string | null;
};

export type ControlSurfaceArchiveInput = {
  tenantId: string;
  surfaceId: string;
  actorUserId: string;
};

export type ControlSurfaceRollbackInput = {
  tenantId: string;
  surfaceId: string;
  version: number;
  actorUserId: string;
  auditEventId?: string | null;
};

export type ControlSurfaceRepository = {
  listControlSurfaces(tenantId: string): Promise<ControlSurfaceRecord[]>;
  findControlSurface(tenantId: string, surfaceId: string): Promise<ControlSurfaceRecord | undefined>;
  upsertControlSurfaceDraft(input: ControlSurfaceDraftInput): Promise<ControlSurfaceRecord>;
  publishControlSurface(input: ControlSurfacePublishInput): Promise<{
    surface: ControlSurfaceRecord;
    version: ControlSurfaceVersionRecord;
  }>;
  archiveControlSurface(input: ControlSurfaceArchiveInput): Promise<ControlSurfaceRecord | undefined>;
  listControlSurfaceVersions(tenantId: string, surfaceId: string): Promise<ControlSurfaceVersionRecord[]>;
  rollbackControlSurfaceToVersion(input: ControlSurfaceRollbackInput): Promise<{
    surface: ControlSurfaceRecord;
    version: ControlSurfaceVersionRecord;
  } | undefined>;
};

export function createControlSurfaceRepository(db: KissPmDatabase): ControlSurfaceRepository {
  return {
    async listControlSurfaces(tenantId) {
      const rows = await db
        .select()
        .from(controlSurfaceDefinitions)
        .where(eq(controlSurfaceDefinitions.tenantId, tenantId))
        .orderBy(asc(controlSurfaceDefinitions.code));
      return rows.map(mapControlSurfaceRecord);
    },
    async findControlSurface(tenantId, surfaceId) {
      const [row] = await db
        .select()
        .from(controlSurfaceDefinitions)
        .where(
          and(
            eq(controlSurfaceDefinitions.tenantId, tenantId),
            eq(controlSurfaceDefinitions.id, surfaceId)
          )
        )
        .limit(1);
      return row ? mapControlSurfaceRecord(row) : undefined;
    },
    async upsertControlSurfaceDraft(input) {
      const now = new Date();
      const existingRows = await db
        .select()
        .from(controlSurfaceDefinitions)
        .where(
          and(
            eq(controlSurfaceDefinitions.tenantId, input.tenantId),
            or(
              eq(controlSurfaceDefinitions.id, input.definition.id),
              eq(controlSurfaceDefinitions.code, input.definition.code)
            )
          )
        )
        .limit(2);
      if (existingRows.length > 1) {
        throw new Error("Control surface id and code match different rows");
      }

      const existing = existingRows[0];
      if (existing?.status === "archived") {
        throw new Error("control_surface_archived");
      }

      const id = existing?.id ?? input.definition.id;
      const draftVersion = existing
        ? Math.max(existing.draftVersion, existing.currentVersion + 1)
        : 1;
      const definition = { ...input.definition, id, tenantId: input.tenantId };
      const status = existing?.status === "published" ? "published" : "draft";

      const [row] = await db
        .insert(controlSurfaceDefinitions)
        .values({
          id,
          tenantId: input.tenantId,
          code: definition.code,
          name: definition.name,
          description: definition.description,
          ownerUserId: input.ownerUserId ?? existing?.ownerUserId ?? null,
          status,
          currentVersion: existing?.currentVersion ?? 0,
          draftVersion,
          draftDefinition: definition,
          publishedDefinition: existing?.publishedDefinition ?? null,
          createdByUserId: existing?.createdByUserId ?? input.actorUserId,
          updatedByUserId: input.actorUserId,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          publishedAt: existing?.publishedAt ?? null,
          archivedAt: null
        })
        .onConflictDoUpdate({
          target: [controlSurfaceDefinitions.tenantId, controlSurfaceDefinitions.id],
          set: {
            code: definition.code,
            name: definition.name,
            description: definition.description,
            ownerUserId: input.ownerUserId ?? existing?.ownerUserId ?? null,
            status,
            draftVersion,
            draftDefinition: definition,
            updatedByUserId: input.actorUserId,
            updatedAt: now,
            archivedAt: null
          }
        })
        .returning();
      if (!row) throw new Error("Control surface draft upsert returned no row");
      return mapControlSurfaceRecord(row);
    },
    async publishControlSurface(input) {
      const existing = await this.findControlSurface(input.tenantId, input.surfaceId);
      if (!existing) throw new Error("control_surface_not_found");
      const now = new Date();
      const versionRecord = await insertSurfaceVersion(db, {
        tenantId: input.tenantId,
        surfaceId: existing.id,
        version: existing.draftVersion,
        definition: existing.draftDefinition,
        actorUserId: input.actorUserId,
        auditEventId: input.auditEventId ?? null,
        createdAt: now
      });
      const [row] = await db
        .update(controlSurfaceDefinitions)
        .set({
          status: "published",
          currentVersion: existing.draftVersion,
          draftVersion: existing.draftVersion + 1,
          publishedDefinition: existing.draftDefinition,
          updatedByUserId: input.actorUserId,
          updatedAt: now,
          publishedAt: now,
          archivedAt: null
        })
        .where(
          and(
            eq(controlSurfaceDefinitions.tenantId, input.tenantId),
            eq(controlSurfaceDefinitions.id, input.surfaceId)
          )
        )
        .returning();
      if (!row) throw new Error("Control surface publish returned no row");
      return { surface: mapControlSurfaceRecord(row), version: versionRecord };
    },
    async archiveControlSurface(input) {
      const [row] = await db
        .update(controlSurfaceDefinitions)
        .set({
          status: "archived",
          updatedByUserId: input.actorUserId,
          updatedAt: new Date(),
          archivedAt: new Date()
        })
        .where(
          and(
            eq(controlSurfaceDefinitions.tenantId, input.tenantId),
            eq(controlSurfaceDefinitions.id, input.surfaceId)
          )
        )
        .returning();
      return row ? mapControlSurfaceRecord(row) : undefined;
    },
    async listControlSurfaceVersions(tenantId, surfaceId) {
      const rows = await db
        .select()
        .from(controlSurfaceVersions)
        .where(
          and(
            eq(controlSurfaceVersions.tenantId, tenantId),
            eq(controlSurfaceVersions.surfaceId, surfaceId)
          )
        )
        .orderBy(desc(controlSurfaceVersions.version));
      return rows.map(mapControlSurfaceVersionRecord);
    },
    async rollbackControlSurfaceToVersion(input) {
      const versions = await this.listControlSurfaceVersions(input.tenantId, input.surfaceId);
      const target = versions.find((candidate) => candidate.version === input.version);
      const existing = await this.findControlSurface(input.tenantId, input.surfaceId);
      if (!target || !existing) return undefined;
      const now = new Date();
      const nextVersion = existing.currentVersion + 1;
      const versionRecord = await insertSurfaceVersion(db, {
        tenantId: input.tenantId,
        surfaceId: input.surfaceId,
        version: nextVersion,
        definition: target.definition,
        actorUserId: input.actorUserId,
        auditEventId: input.auditEventId ?? null,
        createdAt: now
      });
      const [row] = await db
        .update(controlSurfaceDefinitions)
        .set({
          status: "published",
          currentVersion: nextVersion,
          draftVersion: nextVersion + 1,
          draftDefinition: target.definition,
          publishedDefinition: target.definition,
          updatedByUserId: input.actorUserId,
          updatedAt: now,
          publishedAt: now,
          archivedAt: null
        })
        .where(
          and(
            eq(controlSurfaceDefinitions.tenantId, input.tenantId),
            eq(controlSurfaceDefinitions.id, input.surfaceId)
          )
        )
        .returning();
      if (!row) throw new Error("Control surface rollback returned no row");
      return { surface: mapControlSurfaceRecord(row), version: versionRecord };
    }
  };
}

async function insertSurfaceVersion(
  db: KissPmDatabase,
  input: {
    tenantId: string;
    surfaceId: string;
    version: number;
    definition: ControlSurfaceDefinition;
    actorUserId: string;
    auditEventId: string | null;
    createdAt: Date;
  }
): Promise<ControlSurfaceVersionRecord> {
  const [row] = await db
    .insert(controlSurfaceVersions)
    .values({
      tenantId: input.tenantId,
      surfaceId: input.surfaceId,
      version: input.version,
      definition: input.definition,
      publishedByUserId: input.actorUserId,
      auditEventId: input.auditEventId,
      createdAt: input.createdAt
    })
    .returning();
  if (!row) throw new Error("Control surface version insert returned no row");
  return mapControlSurfaceVersionRecord(row);
}

function mapControlSurfaceRecord(
  row: typeof controlSurfaceDefinitions.$inferSelect
): ControlSurfaceRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    description: row.description,
    ownerUserId: row.ownerUserId,
    status: row.status as ControlSurfaceRecord["status"],
    currentVersion: row.currentVersion,
    draftVersion: row.draftVersion,
    draftDefinition: row.draftDefinition as ControlSurfaceDefinition,
    publishedDefinition: row.publishedDefinition as ControlSurfaceDefinition | null,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null
  };
}

function mapControlSurfaceVersionRecord(
  row: typeof controlSurfaceVersions.$inferSelect
): ControlSurfaceVersionRecord {
  return {
    tenantId: row.tenantId,
    surfaceId: row.surfaceId,
    version: row.version,
    definition: row.definition as ControlSurfaceDefinition,
    publishedByUserId: row.publishedByUserId,
    auditEventId: row.auditEventId,
    createdAt: row.createdAt.toISOString()
  };
}
