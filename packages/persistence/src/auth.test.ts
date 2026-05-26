import { describe, expect, it } from "vitest";

import { hashPassword, hashSessionToken, verifyPassword } from "./auth";

describe("auth password and session primitives", () => {
  it("verifies the original password and rejects another password", () => {
    const hash = hashPassword("local-admin-password");

    expect(
      verifyPassword({
        password: "local-admin-password",
        ...hash
      })
    ).toBe(true);
    expect(
      verifyPassword({
        password: "wrong-password",
        ...hash
      })
    ).toBe(false);
  });

  it("hashes random session tokens deterministically without expensive password KDF work", () => {
    const tokenHash = hashSessionToken("session-token");

    expect(tokenHash).toBe(hashSessionToken("session-token"));
    expect(tokenHash).not.toBe("session-token");
    expect(tokenHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hashSessionToken("other-session-token")).not.toBe(tokenHash);
  });
});
