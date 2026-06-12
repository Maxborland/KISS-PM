import { describe, expect, it } from "vitest";

import type { AttachmentReadModel } from "@kiss-pm/persistence";

import { serializeAttachment } from "./attachmentSerialization";

describe("attachment serialization", () => {
  it("redacts provider and storage metadata key variants", () => {
    const createdAt = new Date("2026-06-10T00:00:00.000Z");
    const attachment: AttachmentReadModel = {
      id: "attachment-alpha",
      tenantId: "tenant-alpha",
      entityType: "opportunity",
      entityId: "opportunity-alpha",
      assetId: null,
      externalReferenceId: "external-reference-alpha",
      relationType: "evidence",
      sourceActivityType: null,
      sourceActivityId: null,
      createdByUserId: "user-alpha-admin",
      createdAt,
      archivedAt: null,
      fileAsset: null,
      externalReference: {
        id: "external-reference-alpha",
        tenantId: "tenant-alpha",
        connectorType: "s3",
        externalId: "provider-file-alpha",
        url: "https://files.example.test/customer-visible-brief.pdf",
        title: "Customer Visible Brief",
        metadata: {
          "storage.key": "internal/client/secret-dot.pdf",
          "storage key": "internal/client/secret-space.pdf",
          key: "internal/client/plain-key-secret.pdf",
          objectKey: "internal/client/object-key-secret.pdf",
          "object-key": "internal/client/object-key-dash-secret.pdf",
          storagePath: "/var/lib/kiss-pm/private.pdf",
          localPath: "/srv/uploads/private.pdf",
          bucket: "tenant-alpha-private",
          visible: "customer-facing",
          nested: {
            "storage.provider": "minio",
            objectBucket: "tenant-alpha-private",
            key: "internal/client/nested-key-secret.pdf",
            object_key: "internal/client/nested-object-key-secret.pdf",
            providerStoragePath: "internal/client/nested-secret.pdf",
            visible: "nested customer-facing"
          }
        },
        createdByUserId: "user-alpha-admin",
        createdAt,
        archivedAt: null
      }
    };

    expect(serializeAttachment(attachment).externalReference?.metadata).toEqual({
      visible: "customer-facing",
      nested: {
        visible: "nested customer-facing"
      }
    });
  });
});
