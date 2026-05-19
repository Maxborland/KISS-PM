export function makeClientGeneratedId(prefix: string, value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const asciiSlug = slug.replace(/[^a-z0-9-]/g, "") || "item";

  return `${prefix}-${asciiSlug}-${Date.now().toString(36)}`;
}
