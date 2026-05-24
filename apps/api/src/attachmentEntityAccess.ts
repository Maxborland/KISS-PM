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
import type { TenantUser } from "@kiss-pm/domain";
import type { AttachmentEntityType, TaskRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource, ProjectRecord } from "./apiTypes";

export type AttachmentEntityContext = {
  entityType: AttachmentEntityType;
  entityId: string;
  sourceEntity: { type: string; id: string };
  readDecision: PolicyDecision;
  manageDecision: PolicyDecision;
};

export async function resolveAttachmentEntityContext(input: {
  actor: TenantUser;
  dataSource: ApiTenantDataSource;
  entityId: string;
  entityType: AttachmentEntityType;
  profile: AccessProfile;
}): Promise<
  | { ok: true; value: AttachmentEntityContext }
  | { ok: false; status: 400 | 404 | 501; error: string }
> {
  const policyInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };
  if (input.entityType === "opportunity") {
    const entity = await input.dataSource.findOpportunityById?.(input.actor.tenantId, input.entityId);
    if (!entity) return { ok: false, status: 404, error: "attachment_entity_not_found" };
    return { ok: true, value: {
      entityType: "opportunity",
      entityId: entity.id,
      sourceEntity: { type: "Opportunity", id: entity.id },
      readDecision: canReadOpportunities(policyInput),
      manageDecision: canManageOpportunities(policyInput)
    } };
  }
  if (input.entityType === "client") {
    const entity = await input.dataSource.findClientById?.(input.actor.tenantId, input.entityId);
    if (!entity) return { ok: false, status: 404, error: "attachment_entity_not_found" };
    return { ok: true, value: {
      entityType: "client",
      entityId: entity.id,
      sourceEntity: { type: "Client", id: entity.id },
      readDecision: canReadClients(policyInput),
      manageDecision: canManageClients(policyInput)
    } };
  }
  if (input.entityType === "contact") {
    const entity = await input.dataSource.findContactById?.(input.actor.tenantId, input.entityId);
    if (!entity) return { ok: false, status: 404, error: "attachment_entity_not_found" };
    return { ok: true, value: {
      entityType: "contact",
      entityId: entity.id,
      sourceEntity: { type: "Contact", id: entity.id },
      readDecision: canReadContacts(policyInput),
      manageDecision: canManageContacts(policyInput)
    } };
  }
  if (input.entityType === "product") {
    const entity = await input.dataSource.findProductById?.(input.actor.tenantId, input.entityId);
    if (!entity) return { ok: false, status: 404, error: "attachment_entity_not_found" };
    return { ok: true, value: {
      entityType: "product",
      entityId: entity.id,
      sourceEntity: { type: "Product", id: entity.id },
      readDecision: canReadProducts(policyInput),
      manageDecision: canManageProducts(policyInput)
    } };
  }
  if (input.entityType === "project") {
    const project = await findProject(input.dataSource, input.actor.tenantId, input.entityId);
    if (!project) return { ok: false, status: 404, error: "attachment_entity_not_found" };
    return { ok: true, value: {
      entityType: "project",
      entityId: project.id,
      sourceEntity: { type: "Project", id: project.id },
      readDecision: canReadProjects(policyInput),
      manageDecision: canManageProjects(policyInput)
    } };
  }

  const task = await input.dataSource.findTaskById?.(input.actor.tenantId, input.entityId);
  if (!task) return { ok: false, status: 404, error: "attachment_entity_not_found" };
  return { ok: true, value: {
    entityType: "task",
    entityId: task.id,
    sourceEntity: { type: "Task", id: task.id },
    readDecision: canReadTaskAttachment(input.actor, input.profile, task),
    manageDecision: canManageTaskAttachment(input.actor, input.profile)
  } };
}

function canReadTaskAttachment(
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

function canManageTaskAttachment(
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  return canEditTasks({ actor, profile, targetTenantId: actor.tenantId });
}

async function findProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  return (await dataSource.listProjects?.(tenantId))?.find((project) => project.id === projectId);
}
