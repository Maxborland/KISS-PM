import { describe, expect, it } from "vitest";

import {
  getDefaultRouteId,
  findRouteByQuery,
  getRouteIdFromPathname,
  getRoutePath,
  getVisibleRouteGroups,
  getVisibleRoutes,
  isRouteId,
  workspaceRoutes
} from "./routes";

describe("workspace route model", () => {
  it("keeps stable route ids for the single-workspace shell", () => {
    expect(workspaceRoutes.map((route) => route.id)).toEqual([
      "dashboard",
      "opportunities",
      "projects",
      "users",
      "access-roles",
      "positions",
      "audit",
      "settings",
      "profile",
      "theme"
    ]);
  });

  it("shows only routes allowed by the current permission set", () => {
    const visibleRoutes = getVisibleRoutes(["profile.read", "profile.update"]);

    expect(visibleRoutes.map((route) => route.id)).toEqual(["dashboard", "profile"]);
  });

  it("groups visible routes for the admin dashboard sidebar", () => {
    const routeGroups = getVisibleRouteGroups([
      "tenant.users.read",
      "tenant.access_profiles.read",
      "profile.read"
    ]);

    expect(routeGroups).toEqual([
      {
        id: "workspace",
        label: "Работа",
        routes: [workspaceRoutes[0]]
      },
      {
        id: "admin",
        label: "Администрирование",
        routes: [workspaceRoutes[3], workspaceRoutes[4]]
      },
      {
        id: "personal",
        label: "Личное",
        routes: [workspaceRoutes[8]]
      }
    ]);
  });

  it("prefers route labels over description matches in quick navigation", () => {
    const route = findRouteByQuery(workspaceRoutes, "Должности");

    expect(route?.id).toBe("positions");
  });

  it("falls back to dashboard when a requested route is unavailable", () => {
    expect(getDefaultRouteId("users", ["profile.read"])).toBe("dashboard");
    expect(getDefaultRouteId("profile", ["profile.read"])).toBe("profile");
  });

  it("recognizes route ids without accepting arbitrary strings", () => {
    expect(isRouteId("positions")).toBe(true);
    expect(isRouteId("reports")).toBe(false);
  });

  it("maps real Next pathnames to workspace route ids", () => {
    expect(getRouteIdFromPathname("/users")).toBe("users");
    expect(getRouteIdFromPathname("/access-roles")).toBe("access-roles");
    expect(getRouteIdFromPathname("/opportunities")).toBe("opportunities");
    expect(getRouteIdFromPathname("/projects")).toBe("projects");
    expect(getRouteIdFromPathname("/audit")).toBe("audit");
    expect(getRouteIdFromPathname("/settings")).toBe("settings");
    expect(getRouteIdFromPathname("/unknown")).toBe("dashboard");
  });

  it("returns real Next paths for workspace routes", () => {
    expect(getRoutePath("dashboard")).toBe("/dashboard");
    expect(getRoutePath("opportunities")).toBe("/opportunities");
    expect(getRoutePath("projects")).toBe("/projects");
    expect(getRoutePath("users")).toBe("/users");
    expect(getRoutePath("settings")).toBe("/settings");
  });
});
