import { describe, expect, it } from "vitest";

import { getProfileEditCapabilities } from "./profile-surface";

describe("getProfileEditCapabilities", () => {
  it("disables profile and theme edits when permissions are missing", () => {
    expect(getProfileEditCapabilities(["tenant.projects.read"])).toEqual({
      canUpdateProfile: false,
      canManageTheme: false
    });
  });

  it("allows profile and theme edits independently", () => {
    expect(getProfileEditCapabilities(["profile.update"])).toEqual({
      canUpdateProfile: true,
      canManageTheme: false
    });
    expect(getProfileEditCapabilities(["workspace.theme.manage"])).toEqual({
      canUpdateProfile: false,
      canManageTheme: true
    });
  });
});
