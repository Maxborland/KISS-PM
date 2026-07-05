// Маршруты — РЕАЛЬНЫЕ страницы web-приложения (по ним переходит глобальный поиск).
// У задач и справочников CRM нет детальных страниц — ведём на ближайший живой экран.
export function routeForEntity(entityType: string, entityId: string): string {
  if (entityType === "project") return `/projects/${entityId}`;
  if (entityType === "task") return "/my-work";
  if (entityType === "opportunity") return `/crm/deals/${entityId}`;
  if (entityType === "client") return "/crm/clients";
  if (entityType === "contact") return "/crm/contacts";
  if (entityType === "product") return "/crm/products";
  if (entityType === "document") return `/knowledge/documents/${entityId}`;
  if (entityType === "decision") return `/knowledge/decisions/${entityId}`;
  if (entityType === "knowledge_action_item") return `/knowledge/action-items/${entityId}`;
  return "/";
}
