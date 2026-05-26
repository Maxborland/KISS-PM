type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseIncludeArchivedQuery(value: string | undefined): ParseResult<boolean> {
  if (value === undefined || value === "") return { ok: true, value: false };
  if (value === "true") return { ok: true, value: true };
  if (value === "false") return { ok: true, value: false };
  return { ok: false, error: "invalid_include_archived" };
}
