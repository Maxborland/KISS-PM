export function getOpportunityIdFromPathname(pathname: string): string | null {
  return getSinglePathId(pathname, "opportunities");
}

export type PlanningProjectTab =
  | "schedule"
  | "resources"
  | "assignments"
  | "calendars"
  | "scenarios"
  | "baseline"
  | "audit"
  | "settings";

export function getProjectIdFromPathname(pathname: string): string | null {
  return getNestedPathId(pathname, "projects");
}

export function getPlanningTabFromPathname(pathname: string): PlanningProjectTab | null {
  const normalized = normalizePathname(pathname);
  const match = /^\/projects\/[^/]+\/([^/]+)\/?$/.exec(normalized);
  const segment = match?.[1];
  if (
    segment === "schedule" ||
    segment === "resources" ||
    segment === "assignments" ||
    segment === "calendars" ||
    segment === "scenarios" ||
    segment === "baseline" ||
    segment === "audit" ||
    segment === "settings"
  ) {
    return segment;
  }
  return null;
}

export function isProjectPlanningPath(pathname: string): boolean {
  return getPlanningTabFromPathname(pathname) !== null;
}

/** @deprecated use isProjectPlanningPath */
export const isProjectSchedulePath = isProjectPlanningPath;

export function getProjectPlanningPath(projectId: string, tab: PlanningProjectTab = "schedule"): string {
  return `/projects/${encodeURIComponent(projectId)}/${tab}`;
}

export const getProjectSchedulePath = (projectId: string) => getProjectPlanningPath(projectId, "schedule");

function normalizePathname(pathname: string): string {
  if (pathname.endsWith("/") && pathname !== "/") return pathname.slice(0, -1);
  return pathname || "/";
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
  const match = new RegExp(`^/${escapedSegment}/([^/]+)/?$`).exec(normalizePathname(pathname));
  const rawId = match?.[1];
  return rawId ? decodeURIComponent(rawId) : null;
}

function getNestedPathId(pathname: string, segment: string): string | null {
  const escapedSegment = segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^/${escapedSegment}/([^/]+)`).exec(normalizePathname(pathname));
  const rawId = match?.[1];
  return rawId ? decodeURIComponent(rawId) : null;
}
