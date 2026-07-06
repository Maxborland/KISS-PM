import { readSecureCookiePolicy } from "./runtimeSecurityConfig";

export const sessionCookieName = "kiss_pm_session";
export const sessionTtlSeconds = 7 * 24 * 60 * 60;
export const sessionTtlMs = sessionTtlSeconds * 1000;

export function parseCookie(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};

  return Object.fromEntries(
    cookieHeader.split(";").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    })
  );
}

export function getSessionTokenFromCookie(cookieHeader: string | null) {
  const token = parseCookie(cookieHeader)[sessionCookieName];
  return isSessionToken(token) ? token : undefined;
}

function isSessionToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

type CookieOptions = {
  secure?: boolean;
  // Срок жизни cookie в секундах. По умолчанию — sessionTtlSeconds; логин передаёт
  // тайм-аут из политики безопасности тенанта, чтобы cookie не пережила серверную
  // сессию и не умирала раньше неё (политики > 7 дней тоже работают).
  maxAgeSeconds?: number;
};

export function buildSessionCookieHeader(
  rawToken: string,
  options: CookieOptions = {}
) {
  const maxAge = options.maxAgeSeconds ?? sessionTtlSeconds;
  return appendSecureFlag(
    `${sessionCookieName}=${rawToken}; HttpOnly; Path=/; SameSite=Lax; Priority=High; Max-Age=${maxAge}`,
    options
  );
}

export function buildExpiredSessionCookieHeader(options: CookieOptions = {}) {
  return appendSecureFlag(
    `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Priority=High; Max-Age=0`,
    options
  );
}

export function shouldUseSecureCookies(
  env: Partial<Pick<NodeJS.ProcessEnv, "KISS_PM_SECURE_COOKIES" | "NODE_ENV">> = process.env
) {
  return readSecureCookiePolicy(env);
}

function appendSecureFlag(header: string, options: CookieOptions) {
  return options.secure ? `${header}; Secure` : header;
}
