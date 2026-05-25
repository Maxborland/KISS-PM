import { describe, expect, it } from "vitest";
import {
  buildExpiredSessionCookieHeader,
  buildSessionCookieHeader,
  getSessionTokenFromCookie,
  parseCookie,
  sessionCookieName,
  sessionTtlSeconds,
  shouldUseSecureCookies
} from "./authSession";

describe("auth session helpers", () => {
  it("parses cookies while preserving values that contain equals signs", () => {
    expect(parseCookie("theme=dark; kiss_pm_session=abc=123; empty=")).toEqual({
      theme: "dark",
      kiss_pm_session: "abc=123",
      empty: ""
    });
  });

  it("extracts the KISS PM session token from a cookie header", () => {
    const token = "a".repeat(64);

    expect(getSessionTokenFromCookie(`other=1; kiss_pm_session=${token}`)).toBe(
      token
    );
    expect(getSessionTokenFromCookie("kiss_pm_session=raw-token")).toBeUndefined();
    expect(getSessionTokenFromCookie(`kiss_pm_session=${"a".repeat(65)}`)).toBeUndefined();
    expect(getSessionTokenFromCookie(`kiss_pm_session=${"g".repeat(64)}`)).toBeUndefined();
    expect(getSessionTokenFromCookie(null)).toBeUndefined();
  });

  it("builds HttpOnly SameSite=Lax session cookie headers", () => {
    expect(sessionCookieName).toBe("kiss_pm_session");
    expect(sessionTtlSeconds).toBe(7 * 24 * 60 * 60);
    expect(buildSessionCookieHeader("raw-token", { secure: false })).toBe(
      "kiss_pm_session=raw-token; HttpOnly; Path=/; SameSite=Lax; Priority=High; Max-Age=604800"
    );
    expect(buildExpiredSessionCookieHeader({ secure: false })).toBe(
      "kiss_pm_session=; HttpOnly; Path=/; SameSite=Lax; Priority=High; Max-Age=0"
    );
  });

  it("adds Secure when deployment opts into HTTPS-only cookies", () => {
    expect(buildSessionCookieHeader("raw-token", { secure: true })).toBe(
      "kiss_pm_session=raw-token; HttpOnly; Path=/; SameSite=Lax; Priority=High; Max-Age=604800; Secure"
    );
    expect(buildExpiredSessionCookieHeader({ secure: true })).toBe(
      "kiss_pm_session=; HttpOnly; Path=/; SameSite=Lax; Priority=High; Max-Age=0; Secure"
    );
  });

  it("defaults production deployments to HTTPS-only cookies with explicit override", () => {
    expect(shouldUseSecureCookies({ KISS_PM_SECURE_COOKIES: "true" })).toBe(true);
    expect(shouldUseSecureCookies({ KISS_PM_SECURE_COOKIES: "false" })).toBe(false);
    expect(shouldUseSecureCookies({ NODE_ENV: "production" })).toBe(true);
    expect(shouldUseSecureCookies({ NODE_ENV: "development" })).toBe(false);
    expect(shouldUseSecureCookies({})).toBe(false);
  });
});
