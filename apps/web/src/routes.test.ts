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
      "clients",
      "contacts",
      "users",
      "access-roles",
      "positions",
      "audit",
      "settings",
      "project-types",
      "deal-stages",
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
        routes: [workspaceRoutes[5], workspaceRoutes[6]]
      },
      {
        id: "personal",
        label: "Личное",
        routes: [workspaceRoutes[12]]
      }
    ]);
  });

  it("keeps CRM entities outside deals and workspace dictionaries in settings", () => {
    const routeGroups = getVisibleRouteGroups([
      "tenant.clients.read",
      "tenant.contacts.read",
      "tenant.project_types.read",
      "tenant.deal_stages.read"
    ]);

    expect(routeGroups).toEqual([
      {
        id: "workspace",
        label: "Работа",
        routes: [workspaceRoutes[0]]
      },
      {
        id: "crm",
        label: "CRM",
        routes: [workspaceRoutes[3], workspaceRoutes[4]]
      },
      {
        id: "settings",
        label: "Настройки",
        routes: [workspaceRoutes[10], workspaceRoutes[11]]
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
    expect(getRouteIdFromPathname("/clients")).toBe("clients");
    expect(getRouteIdFromPathname("/contacts")).toBe("contacts");
    expect(getRouteIdFromPathname("/opportunities")).toBe("opportunities");
    expect(getRouteIdFromPathname("/opportunities/opportunity-1")).toBe("opportunities");
    expect(getRouteIdFromPathname("/projects")).toBe("projects");
    expect(getRouteIdFromPathname("/audit")).toBe("audit");
    expect(getRouteIdFromPathname("/settings")).toBe("settings");
    expect(getRouteIdFromPathname("/settings/project-types")).toBe("project-types");
    expect(getRouteIdFromPathname("/settings/deal-stages")).toBe("deal-stages");
    expect(getRouteIdFromPathname("/unknown")).toBe("dashboard");
  });

  it("returns real Next paths for workspace routes", () => {
    expect(getRoutePath("dashboard")).toBe("/dashboard");
    expect(getRoutePath("opportunities")).toBe("/opportunities");
    expect(getRoutePath("projects")).toBe("/projects");
    expect(getRoutePath("clients")).toBe("/clients");
    expect(getRoutePath("contacts")).toBe("/contacts");
    expect(getRoutePath("users")).toBe("/users");
    expect(getRoutePath("settings")).toBe("/settings");
    expect(getRoutePath("project-types")).toBe("/settings/project-types");
    expect(getRoutePath("deal-stages")).toBe("/settings/deal-stages");
  });
});
