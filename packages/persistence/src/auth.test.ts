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

  it("hashes session tokens deterministically without storing the raw token", () => {
    expect(hashSessionToken("session-token")).toBe(
      hashSessionToken("session-token")
    );
    expect(hashSessionToken("session-token")).not.toBe("session-token");
  });
});
