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
import type { CollaborationEntityType, TenantUser } from "@kiss-pm/domain";

import type { ApiTenantDataSource, ProjectRecord } from "../apiTypes";
import { resolveCommunicationChannelAccess } from "../communicationChannelAccess";

export type CommunicationEntityAccessContext = {
  entityType: CollaborationEntityType;
  entityId: string;
  sourceEntity: { type: string; id: string };
  readDecision: PolicyDecision;
  manageDecision: PolicyDecision;
  title: string;
};

export type CommunicationEntityAccessDataSource = Pick<
  ApiTenantDataSource,
  | "findClientById"
  | "findCommunicationChannel"
  | "findContactById"
  | "findOpportunityById"
  | "findProductById"
  | "findTaskById"
  | "listCommunicationChannelMembers"
  | "listProjects"
>;

export async function resolveCommunicationEntityAccess(input: {
  actor: TenantUser;
  dataSource: CommunicationEntityAccessDataSource;
  entityId: string;
  entityType: CollaborationEntityType;
  profile: AccessProfile;
}): Promise<
  | { ok: true; value: CommunicationEntityAccessContext }
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
      entityId: opportunity.id,
      entityType: "opportunity",
      manageDecision: canManageOpportunities(policyInput),
      readDecision: canReadOpportunities(policyInput),
      sourceEntity: { type: "Opportunity", id: opportunity.id },
      title: opportunity.title
    } };
  }
  if (input.entityType === "client") {
    const client = await input.dataSource.findClientById?.(input.actor.tenantId, input.entityId);
    if (!client) return entityNotFound();
    return { ok: true, value: {
      entityId: client.id,
      entityType: "client",
      manageDecision: canManageClients(policyInput),
      readDecision: canReadClients(policyInput),
      sourceEntity: { type: "Client", id: client.id },
      title: client.name
    } };
  }
  if (input.entityType === "contact") {
    const contact = await input.dataSource.findContactById?.(input.actor.tenantId, input.entityId);
    if (!contact) return entityNotFound();
    return { ok: true, value: {
      entityId: contact.id,
      entityType: "contact",
      manageDecision: canManageContacts(policyInput),
      readDecision: canReadContacts(policyInput),
      sourceEntity: { type: "Contact", id: contact.id },
      title: contact.name
    } };
  }
  if (input.entityType === "product") {
    const product = await input.dataSource.findProductById?.(input.actor.tenantId, input.entityId);
    if (!product) return entityNotFound();
    return { ok: true, value: {
      entityId: product.id,
      entityType: "product",
      manageDecision: canManageProducts(policyInput),
      readDecision: canReadProducts(policyInput),
      sourceEntity: { type: "Product", id: product.id },
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
      entityId: channel.id,
      entityType: "communication_channel",
      manageDecision: channelAccess.manageDecision,
      readDecision: channelAccess.readDecision,
      sourceEntity: { type: "CommunicationChannel", id: channel.id },
      title: channel.title
    } };
  }
  if (input.entityType === "project") {
    const project = await findProject(input.dataSource, input.actor.tenantId, input.entityId);
    if (!project) return entityNotFound();
    return { ok: true, value: {
      entityId: project.id,
      entityType: "project",
      manageDecision: canManageProjects(policyInput),
      readDecision: canReadProjects(policyInput),
      sourceEntity: { type: "Project", id: project.id },
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
    entityId: task.id,
    entityType: "task",
    manageDecision: canEditTasks(policyInput),
    readDecision: projectRead.allowed || directTaskRead
      ? { allowed: true, reason: "same_tenant_permission_granted" }
      : projectRead,
    sourceEntity: { type: "Task", id: task.id },
    title: task.title
  } };
}

function entityNotFound() {
  return { ok: false as const, status: 404 as const, error: "communications_entity_not_found" };
}

async function findProject(
  dataSource: CommunicationEntityAccessDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  return (await dataSource.listProjects?.(tenantId))?.find((project) => project.id === projectId);
}
