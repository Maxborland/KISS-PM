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
    expect(getSessionTokenFromCookie("other=1; kiss_pm_session=raw-token")).toBe(
      "raw-token"
    );
    expect(getSessionTokenFromCookie(null)).toBeUndefined();
  });

  it("builds HttpOnly SameSite=Lax session cookie headers", () => {
    expect(sessionCookieName).toBe("kiss_pm_session");
    expect(sessionTtlSeconds).toBe(7 * 24 * 60 * 60);
    expect(buildSessionCookieHeader("raw-token", { secure: false })).toBe(
      "kiss_pm_session=raw-token; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800"
    );
    expect(buildExpiredSessionCookieHeader({ secure: false })).toBe(
      "kiss_pm_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
    );
  });

  it("adds Secure when deployment opts into HTTPS-only cookies", () => {
    expect(buildSessionCookieHeader("raw-token", { secure: true })).toBe(
      "kiss_pm_session=raw-token; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800; Secure"
    );
    expect(buildExpiredSessionCookieHeader({ secure: true })).toBe(
      "kiss_pm_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Secure"
    );
  });

  it("reads the explicit production secure-cookie opt-in flag", () => {
    expect(shouldUseSecureCookies({ KISS_PM_SECURE_COOKIES: "true" })).toBe(true);
    expect(shouldUseSecureCookies({ KISS_PM_SECURE_COOKIES: "false" })).toBe(false);
    expect(shouldUseSecureCookies({})).toBe(false);
  });
});
