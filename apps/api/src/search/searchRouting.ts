export function routeForEntity(entityType: string, entityId: string): string {
  if (entityType === "project") return `/projects/${entityId}`;
  if (entityType === "task") return `/tasks/${entityId}`;
  if (entityType === "opportunity") return `/opportunities/${entityId}`;
  if (entityType === "client") return `/clients/${entityId}`;
  if (entityType === "contact") return `/contacts/${entityId}`;
  if (entityType === "product") return `/products/${entityId}`;
  return "/";
}
