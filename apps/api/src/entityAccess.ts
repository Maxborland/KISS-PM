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
import type { AttachmentEntityType, TaskRecord } from "@kiss-pm/persistence";

import type { EntityLookupDataPort } from "./apiDataPorts";
import type { ProjectRecord } from "./apiTypes";
import { resolveCommunicationChannelAccess } from "./communicationChannelAccess";

// Единственный резолвер entityType → (lookup, read/manage policy, sourceEntity, title).
// Вызывающие контексты (attachments/collaboration/communications) пинуют свой
// notFoundError через тонкие обёртки; тип входа они не сужают — неизвестные
// типы (включая "direct") резолвятся fall-through'ом как task.
export type AppEntityType = AttachmentEntityType | CollaborationEntityType;

export type EntityAccessContext<T extends AppEntityType = AppEntityType> = {
  entityType: T;
  entityId: string;
  sourceEntity: { type: string; id: string };
  readDecision: PolicyDecision;
  manageDecision: PolicyDecision;
  title: string;
};

export type EntityAccessError = {
  ok: false;
  status: 404 | 501;
  error: string;
};

export async function resolveEntityAccessContext<T extends AppEntityType>(input: {
  actor: TenantUser;
  dataSource: EntityLookupDataPort;
  entityId: string;
  entityType: T;
  profile: AccessProfile;
  notFoundError?: string;
}): Promise<{ ok: true; value: EntityAccessContext<T> } | EntityAccessError> {
  const notFoundError = input.notFoundError ?? "entity_not_found";
  const policyInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };

  if (input.entityType === "opportunity") {
    const entity = await input.dataSource.findOpportunityById?.(input.actor.tenantId, input.entityId);
    if (!entity) return { ok: false, status: 404, error: notFoundError };
    return ok(input.entityType, {
      entityId: entity.id,
      manageDecision: canManageOpportunities(policyInput),
      readDecision: canReadOpportunities(policyInput),
      sourceEntity: { type: "Opportunity", id: entity.id },
      title: entity.title
    });
  }

  if (input.entityType === "client") {
    const entity = await input.dataSource.findClientById?.(input.actor.tenantId, input.entityId);
    if (!entity) return { ok: false, status: 404, error: notFoundError };
    return ok(input.entityType, {
      entityId: entity.id,
      manageDecision: canManageClients(policyInput),
      readDecision: canReadClients(policyInput),
      sourceEntity: { type: "Client", id: entity.id },
      title: entity.name
    });
  }

  if (input.entityType === "contact") {
    const entity = await input.dataSource.findContactById?.(input.actor.tenantId, input.entityId);
    if (!entity) return { ok: false, status: 404, error: notFoundError };
    return ok(input.entityType, {
      entityId: entity.id,
      manageDecision: canManageContacts(policyInput),
      readDecision: canReadContacts(policyInput),
      sourceEntity: { type: "Contact", id: entity.id },
      title: entity.name
    });
  }

  if (input.entityType === "product") {
    const entity = await input.dataSource.findProductById?.(input.actor.tenantId, input.entityId);
    if (!entity) return { ok: false, status: 404, error: notFoundError };
    return ok(input.entityType, {
      entityId: entity.id,
      manageDecision: canManageProducts(policyInput),
      readDecision: canReadProducts(policyInput),
      sourceEntity: { type: "Product", id: entity.id },
      title: entity.name
    });
  }

  if (input.entityType === "project") {
    const project = await findProject(input.dataSource, input.actor.tenantId, input.entityId);
    if (!project) return { ok: false, status: 404, error: notFoundError };
    return ok(input.entityType, {
      entityId: project.id,
      manageDecision: canManageProjects(policyInput),
      readDecision: canReadProjects(policyInput),
      sourceEntity: { type: "Project", id: project.id },
      title: project.title
    });
  }

  if (input.entityType === "communication_channel") {
    const channel = await input.dataSource.findCommunicationChannel?.(
      input.actor.tenantId,
      input.entityId
    );
    if (!channel) return { ok: false, status: 404, error: notFoundError };
    const channelAccess = await resolveCommunicationChannelAccess({
      actor: input.actor,
      channel,
      dataSource: input.dataSource,
      profile: input.profile
    });
    return ok(input.entityType, {
      entityId: channel.id,
      manageDecision: channelAccess.manageDecision,
      readDecision: channelAccess.readDecision,
      sourceEntity: { type: "CommunicationChannel", id: channel.id },
      title: channel.title
    });
  }

  if (input.entityType === "document") {
    const document = await input.dataSource.findKnowledgeDocumentById?.({
      documentId: input.entityId,
      tenantId: input.actor.tenantId
    });
    if (!document) return { ok: false, status: 404, error: notFoundError };
    const project = await findProject(input.dataSource, input.actor.tenantId, document.projectId);
    if (!project) return { ok: false, status: 404, error: notFoundError };
    return ok(input.entityType, {
      entityId: document.id,
      manageDecision: canManageProjects(policyInput),
      readDecision: canReadProjects(policyInput),
      sourceEntity: { type: "KnowledgeDocument", id: document.id },
      title: document.title
    });
  }

  // Тред агента обслуживается только выделенным guarded-роутом (persistent agent
  // history): generic entity-доступ для 'agent' закрыт fail-closed — иначе
  // fall-through как task позволил бы создать 'agent'-беседу на чужом entityId.
  if (input.entityType === "agent") {
    return { ok: false, status: 404, error: notFoundError };
  }

  const task = await input.dataSource.findTaskById?.(input.actor.tenantId, input.entityId);
  if (!task) return { ok: false, status: 404, error: notFoundError };
  // Литерал "task", а не input.entityType: fall-through достижим и для "direct",
  // и контекст должен остаться task-контекстом (как в прежних резолверах).
  return ok("task" as T, {
    entityId: task.id,
    manageDecision: canEditTasks(policyInput),
    readDecision: canReadTask(input.actor, input.profile, task),
    sourceEntity: { type: "Task", id: task.id },
    title: task.title
  });
}

function ok<T extends AppEntityType>(
  entityType: T,
  value: Omit<EntityAccessContext<T>, "entityType">
): { ok: true; value: EntityAccessContext<T> } {
  return { ok: true, value: { ...value, entityType } };
}

function canReadTask(
  actor: TenantUser,
  profile: AccessProfile,
  task: TaskRecord
): PolicyDecision {
  const projectDecision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
  if (projectDecision.allowed) return projectDecision;
  if (
    task.ownerUserId === actor.id ||
    task.requesterUserId === actor.id ||
    task.participants.some((participant) => participant.userId === actor.id)
  ) {
    return { allowed: true, reason: "same_tenant_permission_granted" };
  }
  return projectDecision;
}

async function findProject(
  dataSource: EntityLookupDataPort,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  return (await dataSource.listProjects?.(tenantId))?.find((project) => project.id === projectId);
}
