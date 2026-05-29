import { afterEach, describe, expect, it } from "vitest";
import { hashIp } from "./hash";

const originalSalt = process.env["WAITLIST_IP_SALT"];

afterEach(() => {
  if (originalSalt === undefined) {
    delete process.env["WAITLIST_IP_SALT"];
    return;
  }
  process.env["WAITLIST_IP_SALT"] = originalSalt;
});

describe("hashIp", () => {
  it("does not persist a hash when the deployment salt is missing", () => {
    delete process.env["WAITLIST_IP_SALT"];

    expect(hashIp("203.0.113.7")).toBeNull();
  });

  it("does not persist a hash when the deployment salt is blank", () => {
    process.env["WAITLIST_IP_SALT"] = "  ";

    expect(hashIp("203.0.113.7")).toBeNull();
  });

  it("hashes deterministically with a configured deployment salt", () => {
    process.env["WAITLIST_IP_SALT"] = "tenant-specific-secret";

    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
    expect(hashIp("203.0.113.7")).toHaveLength(32);
  });

  it("uses the deployment salt as part of the hash", () => {
    process.env["WAITLIST_IP_SALT"] = "first-secret";
    const first = hashIp("203.0.113.7");

    process.env["WAITLIST_IP_SALT"] = "second-secret";

    expect(hashIp("203.0.113.7")).not.toBe(first);
  });
});
