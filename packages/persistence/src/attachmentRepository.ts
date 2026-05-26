import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  entityAttachments,
  externalReferences,
  fileAssets
} from "./schema";

export type AttachmentEntityType =
  | "opportunity"
  | "client"
  | "contact"
  | "product"
  | "project"
  | "task"
  | "document";

export type FileAssetProvider = "local" | "s3";
export type FileAssetStatus = "pending" | "ready" | "archived" | "failed";
export type ExternalReferenceConnectorType =
  | "manual_link"
  | "bitrix24"
  | "amocrm"
  | "jira"
  | "slack"
  | "email"
  | "s3"
  | "local"
  | "other";

export type FileAssetRecord = {
  id: string;
  tenantId: TenantId;
  provider: FileAssetProvider;
  storageKey: string;
  originalName: string;
  safeDisplayName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string | null;
  status: FileAssetStatus;
  createdByUserId: UserId;
  createdAt: Date;
  archivedAt: Date | null;
};

export type ExternalReferenceRecord = {
  id: string;
  tenantId: TenantId;
  connectorType: ExternalReferenceConnectorType;
  externalId: string | null;
  url: string;
  title: string;
  metadata: Record<string, unknown>;
  createdByUserId: UserId;
  createdAt: Date;
  archivedAt: Date | null;
};

export type EntityAttachmentRecord = {
  id: string;
  tenantId: TenantId;
  entityType: AttachmentEntityType;
  entityId: string;
  assetId: string | null;
  externalReferenceId: string | null;
  relationType: string;
  sourceActivityType: "crm" | "task" | null;
  sourceActivityId: string | null;
  createdByUserId: UserId;
  createdAt: Date;
  archivedAt: Date | null;
};

export type AttachmentReadModel = EntityAttachmentRecord & {
  fileAsset: FileAssetRecord | null;
  externalReference: ExternalReferenceRecord | null;
};

export type FileAssetInput = Omit<
  FileAssetRecord,
  "createdAt" | "archivedAt" | "checksumSha256" | "status" | "sizeBytes"
> & {
  checksumSha256?: string | null;
  sizeBytes: number;
  status?: FileAssetStatus;
};

export type ExternalReferenceInput = Omit<
  ExternalReferenceRecord,
  "createdAt" | "archivedAt"
>;

export type EntityAttachmentInput = Omit<
  EntityAttachmentRecord,
  "createdAt" | "archivedAt"
>;

export type AttachmentRepository = {
  createPendingFileAsset(input: FileAssetInput): Promise<FileAssetRecord>;
  markFileAssetReady(input: {
    tenantId: TenantId;
    assetId: string;
    sizeBytes: number;
    checksumSha256: string;
  }): Promise<FileAssetRecord | undefined>;
  markFileAssetFailed(input: {
    tenantId: TenantId;
    assetId: string;
  }): Promise<FileAssetRecord | undefined>;
  createExternalReference(input: ExternalReferenceInput): Promise<ExternalReferenceRecord>;
  createEntityAttachment(input: EntityAttachmentInput): Promise<AttachmentReadModel>;
  listEntityAttachments(input: {
    tenantId: TenantId;
    entityType: AttachmentEntityType;
    entityId: string;
  }): Promise<AttachmentReadModel[]>;
  listAttachmentActivityItems(input: {
    tenantId: TenantId;
    entityType: AttachmentEntityType;
    entityId: string;
  }): Promise<AttachmentReadModel[]>;
  findAttachmentById(
    tenantId: TenantId,
    attachmentId: string
  ): Promise<AttachmentReadModel | undefined>;
  archiveAttachment(input: {
    tenantId: TenantId;
    attachmentId: string;
  }): Promise<AttachmentReadModel | undefined>;
  searchAttachments(input: {
    tenantId: TenantId;
    query: string;
    limit: number;
    offset?: number;
  }): Promise<AttachmentReadModel[]>;
};

export function createAttachmentRepository(db: KissPmDatabase): AttachmentRepository {
  async function hydrateAttachmentRows(
    rows: Array<{
      attachment: typeof entityAttachments.$inferSelect;
      fileAsset: typeof fileAssets.$inferSelect | null;
      externalReference: typeof externalReferences.$inferSelect | null;
    }>
  ): Promise<AttachmentReadModel[]> {
    return rows.map((row) => ({
      ...mapEntityAttachment(row.attachment),
      fileAsset: row.fileAsset ? mapFileAsset(row.fileAsset) : null,
      externalReference: row.externalReference
        ? mapExternalReference(row.externalReference)
        : null
    }));
  }

  const attachmentSelect = () =>
    db
      .select({
        attachment: entityAttachments,
        fileAsset: fileAssets,
        externalReference: externalReferences
      })
      .from(entityAttachments)
      .leftJoin(
        fileAssets,
        and(
          eq(fileAssets.tenantId, entityAttachments.tenantId),
          eq(fileAssets.id, entityAttachments.assetId)
        )
      )
      .leftJoin(
        externalReferences,
        and(
          eq(externalReferences.tenantId, entityAttachments.tenantId),
          eq(externalReferences.id, entityAttachments.externalReferenceId)
        )
      );

  async function findAttachmentById(
    tenantId: TenantId,
    attachmentId: string
  ): Promise<AttachmentReadModel | undefined> {
    const rows = await attachmentSelect()
      .where(
        and(
          eq(entityAttachments.tenantId, tenantId),
          eq(entityAttachments.id, attachmentId)
        )
      )
      .limit(1);

    return (await hydrateAttachmentRows(rows))[0];
  }

  return {
    async createPendingFileAsset(input) {
      const [row] = await db
        .insert(fileAssets)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          provider: input.provider,
          storageKey: input.storageKey,
          originalName: input.originalName,
          safeDisplayName: input.safeDisplayName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          checksumSha256: input.checksumSha256 ?? null,
          status: input.status ?? "pending",
          createdByUserId: input.createdByUserId,
          createdAt: new Date()
        })
        .returning();

      if (!row) throw new Error("File asset insert returned no row");
      return mapFileAsset(row);
    },
    async markFileAssetReady(input) {
      const [row] = await db
        .update(fileAssets)
        .set({
          sizeBytes: input.sizeBytes,
          checksumSha256: input.checksumSha256,
          status: "ready"
        })
        .where(
          and(
            eq(fileAssets.tenantId, input.tenantId),
            eq(fileAssets.id, input.assetId),
            eq(fileAssets.status, "pending")
          )
        )
        .returning();

      return row ? mapFileAsset(row) : undefined;
    },
    async markFileAssetFailed(input) {
      const [row] = await db
        .update(fileAssets)
        .set({ status: "failed" })
        .where(
          and(
            eq(fileAssets.tenantId, input.tenantId),
            eq(fileAssets.id, input.assetId)
          )
        )
        .returning();

      return row ? mapFileAsset(row) : undefined;
    },
    async createExternalReference(input) {
      const [row] = await db
        .insert(externalReferences)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          connectorType: input.connectorType,
          externalId: input.externalId,
          url: input.url,
          title: input.title,
          metadata: input.metadata,
          createdByUserId: input.createdByUserId,
          createdAt: new Date()
        })
        .returning();

      if (!row) throw new Error("External reference insert returned no row");
      return mapExternalReference(row);
    },
    async createEntityAttachment(input) {
      const [row] = await db
        .insert(entityAttachments)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          entityType: input.entityType,
          entityId: input.entityId,
          assetId: input.assetId,
          externalReferenceId: input.externalReferenceId,
          relationType: input.relationType,
          sourceActivityType: input.sourceActivityType,
          sourceActivityId: input.sourceActivityId,
          createdByUserId: input.createdByUserId,
          createdAt: new Date()
        })
        .returning();

      if (!row) throw new Error("Entity attachment insert returned no row");
      const attachment = await findAttachmentById(input.tenantId, row.id);
      if (!attachment) throw new Error("Created attachment not found");
      return attachment;
    },
    async listEntityAttachments(input) {
      const rows = await attachmentSelect()
        .where(
          and(
            eq(entityAttachments.tenantId, input.tenantId),
            eq(entityAttachments.entityType, input.entityType),
            eq(entityAttachments.entityId, input.entityId),
            isNull(entityAttachments.archivedAt),
            or(isNull(fileAssets.id), eq(fileAssets.status, "ready")),
            or(isNull(externalReferences.id), isNull(externalReferences.archivedAt))
          )
        )
        .orderBy(desc(entityAttachments.createdAt), desc(entityAttachments.id));

      return hydrateAttachmentRows(rows);
    },
    async listAttachmentActivityItems(input) {
      const rows = await attachmentSelect()
        .where(
          and(
            eq(entityAttachments.tenantId, input.tenantId),
            eq(entityAttachments.entityType, input.entityType),
            eq(entityAttachments.entityId, input.entityId),
            isNull(entityAttachments.archivedAt),
            isNull(entityAttachments.sourceActivityId),
            or(isNull(fileAssets.id), eq(fileAssets.status, "ready")),
            or(isNull(externalReferences.id), isNull(externalReferences.archivedAt))
          )
        )
        .orderBy(asc(entityAttachments.createdAt), asc(entityAttachments.id));

      return hydrateAttachmentRows(rows);
    },
    findAttachmentById,
    async archiveAttachment(input) {
      const now = new Date();
      const before = await findAttachmentById(input.tenantId, input.attachmentId);
      if (!before || before.archivedAt) return undefined;

      await db
        .update(entityAttachments)
        .set({ archivedAt: now })
        .where(
          and(
            eq(entityAttachments.tenantId, input.tenantId),
            eq(entityAttachments.id, input.attachmentId),
            isNull(entityAttachments.archivedAt)
          )
        );

      if (before.fileAsset) {
        const activeSiblings = await db
          .select({ id: entityAttachments.id })
          .from(entityAttachments)
          .where(
            and(
              eq(entityAttachments.tenantId, input.tenantId),
              eq(entityAttachments.assetId, before.fileAsset.id),
              isNull(entityAttachments.archivedAt)
            )
          )
          .limit(1);
        if (activeSiblings.length === 0) {
          await db
            .update(fileAssets)
            .set({ status: "archived", archivedAt: now })
            .where(
              and(
                eq(fileAssets.tenantId, input.tenantId),
                eq(fileAssets.id, before.fileAsset.id),
                eq(fileAssets.status, "ready")
              )
            );
        }
      }
      if (before.externalReference) {
        const activeSiblings = await db
          .select({ id: entityAttachments.id })
          .from(entityAttachments)
          .where(
            and(
              eq(entityAttachments.tenantId, input.tenantId),
              eq(entityAttachments.externalReferenceId, before.externalReference.id),
              isNull(entityAttachments.archivedAt)
            )
          )
          .limit(1);
        if (activeSiblings.length === 0) {
          await db
            .update(externalReferences)
            .set({ archivedAt: now })
            .where(
              and(
                eq(externalReferences.tenantId, input.tenantId),
                eq(externalReferences.id, before.externalReference.id),
                isNull(externalReferences.archivedAt)
              )
            );
        }
      }

      return findAttachmentById(input.tenantId, input.attachmentId);
    },
    async searchAttachments(input) {
      const pattern = `%${escapeLikePattern(input.query)}%`;
      const rows = await attachmentSelect()
        .where(
          and(
            eq(entityAttachments.tenantId, input.tenantId),
            isNull(entityAttachments.archivedAt),
            or(isNull(fileAssets.id), eq(fileAssets.status, "ready")),
            or(isNull(externalReferences.id), isNull(externalReferences.archivedAt)),
            or(
              sql`${fileAssets.safeDisplayName} ilike ${pattern} escape '\\'`,
              sql`${fileAssets.mimeType} ilike ${pattern} escape '\\'`,
              sql`${externalReferences.title} ilike ${pattern} escape '\\'`,
              sql`${externalReferences.url} ilike ${pattern} escape '\\'`,
              sql`${externalReferences.metadata}::text ilike ${pattern} escape '\\'`
            )
          )
        )
        .orderBy(desc(entityAttachments.createdAt), desc(entityAttachments.id))
        .limit(input.limit)
        .offset(input.offset ?? 0);

      return hydrateAttachmentRows(rows);
    }
  };
}

function mapFileAsset(row: typeof fileAssets.$inferSelect): FileAssetRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider as FileAssetProvider,
    storageKey: row.storageKey,
    originalName: row.originalName,
    safeDisplayName: row.safeDisplayName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksumSha256: row.checksumSha256,
    status: row.status as FileAssetStatus,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function mapExternalReference(
  row: typeof externalReferences.$inferSelect
): ExternalReferenceRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    connectorType: row.connectorType as ExternalReferenceConnectorType,
    externalId: row.externalId,
    url: row.url,
    title: row.title,
    metadata: row.metadata,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}

function mapEntityAttachment(
  row: typeof entityAttachments.$inferSelect
): EntityAttachmentRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entityType: row.entityType as AttachmentEntityType,
    entityId: row.entityId,
    assetId: row.assetId,
    externalReferenceId: row.externalReferenceId,
    relationType: row.relationType,
    sourceActivityType: row.sourceActivityType as "crm" | "task" | null,
    sourceActivityId: row.sourceActivityId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt
  };
}
