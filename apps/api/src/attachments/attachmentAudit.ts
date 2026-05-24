import type { PolicyDecision } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { AttachmentReadModel } from "@kiss-pm/persistence";

import type { ApiTenantDataSource, ManagementAuditEventInput } from "../apiTypes";
import type { AttachmentEntityContext } from "../attachmentEntityAccess";

type AttachmentAuditDeps = {
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export async function appendAttachmentAudit(
  deps: AttachmentAuditDeps,
  auditDataSource: ApiTenantDataSource,
  input: {
    actionType: string;
    actor: TenantUser;
    attachment: AttachmentReadModel;
    beforeState?: Record<string, unknown> | null;
    entity: AttachmentEntityContext;
    permissionResult: PolicyDecision;
  }
): Promise<void> {
  await deps.appendManagementAuditEvent(
    {
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: input.actionType,
      sourceWorkflow: "attachments",
      sourceEntity: input.entity.sourceEntity,
      commandInput: {
        attachmentId: input.attachment.id,
        entityType: input.attachment.entityType,
        entityId: input.attachment.entityId
      },
      beforeState: input.beforeState ?? null,
      afterState: summarizeAttachment(input.attachment),
      permissionResult: input.permissionResult
    },
    auditDataSource
  );
}

export async function appendAttachmentDeniedAudit(
  deps: AttachmentAuditDeps,
  input: {
    actor: TenantUser;
    entity: AttachmentEntityContext;
    error: string;
    permissionResult: PolicyDecision;
  }
): Promise<void> {
  await deps.appendManagementAuditEvent({
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: "attachment.denied",
    sourceWorkflow: "attachments",
    sourceEntity: input.entity.sourceEntity,
    commandInput: {
      entityType: input.entity.entityType,
      entityId: input.entity.entityId
    },
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: {
      status: "denied",
      error: input.error
    }
  });
}

function summarizeAttachment(attachment: AttachmentReadModel): Record<string, unknown> {
  return {
    id: attachment.id,
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    kind: attachment.fileAsset ? "file" : "external_reference",
    fileName: attachment.fileAsset?.safeDisplayName ?? null,
    title: attachment.externalReference?.title ?? null,
    mimeType: attachment.fileAsset?.mimeType ?? null,
    sizeBytes: attachment.fileAsset?.sizeBytes ?? null,
    connectorType: attachment.externalReference?.connectorType ?? null,
    archivedAt: attachment.archivedAt?.toISOString() ?? null
  };
}
