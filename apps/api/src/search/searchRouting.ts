// ЕДИНСТВЕННЫЙ владелец deep-link маршрутов сущностей: только РЕАЛЬНЫЕ сегменты
// apps/web/src/app. Клиенты/контакты — карточек нет (решение Р12), ведём в список
// с `?entity=` (подсветка строки). Знания — внутрь проекта, см. entityKnowledgeRoutes.
import { knowledgeRoute, type EntityRouteContext } from "./entityKnowledgeRoutes";

export function routeForEntity(entityType: string, entityId: string, context: EntityRouteContext = {}): string {
  const id = encodeURIComponent(entityId);
  if (entityType === "project") return `/projects/${id}`;
  if (entityType === "task") return `/tasks/${id}`;
  if (entityType === "opportunity") return `/crm/deals/${id}`;
  if (entityType === "client") return `/crm/clients?entity=${id}`;
  if (entityType === "contact") return `/crm/contacts?entity=${id}`;
  if (entityType === "product") return "/crm/products";
  return knowledgeRoute(entityType, id, context);
}
