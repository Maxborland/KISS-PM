import type { AccessProfile } from "@kiss-pm/access-control";
import {
  extractMentionedUserIds,
  type CollaborationEntityType,
  type TenantUser
} from "@kiss-pm/domain";

import type { EntityLookupDataPort } from "../apiDataPorts";
import type { ApiTenantDataSource } from "../apiTypes";
import { resolveEntityAccessContext, type EntityAccessContext } from "../entityAccess";

export type CollaborationEntityAccessContext = EntityAccessContext<CollaborationEntityType>;

export type CollaborationEntityAccessDataSource = EntityLookupDataPort &
  Pick<ApiTenantDataSource, "findAccessProfileById" | "listUsersByTenantId">;

export function resolveCollaborationEntityAccess(input: {
  actor: TenantUser;
  dataSource: CollaborationEntityAccessDataSource;
  entityId: string;
  entityType: CollaborationEntityType;
  profile: AccessProfile;
}) {
  return resolveEntityAccessContext({
    ...input,
    notFoundError: "collaboration_entity_not_found"
  });
}

export async function filterCollaborationMentionRecipients(input: {
  actor: TenantUser;
  body: string;
  dataSource: CollaborationEntityAccessDataSource;
  entity: CollaborationEntityAccessContext;
}): Promise<string[]> {
  const rawIds = extractMentionedUserIds(input.body).filter((id) => id !== input.actor.id);
  if (rawIds.length === 0) return [];
  const tenantUsers = (await input.dataSource.listUsersByTenantId?.(input.actor.tenantId)) ?? [];
  const usersById = new Map(tenantUsers.map((user) => [user.id, user]));
  const allowed: string[] = [];
  for (const userId of rawIds) {
    const user = usersById.get(userId);
    if (!user) continue;
    const profile = input.dataSource.findAccessProfileById
      ? await input.dataSource.findAccessProfileById(user.tenantId, user.accessProfileId)
      : undefined;
    if (!profile) continue;
    const access = await resolveCollaborationEntityAccess({
      actor: user,
      dataSource: input.dataSource,
      entityId: input.entity.entityId,
      entityType: input.entity.entityType,
      profile
    });
    if (access.ok && access.value.readDecision.allowed) allowed.push(userId);
  }
  return allowed;
}
