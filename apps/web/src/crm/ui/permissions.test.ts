import { describe, expect, it } from "vitest";

import { getCrmWriteCapability } from "./permissions";

describe("getCrmWriteCapability", () => {
  it("allows mock/storybook mode without a live session", () => {
    expect(getCrmWriteCapability({ live: false, permissions: [], permission: "tenant.clients.manage" })).toEqual({
      allowed: true,
      disabledReason: null
    });
  });

  it("allows live users with the required manage permission", () => {
    expect(getCrmWriteCapability({ live: true, permissions: ["tenant.clients.manage"], permission: "tenant.clients.manage" })).toEqual({
      allowed: true,
      disabledReason: null
    });
  });

  it("disables live write controls without the required manage permission", () => {
    expect(getCrmWriteCapability({ live: true, permissions: ["tenant.clients.read"], permission: "tenant.clients.manage" })).toEqual({
      allowed: false,
      disabledReason: "Недостаточно прав для создания или изменения"
    });
  });
});
