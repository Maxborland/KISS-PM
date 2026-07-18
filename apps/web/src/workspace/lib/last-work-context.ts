export type LastWorkContext = {
  href: string;
  label: string;
};

type ContextStorage = Pick<Storage, "getItem" | "setItem">;

const allowedRoutes = ["/agent", "/my-work", "/projects", "/crm/deals", "/communications/chat"] as const;

export function contextStorageKey(tenantId: string, userId: string): string {
  return `kiss-pm:last-work:${encodeURIComponent(tenantId)}:${encodeURIComponent(userId)}`;
}

export function buildLastWorkContext(pathname: string, search: string, label: string): LastWorkContext | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  const allowed = allowedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!allowed) return null;

  const source = new URLSearchParams(search);
  const safe = new URLSearchParams();
  const peekKey = pathname === "/my-work" ? "task" : pathname === "/crm/deals" ? "deal" : null;
  if (peekKey) {
    const value = source.get(peekKey)?.trim();
    if (value && value.length <= 200) safe.set(peekKey, value);
  }

  return {
    href: `${pathname}${safe.size > 0 ? `?${safe.toString()}` : ""}`,
    label: label.trim() || "Продолжить работу"
  };
}

export function writeLastWorkContext(
  storage: ContextStorage,
  tenantId: string,
  userId: string,
  context: LastWorkContext
): void {
  storage.setItem(contextStorageKey(tenantId, userId), JSON.stringify(context));
}

export function readLastWorkContext(
  storage: ContextStorage,
  tenantId: string,
  userId: string
): LastWorkContext | null {
  try {
    const raw = storage.getItem(contextStorageKey(tenantId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { href?: unknown; label?: unknown };
    if (typeof parsed.href !== "string" || typeof parsed.label !== "string") return null;
    const url = new URL(parsed.href, "http://workspace.local");
    if (url.origin !== "http://workspace.local") return null;
    return buildLastWorkContext(url.pathname, url.search, parsed.label);
  } catch {
    return null;
  }
}
