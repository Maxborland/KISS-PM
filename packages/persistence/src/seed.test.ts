import { describe, expect, it } from "vitest";

import { createTenantAdminSeedProfile } from "./seed";

describe("tenant admin seed profile", () => {
  it("includes communications permissions for persisted default admins", () => {
    const profile = createTenantAdminSeedProfile({
      id: "access-profile-admin",
      tenantId: "tenant-alpha"
    });

    expect(profile.permissions).toEqual(
      expect.arrayContaining([
        "tenant.communications.read",
        "tenant.communications.manage"
      ])
    );
  });
});
