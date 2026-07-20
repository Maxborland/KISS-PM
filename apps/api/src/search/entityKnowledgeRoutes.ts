/* Маршруты знаний. Детальных страниц у документов/решений/action items НЕТ:
   под apps/web/src/app/projects/[id]/knowledge/ лежит только page.tsx. Реальная
   поверхность одна и раскрывает элемент по query-параметру
   (apps/web/src/delivery/knowledge/knowledge-surface.tsx: document/decision/actionItem).
   Старая форма `/knowledge/<вид>/<id>` вела в 404 Next.js. */

// `undefined` явно в типе: exactOptionalPropertyTypes, а вызывающие стороны
// передают projectId найденного документа, которого может не быть.
export type EntityRouteContext = { projectId?: string | null | undefined };

const KNOWLEDGE_QUERY_PARAM: Record<string, string> = {
  document: "document",
  decision: "decision",
  knowledge_action_item: "actionItem"
};

/** `encodedEntityId` уже закодирован вызывающей стороной. Знание живёт внутри проекта:
    без projectId deep-link построить нельзя — честно ведём в список проектов. */
export function knowledgeRoute(
  entityType: string,
  encodedEntityId: string,
  context: EntityRouteContext
): string {
  const queryParam = KNOWLEDGE_QUERY_PARAM[entityType];
  if (!queryParam) return "/";
  if (!context.projectId) return "/projects";
  const projectId = encodeURIComponent(context.projectId);
  return `/projects/${projectId}/knowledge?${queryParam}=${encodedEntityId}`;
}
