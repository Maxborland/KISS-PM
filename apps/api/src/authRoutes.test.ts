import { describe, expect, it } from "vitest";

import { buildAuthMeResponse } from "./authRoutes";

describe("buildAuthMeResponse", () => {
  it("возвращает человекочитаемые названия workspace и профиля доступа", () => {
    const actor = {
      id: "user-alpha",
      tenantId: "tenant-alpha",
      name: "Анна",
      accessProfileId: "profile-alpha"
    };
    const fullUser = {
      ...actor,
      email: "anna@example.com"
    };

    expect(buildAuthMeResponse({
      actor,
      fullUser,
      permissions: ["profile.read"],
      workspaceName: "Бюро Север",
      accessProfileName: "Владелец"
    })).toEqual({
      user: {
        ...fullUser,
        accessProfileName: "Владелец",
        workspaceName: "Бюро Север"
      },
      permissions: ["profile.read"],
      workspace: {
        id: "tenant-alpha",
        name: "Бюро Север"
      }
    });
  });
});
