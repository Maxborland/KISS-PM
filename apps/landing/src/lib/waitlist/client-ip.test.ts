import { afterEach, describe, expect, it } from "vitest";
import { resolveClientIp } from "./client-ip";

const originalTrustProxy = process.env["WAITLIST_TRUST_PROXY"];

afterEach(() => {
  if (originalTrustProxy === undefined) {
    delete process.env["WAITLIST_TRUST_PROXY"];
    return;
  }
  process.env["WAITLIST_TRUST_PROXY"] = originalTrustProxy;
});

describe("resolveClientIp", () => {
  it("uses the socket address when forwarded headers are not trusted", () => {
    delete process.env["WAITLIST_TRUST_PROXY"];
    const request = new Request("https://kiss-pm.app/api/waitlist", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });

    expect(resolveClientIp(request, "198.51.100.4")).toBe("198.51.100.4");
  });

  it("uses the first forwarded address when proxy headers are trusted", () => {
    process.env["WAITLIST_TRUST_PROXY"] = "true";
    const request = new Request("https://kiss-pm.app/api/waitlist", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.8" },
    });

    expect(resolveClientIp(request, "198.51.100.4")).toBe("203.0.113.9");
  });

  it("trusts forwarded headers from private proxy socket addresses", () => {
    delete process.env["WAITLIST_TRUST_PROXY"];
    const request = new Request("https://kiss-pm.app/api/waitlist", {
      headers: { "x-real-ip": "203.0.113.12" },
    });

    expect(resolveClientIp(request, "10.0.0.8")).toBe("203.0.113.12");
  });
});
