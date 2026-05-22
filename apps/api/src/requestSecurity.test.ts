import { describe, expect, it } from "vitest";
import {
  isTrustedBrowserMutationRequest,
  trustedMutationOriginsFromEnv
} from "./requestSecurity";

describe("request security helpers", () => {
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

  it("requires explicit trusted origins in production", () => {
    expect(trustedMutationOriginsFromEnv({ NODE_ENV: "production" })).toEqual([]);
    expect(
      trustedMutationOriginsFromEnv({
        NODE_ENV: "production",
        KISS_PM_TRUSTED_MUTATION_ORIGINS: "https://pm.example.com"
      })
    ).toEqual(["https://pm.example.com"]);
  });
});
