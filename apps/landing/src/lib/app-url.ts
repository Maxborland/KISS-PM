export function appUrl(path: `/${string}`, base = import.meta.env.PUBLIC_APP_URL ?? ""): string {
  const normalizedBase = base.trim().replace(/\/+$/, "");
  return normalizedBase.length > 0 ? `${normalizedBase}${path}` : path;
}
