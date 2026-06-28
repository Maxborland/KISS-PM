import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createTurnConfigFromEnv,
  issueTurnCredentials,
  parseTurnCredentialTtlSeconds
} from "./turnCredentials";

describe("turn credentials", () => {
  it("returns null when TURN is not configured", () => {
    expect(createTurnConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("parses config and bounds the credential TTL", () => {
    const config = createTurnConfigFromEnv({
      KISS_PM_TURN_URL: "turns:turn.kiss.local:5349, turn:turn.kiss.local:3478",
      KISS_PM_TURN_SHARED_SECRET: "turn-secret-value",
      KISS_PM_TURN_CREDENTIAL_TTL_SECONDS: "300"
    } as NodeJS.ProcessEnv);
    expect(config).toEqual({
      urls: ["turns:turn.kiss.local:5349", "turn:turn.kiss.local:3478"],
      sharedSecret: "turn-secret-value",
      ttlSeconds: 300
    });
  });

  it("rejects an out-of-range or malformed TTL", () => {
    expect(() => parseTurnCredentialTtlSeconds("59")).toThrow("turn_credential_ttl_invalid");
    expect(() => parseTurnCredentialTtlSeconds("3601")).toThrow("turn_credential_ttl_invalid");
    expect(() => parseTurnCredentialTtlSeconds("12abc")).toThrow("turn_credential_ttl_invalid");
    expect(parseTurnCredentialTtlSeconds(undefined)).toBe(600);
  });

  it("rejects a weak or padded shared secret", () => {
    expect(() =>
      createTurnConfigFromEnv({
        KISS_PM_TURN_URL: "turn:turn.kiss.local:3478",
        KISS_PM_TURN_SHARED_SECRET: " padded"
      } as NodeJS.ProcessEnv)
    ).toThrow("turn_shared_secret_invalid");
  });

  it("issues coturn-compatible time-limited HMAC credentials without leaking the secret", () => {
    const config = {
      urls: ["turns:turn.kiss.local:5349"],
      sharedSecret: "turn-secret-value",
      ttlSeconds: 600
    };
    const credentials = issueTurnCredentials(config, "user-alpha", 1_000_000);

    expect(credentials.username).toBe("1000600:user-alpha");
    const expected = createHmac("sha1", config.sharedSecret).update("1000600:user-alpha").digest("base64");
    expect(credentials.credential).toBe(expected);
    expect(credentials.credential).not.toContain("turn-secret-value");
    expect(credentials.urls).toEqual(["turns:turn.kiss.local:5349"]);
    expect(credentials.expiresAt).toBe(new Date(1_000_600 * 1000).toISOString());
  });
});
