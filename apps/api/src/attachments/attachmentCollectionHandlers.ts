import type {
  AttachmentEntityType
} from "@kiss-pm/persistence";

import {
  resolveAttachmentEntityContext,
  type AttachmentEntityContext
} from "../attachmentEntityAccess";
import { serializeAttachment } from "../attachmentSerialization";
import { appendAttachmentAudit } from "./attachmentAudit";
import type {
  AttachmentListResult,
  AttachmentResult,
  AttachmentWorkspaceDeps,
  WorkspaceError,
  WorkspaceInput
} from "./attachmentWorkspace";

type ResolveManagedEntity = (
  deps: AttachmentWorkspaceDeps,
  input: WorkspaceInput & { entityType: AttachmentEntityType; entityId: string }
) => Promise<{ ok: true; value: AttachmentEntityContext } | WorkspaceError>;

export async function listAttachments(
  deps: AttachmentWorkspaceDeps,
  input: WorkspaceInput & { entityType: AttachmentEntityType; entityId: string }
): Promise<AttachmentListResult> {
  if (!deps.dataSource.listEntityAttachments) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const entity = await resolveAttachmentEntityContext({
    actor: input.actor,
    dataSource: deps.dataSource,
    entityId: input.entityId,
    entityType: input.entityType,
    profile: input.profile
  });
  if (!entity.ok) return { ok: false, status: entity.status, error: entity.error };
  if (!entity.value.readDecision.allowed) {
    return { ok: false, status: 403, error: entity.value.readDecision.reason };
  }

  const attachments = await deps.dataSource.listEntityAttachments({
    tenantId: input.actor.tenantId,
    entityType: entity.value.entityType,
    entityId: entity.value.entityId
  });
  return { ok: true, attachments };
}

export async function archiveAttachment(
  deps: AttachmentWorkspaceDeps,
  input: WorkspaceInput & { attachmentId: string },
  resolveManagedEntity: ResolveManagedEntity
): Promise<AttachmentResult> {
  if (!deps.dataSource.findAttachmentById || !deps.dataSource.archiveAttachment) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const attachment = await deps.dataSource.findAttachmentById(
    input.actor.tenantId,
    input.attachmentId
  );
  if (!attachment || attachment.archivedAt) {
    return { ok: false, status: 404, error: "attachment_not_found" };
  }

  const entity = await resolveManagedEntity(deps, {
    ...input,
    entityId: attachment.entityId,
    entityType: attachment.entityType
  });
  if (!entity.ok) return entity;

  const archived = await deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (!transactionDataSource.archiveAttachment) throw new Error("persistence_not_configured");
    const current = await transactionDataSource.archiveAttachment({
      tenantId: input.actor.tenantId,
      attachmentId: attachment.id
    });
    if (!current) return undefined;
    await appendAttachmentAudit(deps, transactionDataSource, {
      actionType: "attachment.removed",
      actor: input.actor,
      attachment: current,
      beforeState: serializeAttachment(attachment),
      entity: entity.value,
      permissionResult: entity.value.manageDecision
    });
    return current;
  });
  if (!archived) return { ok: false, status: 404, error: "attachment_not_found" };
  return { ok: true, attachment: archived };
}
