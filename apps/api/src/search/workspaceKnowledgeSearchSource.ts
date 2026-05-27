import { canReadProjects } from "@kiss-pm/access-control";

import { matches, rankAndLimit, score } from "./searchScoring";
import type { SearchResult, WorkspaceSearchInput } from "./searchTypes";

export async function searchKnowledge(
  input: WorkspaceSearchInput,
  limit: number
): Promise<SearchResult[]> {
  if (!input.dataSource.searchKnowledge) return [];
  const projectDecision = canReadProjects({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!projectDecision.allowed) return [];
  const knowledge = await input.dataSource.searchKnowledge({
    tenantId: input.actor.tenantId,
    query: input.query,
    limit
  });
  const results: SearchResult[] = [];
  if (!input.requestedTypes || input.requestedTypes.has("document")) {
    results.push(...knowledge.documents
      .filter((document) => matches(input.query, document.title, document.summary, document.documentType))
      .map((document) => ({
        id: `document:${document.id}`,
        type: "document",
        title: document.title,
        subtitle: "Документ проекта",
        snippet: document.summary ?? document.documentType,
        entityType: "document",
        entityId: document.id,
        route: `/projects/${document.projectId}/knowledge/documents/${document.id}`,
        updatedAt: document.updatedAt.toISOString(),
        score: score(input.query, document.title, document.summary ?? "", document.documentType),
        source: "knowledge"
      })));
  }
  if (!input.requestedTypes || input.requestedTypes.has("decision")) {
    results.push(...knowledge.decisions
      .filter((decision) => matches(input.query, decision.title, decision.decision, decision.rationale))
      .map((decision) => ({
        id: `decision:${decision.id}`,
        type: "decision",
        title: decision.title,
        subtitle: "Решение",
        snippet: decision.rationale ?? decision.status,
        entityType: "decision",
        entityId: decision.id,
        route: `/projects/${decision.projectId}/knowledge/decisions/${decision.id}`,
        updatedAt: decision.updatedAt.toISOString(),
        score: score(input.query, decision.title, decision.decision, decision.rationale ?? ""),
        source: "knowledge"
      })));
  }
  if (!input.requestedTypes || input.requestedTypes.has("knowledge_action_item")) {
    results.push(...knowledge.actionItems
      .filter((actionItem) => matches(input.query, actionItem.title, actionItem.description, actionItem.status))
      .map((actionItem) => ({
        id: `knowledge_action_item:${actionItem.id}`,
        type: "knowledge_action_item",
        title: actionItem.title,
        subtitle: "Action item",
        snippet: actionItem.description ?? actionItem.status,
        entityType: "knowledge_action_item",
        entityId: actionItem.id,
        route: `/projects/${actionItem.projectId}/knowledge/action-items/${actionItem.id}`,
        updatedAt: actionItem.updatedAt.toISOString(),
        score: score(input.query, actionItem.title, actionItem.description ?? "", actionItem.status),
        source: "knowledge"
      })));
  }
  return rankAndLimit(results, limit);
}
