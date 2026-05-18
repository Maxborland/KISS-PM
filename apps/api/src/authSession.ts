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
  return parseCookie(cookieHeader)[sessionCookieName];
}

type CookieOptions = {
  secure?: boolean;
};

export function buildSessionCookieHeader(
  rawToken: string,
  options: CookieOptions = {}
) {
  return appendSecureFlag(
    `${sessionCookieName}=${rawToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionTtlSeconds}`,
    options
  );
}

export function buildExpiredSessionCookieHeader(options: CookieOptions = {}) {
  return appendSecureFlag(
    `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    options
  );
}

export function shouldUseSecureCookies(
  env: Partial<Pick<NodeJS.ProcessEnv, "KISS_PM_SECURE_COOKIES">> = process.env
) {
  return env.KISS_PM_SECURE_COOKIES === "true";
}

function appendSecureFlag(header: string, options: CookieOptions) {
  return options.secure ? `${header}; Secure` : header;
}
