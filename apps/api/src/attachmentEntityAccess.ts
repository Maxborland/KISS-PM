import type { AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { AttachmentEntityType } from "@kiss-pm/persistence";

import type { EntityLookupDataPort } from "./apiDataPorts";
import {
  resolveEntityAccessContext,
  type EntityAccessContext
} from "./entityAccess";

export type AttachmentEntityContext = EntityAccessContext<AttachmentEntityType>;

export function resolveAttachmentEntityContext(input: {
  actor: TenantUser;
  dataSource: EntityLookupDataPort;
  entityId: string;
  entityType: AttachmentEntityType;
  profile: AccessProfile;
}) {
  return resolveEntityAccessContext({
    ...input,
    notFoundError: "attachment_entity_not_found"
  });
}
