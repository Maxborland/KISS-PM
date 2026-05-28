export function uniqueGanttId(
  prefix: string,
  usedIds: Iterable<string>,
  preferredId?: string
): string {
  const used = new Set(usedIds);
  if (preferredId && !used.has(preferredId)) return preferredId;

  const stem = preferredId ?? prefix;
  let index = used.size + 1;
  let candidate = `${stem}-${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${stem}-${index}`;
  }
  return candidate;
}
