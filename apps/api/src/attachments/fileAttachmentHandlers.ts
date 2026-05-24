import { randomUUID } from "node:crypto";

import {
  resolveAttachmentEntityContext,
  type AttachmentEntityContext
} from "../attachmentEntityAccess";
import { buildStorageKey, sha256Hex } from "../attachmentValidation";
import { appendAttachmentAudit } from "./attachmentAudit";
import type {
  AttachmentResult,
  AttachmentWorkspaceDeps,
  AttachFileInput,
  DownloadResult,
  WorkspaceError,
  WorkspaceInput
} from "./attachmentWorkspace";

type ResolveManagedEntity = (
  deps: AttachmentWorkspaceDeps,
  input: WorkspaceInput & { entityType: AttachFileInput["entityType"]; entityId: string }
) => Promise<{ ok: true; value: AttachmentEntityContext } | WorkspaceError>;

export async function attachFile(
  deps: AttachmentWorkspaceDeps,
  input: AttachFileInput,
  resolveManagedEntity: ResolveManagedEntity
): Promise<AttachmentResult> {
  if (
    !deps.dataSource.createPendingFileAsset ||
    !deps.dataSource.markFileAssetReady ||
    !deps.dataSource.markFileAssetFailed ||
    !deps.dataSource.createEntityAttachment ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const entity = await resolveManagedEntity(deps, input);
  if (!entity.ok) return entity;

  const assetId = `file-asset-${randomUUID()}`;
  const storageKey = buildStorageKey({
    tenantId: input.actor.tenantId,
    assetId,
    safeDisplayName: input.safeDisplayName
  });
  const pending = await deps.dataSource.createPendingFileAsset({
    id: assetId,
    tenantId: input.actor.tenantId,
    provider: deps.storageProvider.provider,
    storageKey,
    originalName: input.originalName,
    safeDisplayName: input.safeDisplayName,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength,
    checksumSha256: null,
    createdByUserId: input.actor.id
  });

  try {
    await deps.storageProvider.putObject({
      storageKey,
      bytes: input.bytes,
      mimeType: input.mimeType
    });
  } catch {
    await deps.dataSource.markFileAssetFailed({
      tenantId: input.actor.tenantId,
      assetId: pending.id
    });
    return { ok: false, status: 502, error: "storage_write_failed" };
  }

  const checksumSha256 = sha256Hex(input.bytes);
  try {
    const attachment = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.markFileAssetReady || !transactionDataSource.createEntityAttachment) {
        throw new Error("persistence_not_configured");
      }
      const readyAsset = await transactionDataSource.markFileAssetReady({
        tenantId: input.actor.tenantId,
        assetId: pending.id,
        sizeBytes: input.bytes.byteLength,
        checksumSha256
      });
      if (!readyAsset) throw new Error("file_asset_ready_failed");
      const createdAttachment = await transactionDataSource.createEntityAttachment({
        id: `attachment-${randomUUID()}`,
        tenantId: input.actor.tenantId,
        entityType: entity.value.entityType,
        entityId: entity.value.entityId,
        assetId: readyAsset.id,
        externalReferenceId: null,
        relationType: input.relationType,
        sourceActivityType: null,
        sourceActivityId: null,
        createdByUserId: input.actor.id
      });
      await appendAttachmentAudit(deps, transactionDataSource, {
        actionType: "attachment.file_attached",
        actor: input.actor,
        attachment: createdAttachment,
        entity: entity.value,
        permissionResult: entity.value.manageDecision
      });
      return createdAttachment;
    });
    return { ok: true, attachment };
  } catch (error) {
    await deps.storageProvider.deleteObject(storageKey).catch(() => undefined);
    await deps.dataSource.markFileAssetFailed({
      tenantId: input.actor.tenantId,
      assetId: pending.id
    });
    throw error;
  }
}

export async function prepareDownload(
  deps: AttachmentWorkspaceDeps,
  input: WorkspaceInput & { attachmentId: string }
): Promise<DownloadResult> {
  if (!deps.dataSource.findAttachmentById) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const attachment = await deps.dataSource.findAttachmentById(
    input.actor.tenantId,
    input.attachmentId
  );
  if (!attachment || attachment.archivedAt || !attachment.fileAsset) {
    return { ok: false, status: 404, error: "attachment_not_found" };
  }
  if (attachment.fileAsset.status !== "ready" || attachment.fileAsset.archivedAt) {
    return { ok: false, status: 409, error: "attachment_not_ready" };
  }

  const entity = await resolveAttachmentEntityContext({
    actor: input.actor,
    dataSource: deps.dataSource,
    entityId: attachment.entityId,
    entityType: attachment.entityType,
    profile: input.profile
  });
  if (!entity.ok) return { ok: false, status: entity.status, error: entity.error };
  if (!entity.value.readDecision.allowed) {
    return { ok: false, status: 403, error: entity.value.readDecision.reason };
  }

  const object = await deps.storageProvider.readObject(attachment.fileAsset.storageKey);
  return {
    ok: true,
    bytes: object.bytes,
    mimeType: attachment.fileAsset.mimeType,
    safeDisplayName: attachment.fileAsset.safeDisplayName
  };
}
