// Маршруты — РЕАЛЬНЫЕ страницы web-приложения (по ним переходит глобальный поиск).
// У задач и справочников CRM нет детальных страниц — ведём на ближайший живой экран.
// Клиенты/контакты: entity-карточек нет (решение Р12), deep-link — список с
// `?entity=<id>`: поверхность подсвечивает строку и прокручивает её в вид.
export function routeForEntity(entityType: string, entityId: string): string {
  if (entityType === "project") return `/projects/${entityId}`;
  if (entityType === "task") return "/my-work";
  if (entityType === "opportunity") return `/crm/deals/${entityId}`;
  if (entityType === "client") return `/crm/clients?entity=${encodeURIComponent(entityId)}`;
  if (entityType === "contact") return `/crm/contacts?entity=${encodeURIComponent(entityId)}`;
  if (entityType === "product") return "/crm/products";
  if (entityType === "document") return `/knowledge/documents/${entityId}`;
  if (entityType === "decision") return `/knowledge/decisions/${entityId}`;
  if (entityType === "knowledge_action_item") return `/knowledge/action-items/${entityId}`;
  return "/";
}
