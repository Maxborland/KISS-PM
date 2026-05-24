import {
  canReadClients,
  canReadContacts,
  canReadOpportunities,
  canReadProducts,
  canReadProjects
} from "@kiss-pm/access-control";
import type { AttachmentEntityType, AttachmentReadModel } from "@kiss-pm/persistence";

import type { ProjectRecord } from "../apiTypes";
import { resolveAttachmentEntityContext } from "../attachmentEntityAccess";
import { matches, rankAndLimit, score } from "./searchScoring";
import { routeForEntity } from "./searchRouting";
import type { SearchResult, WorkspaceSearchInput, WorkspaceSearchSource } from "./searchTypes";

const ATTACHMENT_ACL_SCAN_MULTIPLIER = 10;
const MAX_ATTACHMENT_ACL_SCAN_CANDIDATES = 200;

export const workspaceSearchSources: WorkspaceSearchSource[] = [
  {
    sourceTypes: ["project"],
    search: (input, limit) => searchProjects(input, limit)
  },
  {
    sourceTypes: ["task"],
    search: (input, limit) => searchTasks(input, limit)
  },
  {
    sourceTypes: ["opportunity"],
    search: (input, limit) => searchOpportunities(input, limit)
  },
  {
    sourceTypes: ["client"],
    search: (input, limit) => searchClients(input, limit)
  },
  {
    sourceTypes: ["contact"],
    search: (input, limit) => searchContacts(input, limit)
  },
  {
    sourceTypes: ["product"],
    search: (input, limit) => searchProducts(input, limit)
  },
  {
    sourceTypes: ["file", "external_reference"],
    search: (input, limit) => searchAttachments(input, limit)
  }
];

async function searchProjects(input: WorkspaceSearchInput, limit: number): Promise<SearchResult[]> {
  if (!input.dataSource.listProjects) return [];
  const decision = canReadProjects({ actor: input.actor, profile: input.profile, targetTenantId: input.actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await input.dataSource.listProjects(input.actor.tenantId))
    .filter((project) => matches(input.query, project.title, project.clientName, project.status))
    .map((project) => ({
      id: `project:${project.id}`,
      type: "project",
      title: project.title,
      subtitle: project.clientName,
      snippet: project.status,
      entityType: "project",
      entityId: project.id,
      route: `/projects/${project.id}`,
      updatedAt: project.activatedAt?.toISOString() ?? project.createdAt.toISOString(),
      score: score(input.query, project.title, project.clientName),
      source: "projects"
    })), limit);
}

async function searchTasks(input: WorkspaceSearchInput, limit: number): Promise<SearchResult[]> {
  const projectDecision = canReadProjects({ actor: input.actor, profile: input.profile, targetTenantId: input.actor.tenantId });
  const tasks = [];
  if (projectDecision.allowed && input.dataSource.listProjects && input.dataSource.listProjectTasks) {
    for (const project of await input.dataSource.listProjects(input.actor.tenantId)) {
      tasks.push(...(await input.dataSource.listProjectTasks(input.actor.tenantId, project.id)).map((task) => ({ task, project })));
    }
  } else if (input.dataSource.listMyWorkTasks) {
    const myWorkTasks = await input.dataSource.listMyWorkTasks(input.actor.tenantId, input.actor.id);
    tasks.push(...myWorkTasks.map((task) => ({ task, project: undefined as ProjectRecord | undefined })));
  }

  return rankAndLimit(tasks
    .filter(({ task }) => matches(input.query, task.title, task.description, task.statusName))
    .map(({ task, project }) => ({
      id: `task:${task.id}`,
      type: "task",
      title: task.title,
      subtitle: project?.title ?? "Задача",
      snippet: task.description ?? task.statusName,
      entityType: "task",
      entityId: task.id,
      route: `/tasks/${task.id}`,
      updatedAt: task.updatedAt.toISOString(),
      score: score(input.query, task.title, task.description ?? "", task.statusName),
      source: "tasks"
    })), limit);
}

async function searchOpportunities(input: WorkspaceSearchInput, limit: number): Promise<SearchResult[]> {
  if (!input.dataSource.listOpportunities) return [];
  const decision = canReadOpportunities({ actor: input.actor, profile: input.profile, targetTenantId: input.actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await input.dataSource.listOpportunities(input.actor.tenantId))
    .filter((item) => matches(input.query, item.title, item.clientName, item.contactName, item.status))
    .map((item) => ({
      id: `opportunity:${item.id}`,
      type: "opportunity",
      title: item.title,
      subtitle: item.clientName,
      snippet: item.status,
      entityType: "opportunity",
      entityId: item.id,
      route: `/opportunities/${item.id}`,
      updatedAt: item.updatedAt.toISOString(),
      score: score(input.query, item.title, item.clientName, item.contactName),
      source: "opportunities"
    })), limit);
}

async function searchClients(input: WorkspaceSearchInput, limit: number): Promise<SearchResult[]> {
  if (!input.dataSource.listClients) return [];
  const decision = canReadClients({ actor: input.actor, profile: input.profile, targetTenantId: input.actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await input.dataSource.listClients(input.actor.tenantId))
    .filter((item) => matches(input.query, item.name, item.description, item.status))
    .map((item) => ({
      id: `client:${item.id}`,
      type: "client",
      title: item.name,
      subtitle: "Клиент",
      snippet: item.description ?? item.status,
      entityType: "client",
      entityId: item.id,
      route: `/clients/${item.id}`,
      updatedAt: item.updatedAt.toISOString(),
      score: score(input.query, item.name, item.description ?? ""),
      source: "clients"
    })), limit);
}

async function searchContacts(input: WorkspaceSearchInput, limit: number): Promise<SearchResult[]> {
  if (!input.dataSource.listContacts) return [];
  const decision = canReadContacts({ actor: input.actor, profile: input.profile, targetTenantId: input.actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await input.dataSource.listContacts(input.actor.tenantId))
    .filter((item) => matches(input.query, item.name, item.email, item.role, item.phone))
    .map((item) => ({
      id: `contact:${item.id}`,
      type: "contact",
      title: item.name,
      subtitle: item.email ?? "Контакт",
      snippet: item.role ?? item.phone ?? "",
      entityType: "contact",
      entityId: item.id,
      route: `/contacts/${item.id}`,
      updatedAt: item.updatedAt.toISOString(),
      score: score(input.query, item.name, item.email ?? "", item.role ?? ""),
      source: "contacts"
    })), limit);
}

async function searchProducts(input: WorkspaceSearchInput, limit: number): Promise<SearchResult[]> {
  if (!input.dataSource.listProducts) return [];
  const decision = canReadProducts({ actor: input.actor, profile: input.profile, targetTenantId: input.actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await input.dataSource.listProducts(input.actor.tenantId))
    .filter((item) => matches(input.query, item.name, item.sku, item.description, item.type))
    .map((item) => ({
      id: `product:${item.id}`,
      type: "product",
      title: item.name,
      subtitle: item.sku ?? "Товар/услуга",
      snippet: item.description ?? item.type,
      entityType: "product",
      entityId: item.id,
      route: `/products/${item.id}`,
      updatedAt: item.updatedAt.toISOString(),
      score: score(input.query, item.name, item.sku ?? "", item.description ?? ""),
      source: "products"
    })), limit);
}

async function searchAttachments(input: WorkspaceSearchInput, limit: number): Promise<SearchResult[]> {
  if (!input.dataSource.searchAttachments) return [];
  const visible: AttachmentReadModel[] = [];

  const maxCandidates = Math.min(
    Math.max(limit, limit * ATTACHMENT_ACL_SCAN_MULTIPLIER),
    MAX_ATTACHMENT_ACL_SCAN_CANDIDATES
  );
  let offset = 0;
  while (visible.length < limit && offset < maxCandidates) {
    const pageLimit = Math.min(limit, maxCandidates - offset);
    const attachments = await input.dataSource.searchAttachments({
      tenantId: input.actor.tenantId,
      query: input.query,
      limit: pageLimit,
      offset
    });
    if (attachments.length === 0) break;
    for (const attachment of attachments) {
      const entity = await resolveAttachmentEntityContext({
        actor: input.actor,
        dataSource: input.dataSource,
        entityId: attachment.entityId,
        entityType: attachment.entityType as AttachmentEntityType,
        profile: input.profile
      });
      if (entity.ok && entity.value.readDecision.allowed && matchesRequestedAttachmentKind(input, attachment)) {
        visible.push(attachment);
      }
    }
    offset += attachments.length;
    if (attachments.length < pageLimit) break;
  }

  return rankAndLimit(visible.map((attachment) => {
    const title = attachment.fileAsset?.safeDisplayName ?? attachment.externalReference?.title ?? "Вложение";
    const subtitle = attachment.fileAsset?.mimeType ?? attachment.externalReference?.connectorType ?? "Ссылка";
    const kind = attachment.fileAsset ? "file" : "external_reference";
    return {
      id: `${kind}:${attachment.id}`,
      type: kind,
      title,
      subtitle,
      snippet: attachment.externalReference?.url ?? attachment.fileAsset?.mimeType ?? "",
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      route: routeForEntity(attachment.entityType, attachment.entityId),
      updatedAt: attachment.createdAt.toISOString(),
      score: score(input.query, title, subtitle, attachment.externalReference?.url ?? ""),
      source: "attachments"
    };
  }), limit);
}

function matchesRequestedAttachmentKind(
  input: WorkspaceSearchInput,
  attachment: AttachmentReadModel
): boolean {
  if (!input.requestedTypes) return true;
  const kind = attachment.fileAsset ? "file" : "external_reference";
  return input.requestedTypes.has(kind);
}
