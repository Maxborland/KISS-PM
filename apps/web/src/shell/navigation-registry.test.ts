import { describe, expect, it } from "vitest";

import {
  canOpenRuntimePath,
  contextNavForSection,
  pathForScreenId,
  RAIL_SECTIONS,
  railSectionsForPermissions,
  screenIdForPath,
  SCREEN_ROUTE_BY_ID
} from "@/shell/navigation-registry";

describe("navigation-registry", () => {
  it("highlights CRM for deals, not inbox", () => {
    const deals = SCREEN_ROUTE_BY_ID["05-deals"];
    expect(deals.railSection).toBe("crm");
    expect(deals.contextActiveItem).toBe("Сделки");
    expect(deals.contextActiveItem).not.toBe("Входящие");
  });

  it("highlights projects for gantt and resources, not reports", () => {
    expect(SCREEN_ROUTE_BY_ID["12-project-gantt"].railSection).toBe("projects");
    expect(SCREEN_ROUTE_BY_ID["13-project-resources"].railSection).toBe("projects");
    expect(SCREEN_ROUTE_BY_ID["12-project-gantt"].railSection).not.toBe("reports");
    expect(SCREEN_ROUTE_BY_ID["13-project-resources"].contextActiveItem).toBe("Ресурсы");
  });

  it("aligns breadcrumbs with page title for projects list", () => {
    const meta = SCREEN_ROUTE_BY_ID["07-projects-list"];
    expect(meta.pageTitle).toBe("Проекты");
    expect(meta.breadcrumb.at(-1)?.label).toBe("Проекты");
    expect(meta.breadcrumb.at(-1)?.current).toBe(true);
  });

  it("marks dashboard for team topbar and create-export intro actions", () => {
    const dashboard = SCREEN_ROUTE_BY_ID["01-dashboard"];
    expect(dashboard.topbarMode).toBe("team");
    expect(dashboard.pageIntroActions).toBe("create-export");
  });

  it("resolves runtime paths to accepted screen ids", () => {
    expect(screenIdForPath("/dashboard")).toBe("01-dashboard");
    expect(screenIdForPath("/agent")).toBe("20-agent-cockpit");
    expect(screenIdForPath("/my-work")).toBe("02-my-work");
    expect(screenIdForPath("/deals")).toBe("05-deals");
    expect(screenIdForPath("/projects/project-alpha")).toBe("07b-project-detail");
    expect(screenIdForPath("/projects/project-alpha/timeline")).toBe("12-project-gantt");
    expect(screenIdForPath("/settings")).toBe("10-settings");
    expect(screenIdForPath("/login")).toBe("19-login");
  });

  it("keeps ScreenId to runtime path lookup available for Storybook metadata", () => {
    expect(pathForScreenId("01-dashboard")).toBe("/dashboard");
    expect(pathForScreenId("20-agent-cockpit")).toBe("/agent");
    expect(pathForScreenId("05-deals")).toBe("/deals");
    expect(pathForScreenId("07b-project-detail")).toBe("/projects/:projectId");
    expect(pathForScreenId("12-project-gantt")).toBe("/projects/:projectId/timeline");
  });

  it("provides real hrefs for primary rail entries", () => {
    expect(RAIL_SECTIONS.map((section) => section.href)).toEqual([
      "/dashboard",
      "/my-work",
      "/deals",
      "/projects",
      "/directories/clients",
      "/reports",
      "/settings"
    ]);
    expect(RAIL_SECTIONS.map((section) => section.href).some((href) => href.includes("/demo"))).toBe(false);
  });

  it("hides non-beta runtime paths from navigation until they are API-backed", () => {
    expect(canOpenRuntimePath("/showcase/spacing", ["tenant.projects.read"])).toBe(false);
    expect(canOpenRuntimePath("/projects/demo", ["tenant.projects.read"])).toBe(false);
    expect(canOpenRuntimePath("/projects/demo/gantt", ["tenant.project_plan.read"])).toBe(false);
    expect(canOpenRuntimePath("/settings", ["tenant.workspace_config.read"])).toBe(false);
  });

  it("allows real project detail paths for project readers", () => {
    expect(canOpenRuntimePath("/projects/project-alpha", ["tenant.projects.read"])).toBe(true);
    expect(canOpenRuntimePath("/projects/project-alpha", [])).toBe(false);
  });

  it("allows real project timeline paths only for project plan readers", () => {
    expect(canOpenRuntimePath("/projects/project-alpha/timeline", ["tenant.project_plan.read"])).toBe(true);
    expect(canOpenRuntimePath("/projects/project-alpha/timeline", ["tenant.projects.read"])).toBe(false);
    expect(canOpenRuntimePath("/projects/demo/gantt", ["tenant.project_plan.read"])).toBe(false);
  });

  it("exposes the workspace agent as an overview surface", () => {
    const agent = SCREEN_ROUTE_BY_ID["20-agent-cockpit"];
    expect(agent.railSection).toBe("overview");
    expect(agent.contextActiveItem).toBe("Агент");
    expect(agent.requiredPermissions).toEqual(["tenant.projects.read"]);
    expect(
      contextNavForSection("overview", "Агент", ["tenant.projects.read"]).flatMap((group) =>
        group.items.map((item) => [item.label, item.href])
      )
    ).toContainEqual(["Агент", "/agent"]);
  });

  it("filters protected rail entries for restricted runtime users", () => {
    expect(railSectionsForPermissions(["tenant.projects.read"]).map((section) => section.href)).toEqual([
      "/dashboard",
      "/my-work",
      "/projects"
    ]);

    expect(
      railSectionsForPermissions([
        "tenant.projects.read",
        "tenant.opportunities.read",
        "tenant.deal_stages.read",
        "tenant.clients.read",
        "tenant.workspace_config.read"
      ]).map((section) => section.href)
    ).toEqual(["/dashboard", "/my-work", "/deals", "/projects"]);
  });

  it("requires both opportunities and deal stages for the deals route", () => {
    expect(railSectionsForPermissions(["tenant.opportunities.read"]).map((section) => section.href)).not.toContain(
      "/deals"
    );
    expect(
      railSectionsForPermissions(["tenant.opportunities.read", "tenant.deal_stages.read"]).map(
        (section) => section.href
      )
    ).toContain("/deals");
  });

  it("filters protected context links for restricted runtime users", () => {
    expect(
      contextNavForSection("projects", "Все проекты", ["tenant.projects.read"]).flatMap((group) =>
        group.items.map((item) => item.href)
      ).filter(Boolean)
    ).toEqual(["/projects"]);

    expect(
      contextNavForSection("settings", "Рабочая область", ["tenant.workspace_config.read"]).flatMap(
        (group) => group.items.map((item) => item.href ?? null)
      )
    ).toEqual([null]);
  });
});
