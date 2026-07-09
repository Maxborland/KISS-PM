import type { Context } from "hono";

export function setApiSecurityHeaders(context: Context): void {
  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Frame-Options", "DENY");
  context.header("Referrer-Policy", "same-origin");
  context.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  context.header("Cross-Origin-Opener-Policy", "same-origin");
  context.header("Cross-Origin-Resource-Policy", "same-origin");
  context.header("X-Permitted-Cross-Domain-Policies", "none");
  context.header(
    "Content-Security-Policy",
    "base-uri 'self'; frame-ancestors 'none'; object-src 'none'"
  );
}

export function isTrustedBrowserMutationRequest(
  request: Request,
  trustedOrigins: string[] = []
): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const normalizedOrigin = originUrl.origin;
    return (
      normalizedOrigin === requestUrl.origin ||
      trustedOrigins.includes(normalizedOrigin) ||
      isTrustedLoopbackWildcard(originUrl, trustedOrigins)
    );
  } catch {
    return false;
  }
}

export function trustedMutationOriginsFromEnv(
  env: Partial<Pick<NodeJS.ProcessEnv, "KISS_PM_TRUSTED_MUTATION_ORIGINS" | "NODE_ENV">> =
    process.env
): string[] {
  const configuredOrigins = env.KISS_PM_TRUSTED_MUTATION_ORIGINS?.split(",")
    .map((origin) => normalizeTrustedOrigin(origin))
    .filter((origin): origin is string => origin !== null);
  if (configuredOrigins && configuredOrigins.length > 0) return configuredOrigins;
  if (env.NODE_ENV === "production") return [];
  return ["http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*"];
}

// Dev-only convenience: trust a loopback browser origin (e.g. http://localhost:3000) even when the
// API request Host is a non-loopback compose service name (http://api:4000). Previously this also
// required the REQUEST url to be loopback, so browser POST/PATCH through the web container (which
// rewrites /api → http://api:4000) got same_origin_action_required. The loopback wildcard entries
// (http://localhost:*, http://127.0.0.1:*, …) exist ONLY in the non-production defaults — env-
// configured origins are concrete and reject wildcards — so dropping the request-host check cannot
// widen trust in production.
function isTrustedLoopbackWildcard(originUrl: URL, trustedOrigins: string[]): boolean {
  const originWildcard = loopbackWildcardFor(originUrl);
  return originWildcard !== null && trustedOrigins.includes(originWildcard);
}

function loopbackWildcardFor(url: URL): string | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname;
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]" && host !== "::1") return null;
  return `${url.protocol}//${host}:*`;
}

function normalizeTrustedOrigin(rawOrigin: string): string | null {
  const trimmedOrigin = rawOrigin.trim();
  if (trimmedOrigin.length === 0) return null;

  try {
    const url = new URL(trimmedOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}
