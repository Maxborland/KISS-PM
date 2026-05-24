export function parseWorkspaceSearchLimit(value: string | undefined): number {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(20, Math.floor(parsed)));
}

export function parseWorkspaceSearchTypes(value: string | undefined): Set<string> | null {
  if (!value) return null;
  const types = value.split(",").map((item) => item.trim()).filter(Boolean);
  return types.length > 0 ? new Set(types) : null;
}

export function normalizeWorkspaceSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
