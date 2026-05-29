import { describe, expect, it } from "vitest";

import {
  pathForScreenId,
  RAIL_SECTIONS,
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
    expect(screenIdForPath("/my-work")).toBe("02-my-work");
    expect(screenIdForPath("/deals")).toBe("05-deals");
    expect(screenIdForPath("/projects/demo/gantt")).toBe("12-project-gantt");
    expect(screenIdForPath("/settings")).toBe("10-settings");
    expect(screenIdForPath("/login")).toBe("19-login");
  });

  it("keeps ScreenId to runtime path lookup available for Storybook metadata", () => {
    expect(pathForScreenId("01-dashboard")).toBe("/dashboard");
    expect(pathForScreenId("05-deals")).toBe("/deals");
    expect(pathForScreenId("12-project-gantt")).toBe("/projects/demo/gantt");
  });

  it("provides real hrefs for primary rail entries", () => {
    expect(RAIL_SECTIONS.map((section) => section.href)).toEqual([
      "/dashboard",
      "/my-work",
      "/deals",
      "/projects",
      "/directories/clients",
      "/projects/demo/kpi",
      "/settings"
    ]);
  });
});
