import { describe, expect, it } from "vitest";

import { canOpenStaticRuntimeScreen } from "@/app/runtime-data-screen";

describe("RuntimeDataScreen permission gate", () => {
  it("blocks static admin, settings and catalog screens for project-only users", () => {
    const permissions = ["tenant.projects.read"];

    expect(canOpenStaticRuntimeScreen("09-admin", permissions)).toBe(false);
    expect(canOpenStaticRuntimeScreen("10-settings", permissions)).toBe(false);
    expect(canOpenStaticRuntimeScreen("08-entities-clients", permissions)).toBe(false);
  });

  it("allows static runtime screens when the matching read permission is present", () => {
    expect(canOpenStaticRuntimeScreen("09-admin", ["tenant.users.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("10-settings", ["tenant.workspace_config.read"])).toBe(true);
    expect(canOpenStaticRuntimeScreen("08-entities-clients", ["tenant.clients.read"])).toBe(true);
  });

  it("keeps general workspace screens available to authenticated users", () => {
    expect(canOpenStaticRuntimeScreen("01-dashboard", [])).toBe(true);
    expect(canOpenStaticRuntimeScreen("state-loading", [])).toBe(true);
  });
});
