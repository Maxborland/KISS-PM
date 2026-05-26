import { randomUUID } from "node:crypto";

import type { AttachmentEntityContext } from "../attachmentEntityAccess";
import { appendAttachmentAudit } from "./attachmentAudit";
import type {
  AttachmentResult,
  AttachmentWorkspaceDeps,
  AttachExternalReferenceInput,
  WorkspaceError
} from "./attachmentWorkspace";

type ResolveManagedEntity = (
  deps: AttachmentWorkspaceDeps,
  input: AttachExternalReferenceInput
) => Promise<{ ok: true; value: AttachmentEntityContext } | WorkspaceError>;

export async function attachExternalReference(
  deps: AttachmentWorkspaceDeps,
  input: AttachExternalReferenceInput,
  resolveManagedEntity: ResolveManagedEntity
): Promise<AttachmentResult> {
  if (
    !deps.dataSource.createExternalReference ||
    !deps.dataSource.createEntityAttachment ||
    !deps.dataSource.withTransaction
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const entity = await resolveManagedEntity(deps, input);
  if (!entity.ok) return entity;

  const attachment = await deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.createExternalReference ||
      !transactionDataSource.createEntityAttachment
    ) {
      throw new Error("persistence_not_configured");
    }
    const reference = await transactionDataSource.createExternalReference({
      id: `external-ref-${randomUUID()}`,
      tenantId: input.actor.tenantId,
      connectorType: input.connectorType,
      externalId: input.externalId,
      url: input.url,
      title: input.title,
      metadata: input.metadata,
      createdByUserId: input.actor.id
    });
    const createdAttachment = await transactionDataSource.createEntityAttachment({
      id: `attachment-${randomUUID()}`,
      tenantId: input.actor.tenantId,
      entityType: entity.value.entityType,
      entityId: entity.value.entityId,
      assetId: null,
      externalReferenceId: reference.id,
      relationType: input.relationType,
      sourceActivityType: null,
      sourceActivityId: null,
      createdByUserId: input.actor.id
    });
    await appendAttachmentAudit(deps, transactionDataSource, {
      actionType: "attachment.external_reference_attached",
      actor: input.actor,
      attachment: createdAttachment,
      entity: entity.value,
      permissionResult: entity.value.manageDecision
    });
    return createdAttachment;
  });

  return { ok: true, attachment };
}
