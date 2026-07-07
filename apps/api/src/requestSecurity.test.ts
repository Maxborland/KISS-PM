import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  isTrustedBrowserMutationRequest,
  setApiSecurityHeaders,
  trustedMutationOriginsFromEnv
} from "./requestSecurity";

describe("request security helpers", () => {
  it("sets a browser security header baseline for API responses", async () => {
    const app = new Hono();
    app.get("/headers", (context) => {
      setApiSecurityHeaders(context);
      return context.json({ ok: true });
    });

    const response = await app.request("/headers");

    expect(response.headers.get("content-security-policy")).toBe(
      "base-uri 'self'; frame-ancestors 'none'; object-src 'none'"
    );
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-permitted-cross-domain-policies")).toBe("none");
  });

  it("accepts same-origin browser mutations", () => {
    const request = new Request("http://127.0.0.1:4000/api/workspace/users", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:4000",
        "sec-fetch-site": "same-origin"
      }
    });

    expect(isTrustedBrowserMutationRequest(request)).toBe(true);
  });

  it("rejects cross-site browser mutations even with the action header present", () => {
    const request = new Request("http://127.0.0.1:4000/api/workspace/users", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
        "x-kiss-pm-action": "same-origin"
      }
    });

    expect(isTrustedBrowserMutationRequest(request)).toBe(false);
  });

  it("accepts configured trusted web origins for proxied API requests", () => {
    const request = new Request("http://127.0.0.1:4000/api/workspace/users", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:3000",
        "sec-fetch-site": "same-site"
      }
    });

    expect(isTrustedBrowserMutationRequest(request, ["http://127.0.0.1:3000"])).toBe(
      true
    );
  });

  it("accepts loopback web origins on non-default dev ports", () => {
    const request = new Request("http://127.0.0.1:4000/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "http://localhost:3011",
        "sec-fetch-site": "same-site"
      }
    });

    expect(
      isTrustedBrowserMutationRequest(
        request,
        trustedMutationOriginsFromEnv({ NODE_ENV: "development" })
      )
    ).toBe(true);
  });

  it("does not trust loopback dev ports by default in production", () => {
    const request = new Request("http://127.0.0.1:4000/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "http://localhost:3011",
        "sec-fetch-site": "same-site"
      }
    });

    expect(
      isTrustedBrowserMutationRequest(
        request,
        trustedMutationOriginsFromEnv({ NODE_ENV: "production" })
      )
    ).toBe(false);
  });

  it("requires explicit trusted origins in production", () => {
    expect(trustedMutationOriginsFromEnv({ NODE_ENV: "production" })).toEqual([]);
    expect(
      trustedMutationOriginsFromEnv({
        NODE_ENV: "production",
        KISS_PM_TRUSTED_MUTATION_ORIGINS: "https://pm.example.com/"
      })
    ).toEqual(["https://pm.example.com"]);
  });

  it("normalizes trusted origins from env and ignores invalid origin shapes", () => {
    expect(
      trustedMutationOriginsFromEnv({
        NODE_ENV: "production",
        KISS_PM_TRUSTED_MUTATION_ORIGINS:
          " https://pm.example.com:443/ , javascript:alert(1), https://user:pass@pm.example.com, https://pm.example.com/app, https://app.example.com "
      })
    ).toEqual(["https://pm.example.com", "https://app.example.com"]);
  });
});
