import {
  canEditTasks,
  canManageClients,
  canManageContacts,
  canManageOpportunities,
  canManageProducts,
  canManageProjects,
  canReadClients,
  canReadContacts,
  canReadOpportunities,
  canReadProducts,
  canReadProjects,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  extractMentionedUserIds,
  type CollaborationEntityType,
  type TenantUser
} from "@kiss-pm/domain";

import type { ApiTenantDataSource, ProjectRecord } from "../apiTypes";
import { resolveCommunicationChannelAccess } from "../communicationChannelAccess";

export type CollaborationEntityAccessContext = {
  entityType: CollaborationEntityType;
  entityId: string;
  sourceEntity: { type: string; id: string };
  readDecision: PolicyDecision;
  manageDecision: PolicyDecision;
  title: string;
};

export type CollaborationEntityAccessDataSource = Pick<
  ApiTenantDataSource,
  | "findAccessProfileById"
  | "findClientById"
  | "findCommunicationChannel"
  | "findContactById"
  | "findOpportunityById"
  | "findProductById"
  | "findTaskById"
  | "listCommunicationChannelMembers"
  | "listProjects"
  | "listUsersByTenantId"
>;

export async function resolveCollaborationEntityAccess(input: {
  actor: TenantUser;
  dataSource: CollaborationEntityAccessDataSource;
  entityId: string;
  entityType: CollaborationEntityType;
  profile: AccessProfile;
}): Promise<
  | { ok: true; value: CollaborationEntityAccessContext }
  | { ok: false; status: 404 | 501; error: string }
> {
  const policyInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };
  if (input.entityType === "opportunity") {
    const opportunity = await input.dataSource.findOpportunityById?.(
      input.actor.tenantId,
      input.entityId
    );
    if (!opportunity) return entityNotFound();
    return { ok: true, value: {
      entityType: "opportunity",
      entityId: opportunity.id,
      sourceEntity: { type: "Opportunity", id: opportunity.id },
      readDecision: canReadOpportunities(policyInput),
      manageDecision: canManageOpportunities(policyInput),
      title: opportunity.title
    } };
  }
  if (input.entityType === "client") {
    const client = await input.dataSource.findClientById?.(input.actor.tenantId, input.entityId);
    if (!client) return entityNotFound();
    return { ok: true, value: {
      entityType: "client",
      entityId: client.id,
      sourceEntity: { type: "Client", id: client.id },
      readDecision: canReadClients(policyInput),
      manageDecision: canManageClients(policyInput),
      title: client.name
    } };
  }
  if (input.entityType === "contact") {
    const contact = await input.dataSource.findContactById?.(input.actor.tenantId, input.entityId);
    if (!contact) return entityNotFound();
    return { ok: true, value: {
      entityType: "contact",
      entityId: contact.id,
      sourceEntity: { type: "Contact", id: contact.id },
      readDecision: canReadContacts(policyInput),
      manageDecision: canManageContacts(policyInput),
      title: contact.name
    } };
  }
  if (input.entityType === "product") {
    const product = await input.dataSource.findProductById?.(input.actor.tenantId, input.entityId);
    if (!product) return entityNotFound();
    return { ok: true, value: {
      entityType: "product",
      entityId: product.id,
      sourceEntity: { type: "Product", id: product.id },
      readDecision: canReadProducts(policyInput),
      manageDecision: canManageProducts(policyInput),
      title: product.name
    } };
  }
  if (input.entityType === "communication_channel") {
    const channel = await input.dataSource.findCommunicationChannel?.(
      input.actor.tenantId,
      input.entityId
    );
    if (!channel) return entityNotFound();
    const channelAccess = await resolveCommunicationChannelAccess({
      actor: input.actor,
      channel,
      dataSource: input.dataSource,
      profile: input.profile
    });
    return { ok: true, value: {
      entityType: "communication_channel",
      entityId: channel.id,
      sourceEntity: { type: "CommunicationChannel", id: channel.id },
      readDecision: channelAccess.readDecision,
      manageDecision: channelAccess.manageDecision,
      title: channel.title
    } };
  }
  if (input.entityType === "project") {
    const project = await findProject(input.dataSource, input.actor.tenantId, input.entityId);
    if (!project) return entityNotFound();
    return { ok: true, value: {
      entityType: "project",
      entityId: project.id,
      sourceEntity: { type: "Project", id: project.id },
      readDecision: canReadProjects(policyInput),
      manageDecision: canManageProjects(policyInput),
      title: project.title
    } };
  }
  const task = await input.dataSource.findTaskById?.(input.actor.tenantId, input.entityId);
  if (!task) return entityNotFound();
  const projectRead = canReadProjects(policyInput);
  const directTaskRead =
    task.ownerUserId === input.actor.id ||
    task.requesterUserId === input.actor.id ||
    task.participants.some((participant) => participant.userId === input.actor.id);
  return { ok: true, value: {
    entityType: "task",
    entityId: task.id,
    sourceEntity: { type: "Task", id: task.id },
    readDecision: projectRead.allowed || directTaskRead
      ? { allowed: true, reason: "same_tenant_permission_granted" }
      : projectRead,
    manageDecision: canEditTasks(policyInput),
    title: task.title
  } };
}

export async function filterCollaborationMentionRecipients(input: {
  actor: TenantUser;
  body: string;
  dataSource: CollaborationEntityAccessDataSource;
  entity: CollaborationEntityAccessContext;
}): Promise<string[]> {
  const rawIds = extractMentionedUserIds(input.body).filter((id) => id !== input.actor.id);
  if (rawIds.length === 0) return [];
  const tenantUsers = await input.dataSource.listUsersByTenantId(input.actor.tenantId);
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

function entityNotFound() {
  return { ok: false as const, status: 404 as const, error: "collaboration_entity_not_found" };
}

async function findProject(
  dataSource: CollaborationEntityAccessDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  return (await dataSource.listProjects?.(tenantId))?.find((project) => project.id === projectId);
}
