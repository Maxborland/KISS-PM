import { describe, expect, it } from "vitest";

import {
  parseAccessProfileCreateBody,
  parsePositionBody,
  parseWorkspaceUserBody,
  parseWorkspaceUserPatchBody
} from "./workspaceParsers";

describe("workspace parsers", () => {
  it("rejects unsafe access profile identifiers before persistence", () => {
    expect(
      parseAccessProfileCreateBody({
        id: "access-profile-alpha-reader",
        name: "Reader",
        permissions: ["tenant.users.read"]
      })
    ).toMatchObject({
      ok: true,
      value: { id: "access-profile-alpha-reader" }
    });

    expect(
      parseAccessProfileCreateBody({
        id: "bad/role",
        name: "Bad",
        permissions: ["tenant.users.read"]
      })
    ).toEqual({ ok: false, error: "invalid_access_profile_id" });

    expect(
      parseAccessProfileCreateBody({
        id: "access-profile-alpha-reader",
        name: "Reader\u0000",
        permissions: ["tenant.users.read"]
      })
    ).toEqual({ ok: false, error: "invalid_access_profile_name" });

    expect(
      parseAccessProfileCreateBody({
        id: "access-profile-alpha-reader",
        name: "R".repeat(161),
        permissions: ["tenant.users.read"]
      })
    ).toEqual({ ok: false, error: "invalid_access_profile_name" });
  });

  it("rejects unsafe workspace user identifiers before persistence", () => {
    const valid = parseWorkspaceUserBody(
      {
        id: "user-alpha-new",
        email: "new@kiss-pm.local",
        name: "New User",
        accessProfileId: "access-profile-alpha-reader",
        positionId: "position-alpha-pm"
      },
      "tenant-alpha"
    );
    expect(valid).toMatchObject({
      ok: true,
      value: {
        id: "user-alpha-new",
        accessProfileId: "access-profile-alpha-reader",
        positionId: "position-alpha-pm"
      }
    });

    expect(
      parseWorkspaceUserBody(
        {
          id: "bad/user",
          email: "bad@kiss-pm.local",
          name: "Bad User",
          accessProfileId: "access-profile-alpha-reader"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_user_id" });

    expect(
      parseWorkspaceUserBody(
        {
          id: "user-alpha-new",
          email: "bad@kiss-pm.local",
          name: "Bad User",
          accessProfileId: "bad/role"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_access_role" });

    expect(
      parseWorkspaceUserBody(
        {
          id: "user-alpha-new",
          email: "bad@kiss-pm.local",
          name: "Bad User",
          accessProfileId: "access-profile-alpha-reader",
          positionId: "bad..position"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_position_id" });

    expect(
      parseWorkspaceUserBody(
        {
          id: "user-alpha-new",
          email: "not-an-email",
          name: "Bad User",
          accessProfileId: "access-profile-alpha-reader"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_user_email" });

    expect(
      parseWorkspaceUserBody(
        {
          id: "user-alpha-new",
          email: "bad@kiss-pm.local",
          name: `Bad\nUser`,
          accessProfileId: "access-profile-alpha-reader"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_user_name" });

    expect(
      parseWorkspaceUserBody(
        {
          id: "user-alpha-new",
          email: "bad@kiss-pm.local",
          name: "Bad User",
          accessProfileId: "access-profile-alpha-reader",
          phone: "1".repeat(81)
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_user_phone" });

    expect(
      parseWorkspaceUserBody(
        {
          id: "user-alpha-new",
          email: "bad@kiss-pm.local",
          name: "Bad User",
          accessProfileId: "access-profile-alpha-reader",
          telegram: "bad\u0000telegram"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_user_telegram" });

    expect(
      parseWorkspaceUserBody(
        {
          id: "user-alpha-new",
          email: "bad@kiss-pm.local",
          name: "Bad User",
          accessProfileId: "access-profile-alpha-reader",
          password: "x".repeat(1025)
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_user_password" });
  });

  it("normalizes workspace user patch identifiers and still allows clearing position", () => {
    const current = {
      id: "user-alpha-existing",
      tenantId: "tenant-alpha",
      email: "existing@kiss-pm.local",
      name: "Existing",
      accessProfileId: "access-profile-alpha-reader",
      positionId: "position-alpha-pm",
      positionName: "PM",
      phone: null,
      telegram: null,
      status: "active",
      theme: "light",
      accentColor: "#0f766e"
    };

    expect(
      parseWorkspaceUserPatchBody(
        { positionId: "" },
        "tenant-alpha",
        "user-alpha-existing",
        current
      )
    ).toMatchObject({
      ok: true,
      value: { id: "user-alpha-existing", positionId: null }
    });

    expect(
      parseWorkspaceUserPatchBody(
        { positionId: "bad/position" },
        "tenant-alpha",
        "user-alpha-existing",
        current
      )
    ).toEqual({ ok: false, error: "invalid_position_id" });

    expect(
      parseWorkspaceUserPatchBody(
        { email: "bad-email" },
        "tenant-alpha",
        "user-alpha-existing",
        current
      )
    ).toEqual({ ok: false, error: "invalid_user_email" });

    expect(
      parseWorkspaceUserPatchBody(
        { phone: "1".repeat(81) },
        "tenant-alpha",
        "user-alpha-existing",
        current
      )
    ).toEqual({ ok: false, error: "invalid_user_phone" });
  });

  it("rejects unsafe position identifiers before persistence", () => {
    expect(
      parsePositionBody(
        {
          id: "position-alpha-pm",
          name: "PM"
        },
        "tenant-alpha"
      )
    ).toMatchObject({
      ok: true,
      value: { id: "position-alpha-pm" }
    });

    expect(
      parsePositionBody(
        {
          id: "bad/position",
          name: "Bad"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_position_id" });

    expect(
      parsePositionBody(
        {
          id: "position-alpha-pm",
          name: "PM\u0000"
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_position_name" });

    expect(
      parsePositionBody(
        {
          id: "position-alpha-pm",
          name: "PM",
          description: "d".repeat(1001)
        },
        "tenant-alpha"
      )
    ).toEqual({ ok: false, error: "invalid_position_description" });
  });
});
