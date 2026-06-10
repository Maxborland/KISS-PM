import type { AttachmentReadModel } from "@kiss-pm/persistence";

const sensitiveMetadataKeyTokens = ["provider", "storage", "path", "bucket"];
const sensitiveMetadataExactKeys = new Set(["key", "objectkey"]);

export function serializeAttachment(attachment: AttachmentReadModel) {
  return {
    id: attachment.id,
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    relationType: attachment.relationType,
    kind: attachment.fileAsset ? "file" : "external_reference",
    fileAsset: attachment.fileAsset
      ? {
          id: attachment.fileAsset.id,
          originalName: attachment.fileAsset.originalName,
          safeDisplayName: attachment.fileAsset.safeDisplayName,
          mimeType: attachment.fileAsset.mimeType,
          sizeBytes: attachment.fileAsset.sizeBytes,
          checksumSha256: attachment.fileAsset.checksumSha256,
          status: attachment.fileAsset.status,
          createdAt: attachment.fileAsset.createdAt.toISOString()
        }
      : null,
    externalReference: attachment.externalReference
      ? {
          id: attachment.externalReference.id,
          connectorType: attachment.externalReference.connectorType,
          externalId: attachment.externalReference.externalId,
          url: attachment.externalReference.url,
          title: attachment.externalReference.title,
          metadata: sanitizeMetadata(attachment.externalReference.metadata),
          createdAt: attachment.externalReference.createdAt.toISOString()
        }
      : null,
    sourceActivityType: attachment.sourceActivityType,
    sourceActivityId: attachment.sourceActivityId,
    createdByUserId: attachment.createdByUserId,
    createdAt: attachment.createdAt.toISOString(),
    archivedAt: attachment.archivedAt?.toISOString() ?? null
  };
}

function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeMetadata);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isSensitiveMetadataKey(key))
      .map(([key, entry]) => [key, sanitizeMetadata(entry)])
  );
}

function isSensitiveMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (sensitiveMetadataExactKeys.has(normalized)) return true;
  return sensitiveMetadataKeyTokens.some((token) => normalized.includes(token));
}
