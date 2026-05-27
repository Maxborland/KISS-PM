export function routeForEntity(entityType: string, entityId: string): string {
  if (entityType === "project") return `/projects/${entityId}`;
  if (entityType === "task") return `/tasks/${entityId}`;
  if (entityType === "opportunity") return `/opportunities/${entityId}`;
  if (entityType === "client") return `/clients/${entityId}`;
  if (entityType === "contact") return `/contacts/${entityId}`;
  if (entityType === "product") return `/products/${entityId}`;
  if (entityType === "document") return `/knowledge/documents/${entityId}`;
  if (entityType === "decision") return `/knowledge/decisions/${entityId}`;
  if (entityType === "knowledge_action_item") return `/knowledge/action-items/${entityId}`;
  return "/";
}
