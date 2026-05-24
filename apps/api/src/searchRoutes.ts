import {
  canReadClients,
  canReadContacts,
  canReadOpportunities,
  canReadProducts,
  canReadProjects,
  type AccessProfile
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { AttachmentEntityType, AttachmentReadModel } from "@kiss-pm/persistence";
import type { Hono } from "hono";

import type { ApiTenantDataSource, ProjectRecord } from "./apiTypes";
import { resolveAttachmentEntityContext } from "./attachmentEntityAccess";

type SearchRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
};

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  snippet: string;
  entityType: string;
  entityId: string;
  route: string;
  updatedAt: string;
  score: number;
  source: string;
};

export function registerSearchRoutes(app: Hono, deps: SearchRouteDeps) {
  app.get("/api/workspace/search", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const query = normalizeQuery(context.req.query("q") ?? "");
    if (query.length < 2) {
      return context.json({ error: "search_query_too_short" }, 400);
    }
    const limit = parseLimit(context.req.query("limit"));
    const sourceLimit = limit * 2;
    const requestedTypes = parseTypes(context.req.query("types"));
    const profile = await deps.getActorProfile(actor);

    const sourceResults = await Promise.all([
      maybeSearch(requestedTypes, ["project"], () =>
        searchProjects(deps.dataSource, actor, profile, query, sourceLimit)
      ),
      maybeSearch(requestedTypes, ["task"], () =>
        searchTasks(deps.dataSource, actor, profile, query, sourceLimit)
      ),
      maybeSearch(requestedTypes, ["opportunity"], () =>
        searchOpportunities(deps.dataSource, actor, profile, query, sourceLimit)
      ),
      maybeSearch(requestedTypes, ["client"], () =>
        searchClients(deps.dataSource, actor, profile, query, sourceLimit)
      ),
      maybeSearch(requestedTypes, ["contact"], () =>
        searchContacts(deps.dataSource, actor, profile, query, sourceLimit)
      ),
      maybeSearch(requestedTypes, ["product"], () =>
        searchProducts(deps.dataSource, actor, profile, query, sourceLimit)
      ),
      maybeSearch(requestedTypes, ["file", "external_reference"], () =>
        searchAttachments(deps.dataSource, actor, profile, query, sourceLimit)
      )
    ]);

    const results = sourceResults
      .flat()
      .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);

    return context.json({ results });
  });
}

async function maybeSearch(
  requestedTypes: Set<string> | null,
  sourceTypes: string[],
  operation: () => Promise<SearchResult[]>
): Promise<SearchResult[]> {
  if (requestedTypes && !sourceTypes.some((type) => requestedTypes.has(type))) return [];
  return operation();
}

async function searchProjects(
  dataSource: ApiTenantDataSource,
  actor: TenantUser,
  profile: AccessProfile,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  if (!dataSource.listProjects) return [];
  const decision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await dataSource.listProjects(actor.tenantId))
    .filter((project) => matches(query, project.title, project.clientName, project.status))
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
      score: score(query, project.title, project.clientName),
      source: "projects"
    })), limit);
}

async function searchTasks(
  dataSource: ApiTenantDataSource,
  actor: TenantUser,
  profile: AccessProfile,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const projectDecision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
  const tasks = [];
  if (projectDecision.allowed && dataSource.listProjects && dataSource.listProjectTasks) {
    for (const project of await dataSource.listProjects(actor.tenantId)) {
      tasks.push(...(await dataSource.listProjectTasks(actor.tenantId, project.id)).map((task) => ({ task, project })));
    }
  } else if (dataSource.listMyWorkTasks) {
    const myWorkTasks = await dataSource.listMyWorkTasks(actor.tenantId, actor.id);
    tasks.push(...myWorkTasks.map((task) => ({ task, project: undefined as ProjectRecord | undefined })));
  }

  return rankAndLimit(tasks
    .filter(({ task }) => matches(query, task.title, task.description, task.statusName))
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
      score: score(query, task.title, task.description ?? "", task.statusName),
      source: "tasks"
    })), limit);
}

async function searchOpportunities(
  dataSource: ApiTenantDataSource,
  actor: TenantUser,
  profile: AccessProfile,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  if (!dataSource.listOpportunities) return [];
  const decision = canReadOpportunities({ actor, profile, targetTenantId: actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await dataSource.listOpportunities(actor.tenantId))
    .filter((item) => matches(query, item.title, item.clientName, item.contactName, item.status))
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
      score: score(query, item.title, item.clientName, item.contactName),
      source: "opportunities"
    })), limit);
}

async function searchClients(
  dataSource: ApiTenantDataSource,
  actor: TenantUser,
  profile: AccessProfile,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  if (!dataSource.listClients) return [];
  const decision = canReadClients({ actor, profile, targetTenantId: actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await dataSource.listClients(actor.tenantId))
    .filter((item) => matches(query, item.name, item.description, item.status))
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
      score: score(query, item.name, item.description ?? ""),
      source: "clients"
    })), limit);
}

async function searchContacts(
  dataSource: ApiTenantDataSource,
  actor: TenantUser,
  profile: AccessProfile,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  if (!dataSource.listContacts) return [];
  const decision = canReadContacts({ actor, profile, targetTenantId: actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await dataSource.listContacts(actor.tenantId))
    .filter((item) => matches(query, item.name, item.email, item.role, item.phone))
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
      score: score(query, item.name, item.email ?? "", item.role ?? ""),
      source: "contacts"
    })), limit);
}

async function searchProducts(
  dataSource: ApiTenantDataSource,
  actor: TenantUser,
  profile: AccessProfile,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  if (!dataSource.listProducts) return [];
  const decision = canReadProducts({ actor, profile, targetTenantId: actor.tenantId });
  if (!decision.allowed) return [];
  return rankAndLimit((await dataSource.listProducts(actor.tenantId))
    .filter((item) => matches(query, item.name, item.sku, item.description, item.type))
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
      score: score(query, item.name, item.sku ?? "", item.description ?? ""),
      source: "products"
    })), limit);
}

async function searchAttachments(
  dataSource: ApiTenantDataSource,
  actor: TenantUser,
  profile: AccessProfile,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  if (!dataSource.searchAttachments) return [];
  const attachments = await dataSource.searchAttachments({
    tenantId: actor.tenantId,
    query,
    limit
  });
  const visible: AttachmentReadModel[] = [];
  for (const attachment of attachments) {
    const entity = await resolveAttachmentEntityContext({
      actor,
      dataSource,
      entityId: attachment.entityId,
      entityType: attachment.entityType as AttachmentEntityType,
      profile
    });
    if (entity.ok && entity.value.readDecision.allowed) visible.push(attachment);
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
      score: score(query, title, subtitle, attachment.externalReference?.url ?? ""),
      source: "attachments"
    };
  }), limit);
}

function parseLimit(value: string | undefined): number {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(20, Math.floor(parsed)));
}

function parseTypes(value: string | undefined): Set<string> | null {
  if (!value) return null;
  const types = value.split(",").map((item) => item.trim()).filter(Boolean);
  return types.length > 0 ? new Set(types) : null;
}

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function matches(query: string, ...values: Array<string | null | undefined>): boolean {
  return values.some((value) => value?.toLowerCase().includes(query));
}

function score(query: string, ...values: string[]): number {
  let best = 0;
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (normalized === query) best = Math.max(best, 100);
    else if (normalized.startsWith(query)) best = Math.max(best, 80);
    else if (normalized.includes(query)) best = Math.max(best, 50);
  }
  return best;
}

function rankAndLimit(results: SearchResult[], limit: number): SearchResult[] {
  return results
    .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

function routeForEntity(entityType: string, entityId: string): string {
  if (entityType === "project") return `/projects/${entityId}`;
  if (entityType === "task") return `/tasks/${entityId}`;
  if (entityType === "opportunity") return `/opportunities/${entityId}`;
  if (entityType === "client") return `/clients/${entityId}`;
  if (entityType === "contact") return `/contacts/${entityId}`;
  if (entityType === "product") return `/products/${entityId}`;
  return "/";
}
