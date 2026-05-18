export function getOptionalString(input: unknown, key: string): string | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getStringField(input: unknown, key: string): string | undefined {
  if (!input || typeof input !== "object" || !(key in input)) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : undefined;
}

export function isWorkspaceTheme(value: string): value is "light" | "dark" {
  return value === "light" || value === "dark";
}

export function isAccentColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
