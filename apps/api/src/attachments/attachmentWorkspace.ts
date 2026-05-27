import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type {
  AttachmentEntityType,
  AttachmentReadModel,
  ExternalReferenceConnectorType
} from "@kiss-pm/persistence";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "../apiTypes";
import type { AttachmentDataPort } from "../apiDataPorts";
import {
  resolveAttachmentEntityContext,
  type AttachmentEntityContext
} from "../attachmentEntityAccess";
import type { StorageProvider } from "../storageProvider";
import {
  appendAttachmentDeniedAudit
} from "./attachmentAudit";
import {
  archiveAttachment,
  listAttachments
} from "./attachmentCollectionHandlers";
import { attachExternalReference } from "./attachExternalReference";
import { attachFile, prepareDownload } from "./fileAttachmentHandlers";

export type AttachmentWorkspaceDeps = {
  dataSource: AttachmentDataPort;
  storageProvider: StorageProvider;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export type WorkspaceInput = {
  actor: TenantUser;
  profile: AccessProfile;
};

export type WorkspaceError = {
  ok: false;
  status: 400 | 403 | 404 | 409 | 501 | 502;
  error: string;
};

export type AttachExternalReferenceInput = WorkspaceInput & {
  entityType: AttachmentEntityType;
  entityId: string;
  connectorType: ExternalReferenceConnectorType;
  externalId: string | null;
  url: string;
  title: string;
  metadata: Record<string, unknown>;
  relationType: string;
};

export type AttachFileInput = WorkspaceInput & {
  entityType: AttachmentEntityType;
  entityId: string;
  relationType: string;
  originalName: string;
  safeDisplayName: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type AttachmentResult = { ok: true; attachment: AttachmentReadModel } | WorkspaceError;
export type AttachmentListResult = { ok: true; attachments: AttachmentReadModel[] } | WorkspaceError;
export type DownloadResult =
  | {
      ok: true;
      bytes: Uint8Array;
      mimeType: string;
      safeDisplayName: string;
    }
  | WorkspaceError;

export function createAttachmentWorkspace(deps: AttachmentWorkspaceDeps) {
  return {
    listAttachments(input: WorkspaceInput & { entityType: AttachmentEntityType; entityId: string }) {
      return listAttachments(deps, input);
    },
    attachExternalReference(input: AttachExternalReferenceInput) {
      return attachExternalReference(deps, input, resolveManagedEntity);
    },
    attachFile(input: AttachFileInput) {
      return attachFile(deps, input, resolveManagedEntity);
    },
    archiveAttachment(input: WorkspaceInput & { attachmentId: string }) {
      return archiveAttachment(deps, input, resolveManagedEntity);
    },
    prepareDownload(input: WorkspaceInput & { attachmentId: string }) {
      return prepareDownload(deps, input);
    }
  };
}

async function resolveManagedEntity(
  deps: AttachmentWorkspaceDeps,
  input: WorkspaceInput & { entityType: AttachmentEntityType; entityId: string }
): Promise<{ ok: true; value: AttachmentEntityContext } | WorkspaceError> {
  const entity = await resolveAttachmentEntityContext({
    actor: input.actor,
    dataSource: deps.dataSource,
    entityId: input.entityId,
    entityType: input.entityType,
    profile: input.profile
  });
  if (!entity.ok) return { ok: false, status: entity.status, error: entity.error };
  if (!entity.value.manageDecision.allowed) {
    await appendAttachmentDeniedAudit(deps, {
      actor: input.actor,
      entity: entity.value,
      error: entity.value.manageDecision.reason,
      permissionResult: entity.value.manageDecision
    });
    return { ok: false, status: 403, error: entity.value.manageDecision.reason };
  }
  return entity;
}
