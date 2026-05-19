import { describe, expect, it } from "vitest";

import { workspaceRouteIcons } from "./workspaceRouteIcons";
import { workspaceRoutes } from "./routes";

describe("workspace route icon registry", () => {
  it("contains an icon for every stable workspace route id", () => {
    expect(Object.keys(workspaceRouteIcons).sort()).toEqual(
      workspaceRoutes.map((route) => route.id).sort()
    );
  });

  it("keeps route icons as renderable component references", () => {
    for (const route of workspaceRoutes) {
      expect(["function", "object"]).toContain(typeof workspaceRouteIcons[route.id]);
    }
  });
});
