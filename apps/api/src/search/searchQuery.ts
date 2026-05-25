import { maxWorkspaceSearchQueryLength, maxWorkspaceSearchTypesLength, workspaceSearchTypes } from "./searchFilterConfig";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseWorkspaceSearchQuery(value: string | undefined): ParseResult<string> {
  const query = normalizeWorkspaceSearchQuery(value ?? "");
  if (query.length < 2) return { ok: false, error: "search_query_too_short" };
  if (query.length > maxWorkspaceSearchQueryLength) return { ok: false, error: "search_query_invalid" };
  return { ok: true, value: query };
}

export function parseWorkspaceSearchTypes(value: string | undefined): ParseResult<Set<string> | null> {
  if (!value) return { ok: true, value: null };
  if (value.length > maxWorkspaceSearchTypesLength) return { ok: false, error: "search_types_invalid" };
  const types = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (types.length === 0) return { ok: true, value: null };
  const valid = types.length <= workspaceSearchTypes.size && types.every((type) => workspaceSearchTypes.has(type));
  return valid ? { ok: true, value: new Set(types) } : { ok: false, error: "search_types_invalid" };
}

export function normalizeWorkspaceSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
