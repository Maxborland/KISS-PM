export function getOpportunityIdFromPathname(pathname: string): string | null {
  return getSinglePathId(pathname, "opportunities");
}

export function getProjectIdFromPathname(pathname: string): string | null {
  return getSinglePathId(pathname, "projects");
}

export function getClientIdFromPathname(pathname: string): string | null {
  return getSinglePathId(pathname, "clients");
}

export function getContactIdFromPathname(pathname: string): string | null {
  return getSinglePathId(pathname, "contacts");
}

export function getProductIdFromPathname(pathname: string): string | null {
  return getSinglePathId(pathname, "products");
}

export function getTaskIdFromPathname(pathname: string): string | null {
  return getSinglePathId(pathname, "tasks");
}

function getSinglePathId(pathname: string, segment: string): string | null {
  const escapedSegment = segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^/${escapedSegment}/([^/]+)/?$`).exec(pathname);
  const rawId = match?.[1];
  return rawId ? decodeURIComponent(rawId) : null;
}
