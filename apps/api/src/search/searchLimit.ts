import { maxWorkspaceSearchLimit } from "./searchFilterConfig";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseWorkspaceSearchLimit(value: string | undefined): ParseResult<number> {
  if (value === undefined || value === "") return { ok: true, value: maxWorkspaceSearchLimit };
  if (!/^[1-9]\d*$/.test(value)) return { ok: false, error: "search_limit_invalid" };

  const limit = Number(value);
  if (limit > maxWorkspaceSearchLimit) return { ok: false, error: "search_limit_invalid" };
  return { ok: true, value: limit };
}
